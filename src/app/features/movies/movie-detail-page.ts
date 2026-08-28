import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { LoadState, initialLoadState } from '../../core/models/common.models';
import { VodInfo } from '../../core/models/vod.models';
import { FavoritesService } from '../../core/services/favorites.service';
import { HistoryService } from '../../core/services/history.service';
import { IptvApiService } from '../../core/services/iptv-api.service';
import { PlaybackSource, StreamService } from '../../core/services/stream.service';
import { mapGenericApiError } from '../../core/utils/xtream-error.util';
import { ErrorState } from '../../shared/components/error-state/error-state';
import { SkeletonLoader } from '../../shared/components/skeleton-loader/skeleton-loader';
import { VideoPlayer } from '../../shared/components/video-player/video-player';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { qualityLabelFor } from '../../shared/utils/quality-label.util';

@Component({
  selector: 'app-movie-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorState, SkeletonLoader, VideoPlayer, DurationPipe, RatingPipe],
  templateUrl: './movie-detail-page.html',
})
export class MovieDetailPage {
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
        this.api.getVodInfo(Number(id)).pipe(
          switchMap((info) => of({ loading: false, error: null, data: info })),
          catchError((e: unknown) => of<LoadState<VodInfo>>({ loading: false, error: mapGenericApiError(e), data: null })),
        ),
      ),
    ),
    { initialValue: { ...initialLoadState<VodInfo>(), loading: true } },
  );

  protected readonly playing = signal(false);
  protected readonly movieId = computed(() => Number(this.id()));
  protected readonly isFavorite = computed(() => this.favorites.isFavorite('movie', this.movieId()));

  protected readonly playbackSource = computed<PlaybackSource | null>(() => {
    const info = this.state().data;
    if (!info) return null;
    return this.streamService.vodStreamUrl(info.movie_data.stream_id, info.movie_data.container_extension);
  });

  protected readonly resumePosition = computed(() => this.history.positionFor('movie', this.movieId()) ?? undefined);
  protected readonly qualityLabel = computed(() => qualityLabelFor(this.state().data?.info.video?.height));

  constructor() {
    if (this.route.snapshot.queryParamMap.get('resume') === '1') {
      this.playing.set(true);
    }
  }

  protected play(): void {
    this.playing.set(true);
  }

  protected closePlayer(): void {
    this.playing.set(false);
  }

  protected toggleFavorite(): void {
    const info = this.state().data;
    if (!info) return;
    this.favorites.toggle({
      kind: 'movie',
      id: info.movie_data.stream_id,
      name: info.info.name ?? info.movie_data.name,
      image: info.info.movie_image ?? null,
      categoryId: info.movie_data.category_id,
    });
  }

  protected onTimeUpdate(event: { positionSecs: number; durationSecs: number }): void {
    const info = this.state().data;
    if (!info) return;
    this.history.record(
      {
        kind: 'movie',
        id: info.movie_data.stream_id,
        name: info.info.name ?? info.movie_data.name,
        image: info.info.movie_image ?? null,
        categoryId: info.movie_data.category_id,
      },
      event,
    );
  }

  protected goBack(): void {
    void this.router.navigate(['/movies']);
  }
}
