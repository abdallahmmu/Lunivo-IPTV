import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { LoadState, initialLoadState } from '../../core/models/common.models';
import { SeriesEpisode, SeriesInfo } from '../../core/models/series.models';
import { FavoritesService } from '../../core/services/favorites.service';
import { HistoryService } from '../../core/services/history.service';
import { IptvApiService } from '../../core/services/iptv-api.service';
import { PlaybackSource, StreamService } from '../../core/services/stream.service';
import { mapGenericApiError } from '../../core/utils/xtream-error.util';
import { ErrorState } from '../../shared/components/error-state/error-state';
import { SkeletonLoader } from '../../shared/components/skeleton-loader/skeleton-loader';
import { VideoPlayer } from '../../shared/components/video-player/video-player';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { qualityLabelFor } from '../../shared/utils/quality-label.util';

@Component({
  selector: 'app-series-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorState, SkeletonLoader, VideoPlayer, RatingPipe],
  templateUrl: './series-detail-page.html',
})
export class SeriesDetailPage {
  private readonly api = inject(IptvApiService);
  private readonly streamService = inject(StreamService);
  private readonly favorites = inject(FavoritesService);
  private readonly history = inject(HistoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  private readonly id$ = toObservable(this.id);

  protected readonly state = toSignal(
    this.id$.pipe(
      switchMap((id) =>
        this.api.getSeriesInfo(Number(id)).pipe(
          switchMap((info) => of({ loading: false, error: null, data: info })),
          catchError((e: unknown) => of<LoadState<SeriesInfo>>({ loading: false, error: mapGenericApiError(e), data: null })),
        ),
      ),
    ),
    { initialValue: { ...initialLoadState<SeriesInfo>(), loading: true } },
  );

  protected readonly seriesId = computed(() => Number(this.id()));
  protected readonly isFavorite = computed(() => this.favorites.isFavorite('series', this.seriesId()));

  protected readonly seasons = computed(() => [...(this.state().data?.seasons ?? [])].sort((a, b) => a.season_number - b.season_number));
  protected readonly expandedSeason = signal<number | null>(null);
  protected readonly selectedEpisode = signal<SeriesEpisode | null>(null);
  protected readonly selectedSeasonNumber = signal<number | null>(null);
  protected readonly playing = signal(false);
  protected readonly episodesPanelOpen = signal(false);

  protected readonly episodeSubtitle = computed(() => {
    const episode = this.selectedEpisode();
    const seasonNumber = this.selectedSeasonNumber();
    return episode && seasonNumber !== null ? `Season ${seasonNumber} · Episode ${episode.episode_num}` : null;
  });

  protected readonly hasNextEpisode = computed(() => {
    const seasonNumber = this.selectedSeasonNumber();
    const episode = this.selectedEpisode();
    if (seasonNumber === null || !episode) return false;
    const inSeason = this.episodesFor(seasonNumber);
    const index = inSeason.findIndex((e) => e.id === episode.id);
    if (index !== -1 && index < inSeason.length - 1) return true;
    const nextSeason = this.seasons().find((s) => s.season_number > seasonNumber);
    return !!nextSeason && this.episodesFor(nextSeason.season_number).length > 0;
  });

  protected readonly playbackSource = computed<PlaybackSource | null>(() => {
    const episode = this.selectedEpisode();
    return episode ? this.streamService.seriesEpisodeUrl(episode.id, episode.container_extension) : null;
  });

  protected readonly resumePosition = computed(() => {
    const episode = this.selectedEpisode();
    return episode ? (this.history.positionFor('series', this.seriesId(), episode.id) ?? undefined) : undefined;
  });

  private appliedDeepLink = false;

  constructor() {
    effect(() => {
      const info = this.state().data;
      if (!info || this.appliedDeepLink) return;
      this.appliedDeepLink = true;

      const requestedEpisodeId = this.route.snapshot.queryParamMap.get('episode');
      const shouldResume = this.route.snapshot.queryParamMap.get('resume') === '1';

      if (requestedEpisodeId) {
        for (const [seasonKey, episodes] of Object.entries(info.episodes)) {
          const match = episodes.find((e) => e.id === requestedEpisodeId);
          if (match) {
            this.expandedSeason.set(Number(seasonKey));
            this.selectedSeasonNumber.set(Number(seasonKey));
            this.selectedEpisode.set(match);
            this.playing.set(shouldResume);
            return;
          }
        }
      }
      this.expandedSeason.set(this.seasons()[0]?.season_number ?? null);
    });
  }

  protected episodesFor(seasonNumber: number): SeriesEpisode[] {
    return [...(this.state().data?.episodes[String(seasonNumber)] ?? [])].sort((a, b) => a.episode_num - b.episode_num);
  }

  protected episodeQuality(episode: SeriesEpisode): string | null {
    return qualityLabelFor(episode.info?.video?.height);
  }

  protected toggleSeason(seasonNumber: number): void {
    this.expandedSeason.set(this.expandedSeason() === seasonNumber ? null : seasonNumber);
  }

  protected selectEpisode(episode: SeriesEpisode, seasonNumber: number): void {
    this.selectedEpisode.set(episode);
    this.selectedSeasonNumber.set(seasonNumber);
    this.playing.set(true);
    this.episodesPanelOpen.set(false);
    this.recordHistory(episode, seasonNumber, 0, episode.info?.duration_secs);
  }

  protected closePlayer(): void {
    this.playing.set(false);
    this.episodesPanelOpen.set(false);
  }

  protected toggleEpisodesPanel(): void {
    this.episodesPanelOpen.update((v) => !v);
  }

  protected onTimeUpdate(event: { positionSecs: number; durationSecs: number }): void {
    const episode = this.selectedEpisode();
    const seasonNumber = this.selectedSeasonNumber();
    if (!episode || seasonNumber === null) return;
    this.recordHistory(episode, seasonNumber, event.positionSecs, event.durationSecs);
  }

  protected onEnded(): void {
    const seasonNumber = this.selectedSeasonNumber();
    const episode = this.selectedEpisode();
    if (seasonNumber === null || !episode) return;

    const inSeason = this.episodesFor(seasonNumber);
    const index = inSeason.findIndex((e) => e.id === episode.id);
    const next = inSeason[index + 1];
    if (next) {
      this.selectEpisode(next, seasonNumber);
      return;
    }
    const nextSeason = this.seasons().find((s) => s.season_number > seasonNumber);
    const firstOfNext = nextSeason ? this.episodesFor(nextSeason.season_number)[0] : undefined;
    if (nextSeason && firstOfNext) {
      this.expandedSeason.set(nextSeason.season_number);
      this.selectEpisode(firstOfNext, nextSeason.season_number);
    }
  }

  protected toggleFavorite(): void {
    const info = this.state().data;
    if (!info) return;
    const seriesInfo = 'name' in info.info ? info.info : null;
    this.favorites.toggle({
      kind: 'series',
      id: this.seriesId(),
      name: seriesInfo?.name ?? `Series ${this.seriesId()}`,
      image: seriesInfo?.cover ?? null,
      categoryId: seriesInfo?.category_id ?? '',
    });
  }

  protected goBack(): void {
    void this.router.navigate(['/series']);
  }

  private recordHistory(episode: SeriesEpisode, seasonNumber: number, positionSecs: number, durationSecs: number | undefined): void {
    const info = this.state().data;
    const seriesInfo = info && 'name' in info.info ? info.info : null;
    this.history.record(
      {
        kind: 'series',
        id: this.seriesId(),
        episodeId: episode.id,
        name: episode.title,
        image: episode.info?.movie_image ?? seriesInfo?.cover ?? null,
        categoryId: seriesInfo?.category_id ?? '',
        seriesName: seriesInfo?.name,
        seasonNumber,
        episodeNumber: episode.episode_num,
      },
      { positionSecs, durationSecs },
    );
  }
}
