import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import Hls from 'hls.js';
import { AppError } from '../../../core/models/common.models';
import { PlaybackSource } from '../../../core/services/stream.service';
import { ClockTimePipe } from '../../pipes/clock-time.pipe';

const TIME_UPDATE_EMIT_INTERVAL_MS = 5000;
/** Seconds moved per rewind/forward tap — surfaced in the UI so the label always matches the actual behavior. */
export const SEEK_STEP_SECONDS = 10;

export interface QualityLevel {
  /** hls.js level index; -1 is reserved for "Auto" (ABR). */
  index: number;
  label: string;
  height: number;
}

@Component({
  selector: 'app-video-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClockTimePipe],
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

  protected readonly qualityLevels = signal<QualityLevel[]>([]);
  protected readonly currentLevelIndex = signal(-1);
  protected readonly showQualityMenu = signal(false);

  private hls: Hls | null = null;
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
  }

  private setupSource(): void {
    const video = this.videoRef().nativeElement;
    const source = this.source();
    this.destroyHls();
    this.error.set(null);
    this.currentTime.set(0);
    this.duration.set(0);
    this.qualityLevels.set([]);
    this.currentLevelIndex.set(-1);
    this.showQualityMenu.set(false);

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
        hls.loadSource(source.url);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = source.url;
      } else {
        this.error.set({ message: 'HLS playback is not supported in this browser.', code: 'not_supported' });
        return;
      }
    } else {
      video.src = source.url;
    }

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

    const now = Date.now();
    if (now - this.lastEmittedAt > TIME_UPDATE_EMIT_INTERVAL_MS && video.duration) {
      this.lastEmittedAt = now;
      this.timeUpdate.emit({ positionSecs: video.currentTime, durationSecs: video.duration });
    }
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

  private onVolumeChange(value: number): void {
    const video = this.videoRef().nativeElement;
    video.volume = value;
    video.muted = value === 0;
    this.volume.set(value);
    this.muted.set(video.muted);
  }

  protected onSeek(event: Event): void {
    this.videoRef().nativeElement.currentTime = (event.target as HTMLInputElement).valueAsNumber;
  }

  protected seekBy(deltaSeconds: number): void {
    const video = this.videoRef().nativeElement;
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + deltaSeconds));
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
        this.onVolumeChange(Math.min(1, this.volume() + 0.1));
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
