import { ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, catchError, of } from 'rxjs';
import { AppError, initialLoadState } from '../../core/models/common.models';
import { LiveStream } from '../../core/models/live.models';
import { ContentRef } from '../../core/models/library.models';
import { EpgService, NowNext } from '../../core/services/epg.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { HistoryService } from '../../core/services/history.service';
import { IptvApiService } from '../../core/services/iptv-api.service';
import { PlaybackSource, StreamService } from '../../core/services/stream.service';
import { mapGenericApiError } from '../../core/utils/xtream-error.util';
import { CategoryTabs } from '../../shared/components/category-tabs/category-tabs';
import { ChannelListItem } from '../../shared/components/channel-list-item/channel-list-item';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../shared/components/error-state/error-state';
import { SearchBar } from '../../shared/components/search-bar/search-bar';
import { SkeletonLoader } from '../../shared/components/skeleton-loader/skeleton-loader';
import { VideoPlayer } from '../../shared/components/video-player/video-player';

@Component({
  selector: 'app-live-tv-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollingModule, DatePipe, CategoryTabs, ChannelListItem, EmptyState, ErrorState, SearchBar, SkeletonLoader, VideoPlayer],
  templateUrl: './live-tv-page.html',
})
export class LiveTvPage {
  private readonly api = inject(IptvApiService);
  private readonly stream = inject(StreamService);
  private readonly epg = inject(EpgService);
  private readonly favorites = inject(FavoritesService);
  private readonly history = inject(HistoryService);
  private readonly route = inject(ActivatedRoute);

  protected readonly categories = toSignal(
    this.api.getLiveCategories().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  protected readonly selectedCategoryId = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly selectedChannel = signal<LiveStream | null>(null);
  protected readonly nowNext = signal<NowNext | null>(null);

  private readonly streamsState = signal(initialLoadState<LiveStream[]>());
  protected readonly streamsLoading = computed(() => this.streamsState().loading);
  protected readonly streamsError = computed(() => this.streamsState().error);
  protected readonly streams = computed(() => this.streamsState().data ?? []);

  protected readonly filteredStreams = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const streams = this.streams();
    return query ? streams.filter((s) => s.name.toLowerCase().includes(query)) : streams;
  });

  protected readonly playbackSource = computed<PlaybackSource | null>(() => {
    const channel = this.selectedChannel();
    return channel ? this.stream.liveStreamUrl(channel.stream_id) : null;
  });

  constructor() {
    this.loadStreams(null);

    const requestedId = Number(this.route.snapshot.queryParamMap.get('channel'));
    if (requestedId) {
      this.api
        .getLiveStreams()
        .pipe(catchError(() => EMPTY))
        .subscribe((all) => {
          const match = all.find((s) => s.stream_id === requestedId);
          if (match) this.selectChannel(match);
        });
    }
  }

  protected selectCategory(categoryId: string | null): void {
    this.selectedCategoryId.set(categoryId);
    this.searchQuery.set('');
    this.loadStreams(categoryId);
  }

  protected selectChannel(channel: LiveStream): void {
    this.selectedChannel.set(channel);
    this.nowNext.set(null);
    this.history.record(this.refFor(channel));

    if (channel.epg_channel_id) {
      this.epg
        .getNowNext(channel.stream_id)
        .pipe(catchError(() => of(null)))
        .subscribe((result) => this.nowNext.set(result));
    }
  }

  protected isFavorite(channel: LiveStream): boolean {
    return this.favorites.isFavorite('live', channel.stream_id);
  }

  protected toggleFavorite(channel: LiveStream): void {
    this.favorites.toggle(this.refFor(channel));
  }

  protected retryStreams(): void {
    this.loadStreams(this.selectedCategoryId());
  }

  protected trackByStreamId(_index: number, channel: LiveStream): number {
    return channel.stream_id;
  }

  private refFor(channel: LiveStream): ContentRef {
    return { kind: 'live', id: channel.stream_id, name: channel.name, image: channel.stream_icon ?? null, categoryId: channel.category_id };
  }

  private loadStreams(categoryId: string | null): void {
    this.streamsState.set({ loading: true, error: null, data: this.streamsState().data });
    this.api
      .getLiveStreams(categoryId ?? undefined)
      .pipe(catchError((e: unknown) => of({ __error: mapGenericApiError(e) })))
      .subscribe((result) => {
        if (Array.isArray(result)) {
          this.streamsState.set({ loading: false, error: null, data: result });
        } else {
          this.streamsState.set({ loading: false, error: (result as { __error: AppError }).__error, data: null });
        }
      });
  }
}
