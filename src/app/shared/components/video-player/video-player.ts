import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Capacitor } from '@capacitor/core';
import Hls from 'hls.js';
import { AppError } from '../../../core/models/common.models';
import { PlaybackSource } from '../../../core/services/stream.service';
import { StorageService } from '../../../core/services/storage.service';
import { ClockTimePipe } from '../../pipes/clock-time.pipe';

const TIME_UPDATE_EMIT_INTERVAL_MS = 5000;
/** Seconds moved per rewind/forward tap — surfaced in the UI so the label always matches the actual behavior. */
export const SEEK_STEP_SECONDS = 10;
/** How soon before the end the "next episode" prompt appears — matches Stremio's own next-up window. */
const NEXT_UP_THRESHOLD_SECS = 15;
const ASPECT_RATIO_STORAGE_KEY = 'video-aspect-ratio';
const PLAYBACK_RATE_STORAGE_KEY = 'video-playback-rate';

/**
 * A direct `<video src>` load bypasses CapacitorHttp entirely (it only patches fetch/XHR, not
 * media-element resource loading), and Android's WebView mixed-content policy can still block
 * an http:// stream on an https-origin page even with allowMixedContent set. Relaying through a
 * loopback server sidesteps this: 127.0.0.1 is a trustworthy origin per the mixed-content spec,
 * and LocalVideoRelayServer (android/.../MainActivity.java) fetches the real stream via native
 * networking, forwarding Range requests both ways so seeking still works normally. HLS playback
 * is unaffected — hls.js does its own fetching, which CapacitorHttp already covers.
 */
const ANDROID_VIDEO_RELAY_PORT = 8098;

export interface QualityLevel {
  /** hls.js level index; -1 is reserved for "Auto" (ABR). */
  index: number;
  label: string;
  height: number;
}

export interface AspectRatioOption {
  id: string;
  label: string;
  /** CSS `aspect-ratio` value for the video element, e.g. "16 / 9"; null keeps the source's own intrinsic ratio. */
  ratio: string | null;
  fit: 'contain' | 'cover' | 'fill';
}

/**
 * Standard player aspect-ratio presets. "Auto" and "Fill Screen" don't force a shape — they just change
 * how the video maps onto the existing 16:9 player frame (contain vs. crop-to-fill). The named ratios
 * (matching VLC's own aspect-ratio menu: 16:9, 4:3, 21:9 cinematic/anamorphic, 1:1, 9:16) reshape the
 * visible video area to that ratio, centered within the frame, and crop to fill it.
 */
export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { id: 'auto', label: 'Auto (Original)', ratio: null, fit: 'contain' },
  { id: 'fill', label: 'Fill Screen (Crop)', ratio: null, fit: 'cover' },
  { id: 'stretch', label: 'Stretch', ratio: null, fit: 'fill' },
  { id: '16:9', label: '16:9 Widescreen', ratio: '16 / 9', fit: 'cover' },
  { id: '4:3', label: '4:3 Standard', ratio: '4 / 3', fit: 'cover' },
  { id: '21:9', label: '21:9 Cinematic', ratio: '21 / 9', fit: 'cover' },
  { id: '1:1', label: '1:1 Square', ratio: '1 / 1', fit: 'cover' },
  { id: '9:16', label: '9:16 Vertical', ratio: '9 / 16', fit: 'cover' },
];

/** Standard playback-speed presets, same set most players (Stremio included) offer. */
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export interface SubtitleTrack {
  id: string;
  label: string;
}

export interface PlaybackStats {
  resolution: string;
  bitrate: string;
  droppedFrames: string;
  bufferAhead: string;
  rate: string;
}

@Component({
  selector: 'app-video-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClockTimePipe, MatTooltipModule],
  templateUrl: './video-player.html',
  styleUrl: './video-player.css',
})
export class VideoPlayer implements OnDestroy {
  readonly source = input<PlaybackSource | null>(null);
  readonly isLive = input(false);
  readonly title = input<string | null>(null);
  /** Secondary line under the title — e.g. "Season 2 · Episode 4" for a series episode. */
  readonly subtitle = input<string | null>(null);
  readonly startPositionSecs = input<number | undefined>(undefined);
  readonly autoplay = input(true);
  /** Shows a ✕ button that closes the player without navigating away. */
  readonly closable = input(false);
  /** Shows a "next episode" button in the controls. */
  readonly hasNext = input(false);
  /** Shows a button that asks the host page to render its own episode-switcher panel. */
  readonly showEpisodesButton = input(false);

  readonly timeUpdate = output<{ positionSecs: number; durationSecs: number }>();
  readonly ended = output<void>();
  readonly playbackError = output<AppError>();
  readonly closed = output<void>();
  readonly nextEpisode = output<void>();
  readonly episodesToggle = output<void>();

  protected readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  protected readonly containerRef = viewChild.required<ElementRef<HTMLDivElement>>('container');

  protected readonly playing = signal(false);
  protected readonly muted = signal(false);
  /** 0–2: 0–1 is native volume, 1–2 is a Web Audio gain boost layered on top of max native volume. */
  protected readonly volume = signal(1);
  protected readonly buffering = signal(false);
  protected readonly currentTime = signal(0);
  protected readonly duration = signal(0);
  protected readonly fullscreen = signal(false);
  protected readonly pipActive = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly showControls = signal(true);
  protected readonly pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document;
  protected readonly seekStep = SEEK_STEP_SECONDS;
  protected readonly seekPercent = computed(() => (this.duration() ? (this.currentTime() / this.duration()) * 100 : 0));

  protected readonly bufferedEndSecs = signal(0);
  protected readonly bufferedPercent = computed(() => (this.duration() ? (this.bufferedEndSecs() / this.duration()) * 100 : 0));

  protected readonly showRemainingTime = signal(false);

  protected readonly qualityLevels = signal<QualityLevel[]>([]);
  protected readonly currentLevelIndex = signal(-1);
  protected readonly showQualityMenu = signal(false);

  protected readonly aspectRatioOptions = ASPECT_RATIO_OPTIONS;
  protected readonly showAspectMenu = signal(false);

  protected readonly playbackRates = PLAYBACK_RATES;
  protected readonly showSpeedMenu = signal(false);

  protected readonly subtitleTracks = signal<SubtitleTrack[]>([]);
  protected readonly activeSubtitleId = signal<string | null>(null);
  protected readonly showSubtitleMenu = signal(false);

  protected readonly showStats = signal(false);

  /** Seconds left before the end; null hides the prompt. Dismissing it only hides the notice — playback still ends and advances normally. */
  protected readonly nextUpCountdown = signal<number | null>(null);
  private nextUpDismissed = false;

  private readonly storage = inject(StorageService);
  protected readonly selectedAspectRatio = signal<AspectRatioOption>(this.loadAspectRatioPreference());
  protected readonly playbackRate = signal<number>(this.loadPlaybackRatePreference());

  private hls: Hls | null = null;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private audioSourceNode: MediaElementAudioSourceNode | null = null;
  private nativeSubtitleTracks: TextTrack[] = [];
  private lastEmittedAt = 0;
  private controlsHideTimer: ReturnType<typeof setTimeout> | null = null;
  private viewReady = false;

  constructor() {
    afterNextRender(() => {
      this.viewReady = true;
      this.setupSource();
    });

    effect(() => {
      this.source();
      if (this.viewReady) {
        this.setupSource();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyHls();
    if (this.controlsHideTimer) clearTimeout(this.controlsHideTimer);
    this.audioContext?.close().catch(() => undefined);
  }

  private setupSource(): void {
    const video = this.videoRef().nativeElement;
    const source = this.source();
    this.destroyHls();
    this.error.set(null);
    this.currentTime.set(0);
    this.duration.set(0);
    this.bufferedEndSecs.set(0);
    this.qualityLevels.set([]);
    this.currentLevelIndex.set(-1);
    this.showQualityMenu.set(false);
    this.subtitleTracks.set([]);
    this.activeSubtitleId.set(null);
    this.nativeSubtitleTracks = [];
    this.nextUpCountdown.set(null);
    this.nextUpDismissed = false;

    // Required up front (not retroactively) for a Web Audio gain graph to be able to read this
    // element's audio later without tainting — see ensureAudioGraph(). The provider must send
    // permissive CORS on the actual media response for this to work; harmless otherwise.
    video.crossOrigin = 'anonymous';

    if (!source) {
      video.removeAttribute('src');
      return;
    }

    if (source.kind === 'hls') {
      // hls.js (MSE-based) is preferred wherever it's supported. Native <video> HLS is only
      // reliable on Safari/iOS. Some Chromium builds report canPlayType('application/vnd.apple.mpegurl')
      // as "maybe" without actually being able to demux HLS — verified live: playback silently fails
      // (MEDIA_ERR_SRC_NOT_SUPPORTED) if canPlayType is trusted first. hls.js must take priority.
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        this.hls = hls;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            this.error.set({
              message: 'This live stream could not be loaded. It may be temporarily offline.',
              code: 'server_error',
            });
            this.playbackError.emit(this.error()!);
          }
        });
        // Only a master playlist with multiple variant streams yields more than one level —
        // most Xtream VOD/movie sources are a single rendition, so the quality menu naturally
        // stays hidden for those (see qualityLevels().length > 1 in the template).
        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          this.qualityLevels.set(
            data.levels
              .map((level, index) => ({ index, height: level.height, label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps` }))
              .sort((a, b) => b.height - a.height),
          );
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          if (hls.autoLevelEnabled) this.currentLevelIndex.set(-1);
          else this.currentLevelIndex.set(data.level);
        });
        // Only populated when the manifest itself advertises alternate subtitle renditions —
        // most Xtream live channels are single-program streams with none at all, so this menu
        // naturally stays hidden for those (see subtitleTracks().length > 0 in the template).
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
          this.subtitleTracks.set(data.subtitleTracks.map((t, i) => ({ id: String(i), label: t.name || t.lang || `Track ${i + 1}` })));
        });
        hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_event, data) => {
          this.activeSubtitleId.set(data.id >= 0 ? String(data.id) : null);
        });
        hls.loadSource(source.url);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = source.url;
      } else {
        this.error.set({ message: 'HLS playback is not supported in this browser.', code: 'not_supported' });
        return;
      }
    } else {
      video.src = this.directVideoSrc(source.url);
      // Embedded WebVTT tracks in an MP4/MKV surface here — most rips from this provider use
      // hardsubs (baked into the video image) rather than a selectable track, so this is
      // usually empty; it lights up honestly whenever a file actually has one.
      const onTrackListChange = () => {
        this.nativeSubtitleTracks = Array.from(video.textTracks);
        this.subtitleTracks.set(this.nativeSubtitleTracks.map((t, i) => ({ id: String(i), label: t.label || t.language || `Track ${i + 1}` })));
      };
      video.textTracks.onaddtrack = onTrackListChange;
      video.textTracks.onremovetrack = onTrackListChange;
    }

    video.playbackRate = this.playbackRate();

    const resumeAt = this.startPositionSecs();
    if (resumeAt) {
      const onLoaded = () => {
        video.currentTime = resumeAt;
        video.removeEventListener('loadedmetadata', onLoaded);
      };
      video.addEventListener('loadedmetadata', onLoaded);
    }

    if (this.autoplay()) {
      video.play().catch(() => {
        // Autoplay can be blocked by the browser — the user presses play manually.
      });
    }
  }

  /** See ANDROID_VIDEO_RELAY_PORT above — routes direct (non-HLS) sources through the local
   *  relay only on Android native, where a <video src> load can still hit mixed-content
   *  blocking despite allowMixedContent. Untouched everywhere else (web, iOS, HLS playback). */
  private directVideoSrc(url: string): string {
    if (Capacitor.getPlatform() === 'android') {
      return `http://127.0.0.1:${ANDROID_VIDEO_RELAY_PORT}/relay?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  private destroyHls(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }

  protected onLoadedMetadata(): void {
    this.duration.set(this.videoRef().nativeElement.duration || 0);
  }

  protected onTimeUpdate(): void {
    const video = this.videoRef().nativeElement;
    this.currentTime.set(video.currentTime);
    if (!this.duration() && video.duration) this.duration.set(video.duration);

    if (!this.isLive() && this.hasNext() && !this.nextUpDismissed && video.duration) {
      const remaining = video.duration - video.currentTime;
      this.nextUpCountdown.set(remaining > 0 && remaining <= NEXT_UP_THRESHOLD_SECS ? Math.ceil(remaining) : null);
    }

    const now = Date.now();
    if (now - this.lastEmittedAt > TIME_UPDATE_EMIT_INTERVAL_MS && video.duration) {
      this.lastEmittedAt = now;
      this.timeUpdate.emit({ positionSecs: video.currentTime, durationSecs: video.duration });
    }
  }

  protected onProgress(): void {
    const video = this.videoRef().nativeElement;
    const buffered = video.buffered;
    if (buffered.length === 0) {
      this.bufferedEndSecs.set(0);
      return;
    }
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= video.currentTime && video.currentTime <= buffered.end(i)) {
        this.bufferedEndSecs.set(buffered.end(i));
        return;
      }
    }
    this.bufferedEndSecs.set(buffered.end(buffered.length - 1));
  }

  protected onPlay(): void {
    this.playing.set(true);
  }
  protected onPause(): void {
    this.playing.set(false);
  }
  protected onWaiting(): void {
    this.buffering.set(true);
  }
  protected onPlaying(): void {
    this.buffering.set(false);
  }
  protected onEnded(): void {
    this.playing.set(false);
    this.ended.emit();
  }

  protected onNativeError(): void {
    const video = this.videoRef().nativeElement;
    const code = video.error?.code;
    const isFormatIssue = code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || code === MediaError.MEDIA_ERR_DECODE;
    const appError: AppError = isFormatIssue
      ? {
          message: `Your browser can't play this file (${this.source()?.extension.toUpperCase() ?? 'this format'}). Try opening it in an external player.`,
          code: 'not_supported',
        }
      : { message: 'Playback failed. The stream may be temporarily unavailable.', code: 'server_error' };
    this.error.set(appError);
    this.playbackError.emit(appError);
  }

  protected togglePlay(): void {
    const video = this.videoRef().nativeElement;
    if (video.paused) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }

  protected toggleMute(): void {
    const video = this.videoRef().nativeElement;
    video.muted = !video.muted;
    this.muted.set(video.muted);
  }

  protected onVolumeInput(event: Event): void {
    this.onVolumeChange((event.target as HTMLInputElement).valueAsNumber);
  }

  /** 0–1 drives native volume directly; 1–2 keeps native volume maxed and layers a Web Audio gain boost on top. */
  private onVolumeChange(value: number): void {
    const video = this.videoRef().nativeElement;
    const clamped = Math.max(0, Math.min(2, value));
    if (clamped <= 1) {
      video.volume = clamped;
      video.muted = clamped === 0;
      if (this.gainNode) this.gainNode.gain.value = 1;
    } else {
      video.volume = 1;
      video.muted = false;
      if (this.ensureAudioGraph() && this.gainNode) {
        this.gainNode.gain.value = clamped;
      }
    }
    this.volume.set(clamped);
    this.muted.set(video.muted);
  }

  /** Lazily builds a MediaElementSource → Gain → destination graph the first time boost is used. */
  private ensureAudioGraph(): boolean {
    if (this.gainNode) return true;
    try {
      const video = this.videoRef().nativeElement;
      const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextCtor();
      this.audioSourceNode = this.audioContext.createMediaElementSource(video);
      this.gainNode = this.audioContext.createGain();
      this.audioSourceNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      return true;
    } catch {
      // Boost silently unavailable (e.g. no Web Audio support) — volume simply caps at 100%.
      return false;
    }
  }

  protected onSeek(event: Event): void {
    this.videoRef().nativeElement.currentTime = (event.target as HTMLInputElement).valueAsNumber;
  }

  protected seekBy(deltaSeconds: number): void {
    const video = this.videoRef().nativeElement;
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + deltaSeconds));
  }

  protected toggleTimeDisplay(): void {
    this.showRemainingTime.update((v) => !v);
  }

  protected async toggleFullscreen(): Promise<void> {
    const container = this.containerRef().nativeElement;
    if (!document.fullscreenElement) {
      await container.requestFullscreen().catch(() => undefined);
      this.fullscreen.set(true);
    } else {
      await document.exitFullscreen().catch(() => undefined);
      this.fullscreen.set(false);
    }
  }

  protected toggleQualityMenu(): void {
    this.showQualityMenu.update((v) => !v);
  }

  protected toggleAspectMenu(): void {
    this.showAspectMenu.update((v) => !v);
  }

  protected setAspectRatio(option: AspectRatioOption): void {
    this.selectedAspectRatio.set(option);
    this.showAspectMenu.set(false);
    this.storage.set(ASPECT_RATIO_STORAGE_KEY, option.id);
  }

  private loadAspectRatioPreference(): AspectRatioOption {
    const savedId = this.storage.get<string>(ASPECT_RATIO_STORAGE_KEY);
    return ASPECT_RATIO_OPTIONS.find((o) => o.id === savedId) ?? ASPECT_RATIO_OPTIONS[0];
  }

  protected toggleSpeedMenu(): void {
    this.showSpeedMenu.update((v) => !v);
  }

  protected setPlaybackRate(rate: number): void {
    this.videoRef().nativeElement.playbackRate = rate;
    this.playbackRate.set(rate);
    this.showSpeedMenu.set(false);
    this.storage.set(PLAYBACK_RATE_STORAGE_KEY, rate);
  }

  private loadPlaybackRatePreference(): number {
    const saved = this.storage.get<number>(PLAYBACK_RATE_STORAGE_KEY);
    return saved && PLAYBACK_RATES.includes(saved) ? saved : 1;
  }

  protected toggleSubtitleMenu(): void {
    this.showSubtitleMenu.update((v) => !v);
  }

  protected setSubtitleTrack(id: string | null): void {
    if (this.hls) {
      this.hls.subtitleTrack = id === null ? -1 : Number(id);
    } else {
      this.nativeSubtitleTracks.forEach((track, i) => {
        track.mode = id !== null && String(i) === id ? 'showing' : 'disabled';
      });
      this.activeSubtitleId.set(id);
    }
    this.showSubtitleMenu.set(false);
  }

  protected currentSubtitleLabel(): string {
    if (this.activeSubtitleId() === null) return 'Off';
    return this.subtitleTracks().find((t) => t.id === this.activeSubtitleId())?.label ?? 'Off';
  }

  protected setQuality(index: number): void {
    if (this.hls) {
      this.hls.currentLevel = index;
    }
    this.currentLevelIndex.set(index);
    this.showQualityMenu.set(false);
  }

  protected currentQualityLabel(): string {
    if (this.currentLevelIndex() === -1) return 'Auto';
    return this.qualityLevels().find((l) => l.index === this.currentLevelIndex())?.label ?? 'Auto';
  }

  protected toggleStats(): void {
    this.showStats.update((v) => !v);
  }

  /** Recomputed on every call (template re-evaluates it on each change-detection pass, which
   *  timeupdate already drives ~4x/sec) so the stats panel reads live, like a real player's would. */
  protected playbackStats(): PlaybackStats {
    const video = this.videoRef().nativeElement;
    const quality = video.getVideoPlaybackQuality?.();
    const level = this.hls && this.currentLevelIndex() >= 0 ? this.hls.levels[this.currentLevelIndex()] : null;
    return {
      resolution: video.videoWidth ? `${video.videoWidth}×${video.videoHeight}` : '—',
      bitrate: level?.bitrate ? `${Math.round(level.bitrate / 1000)} kbps` : '—',
      droppedFrames: quality ? `${quality.droppedVideoFrames} / ${quality.totalVideoFrames}` : '—',
      bufferAhead: `${Math.max(0, this.bufferedEndSecs() - this.currentTime()).toFixed(1)}s`,
      rate: `${this.playbackRate()}×`,
    };
  }

  protected dismissNextUp(): void {
    this.nextUpDismissed = true;
    this.nextUpCountdown.set(null);
  }

  protected playNextNow(): void {
    this.nextUpCountdown.set(null);
    this.nextEpisode.emit();
  }

  protected async togglePip(): Promise<void> {
    const video = this.videoRef().nativeElement;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        this.pipActive.set(false);
      } else {
        await video.requestPictureInPicture();
        this.pipActive.set(true);
      }
    } catch {
      // PiP unsupported for this media element — silently ignore.
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case ' ':
      case 'k':
        event.preventDefault();
        this.togglePlay();
        break;
      case 'ArrowRight':
        this.seekBy(10);
        break;
      case 'ArrowLeft':
        this.seekBy(-10);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.onVolumeChange(Math.min(2, this.volume() + 0.1));
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.onVolumeChange(Math.max(0, this.volume() - 0.1));
        break;
      case 'm':
        this.toggleMute();
        break;
      case 'f':
        void this.toggleFullscreen();
        break;
      case 'n':
      case 'N':
        if (event.shiftKey && this.hasNext()) {
          event.preventDefault();
          this.playNextNow();
        }
        break;
    }
  }

  protected wakeControls(): void {
    this.showControls.set(true);
    if (this.controlsHideTimer) clearTimeout(this.controlsHideTimer);
    this.controlsHideTimer = setTimeout(() => {
      if (this.playing()) this.showControls.set(false);
    }, 3000);
  }

  protected async copyStreamUrl(): Promise<void> {
    const url = this.source()?.url;
    if (url) {
      await navigator.clipboard.writeText(url).catch(() => undefined);
    }
  }
}
