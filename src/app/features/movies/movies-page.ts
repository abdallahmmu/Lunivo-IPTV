import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AppError, initialLoadState } from '../../core/models/common.models';
import { VodStream } from '../../core/models/vod.models';
import { FavoritesService } from '../../core/services/favorites.service';
import { IptvApiService } from '../../core/services/iptv-api.service';
import { mapGenericApiError } from '../../core/utils/xtream-error.util';
import { CategoryTabs } from '../../shared/components/category-tabs/category-tabs';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../shared/components/error-state/error-state';
import { PosterCard } from '../../shared/components/poster-card/poster-card';
import { SearchBar } from '../../shared/components/search-bar/search-bar';
import { SkeletonLoader } from '../../shared/components/skeleton-loader/skeleton-loader';
import { VisibleOnScrollDirective } from '../../shared/directives/visible-on-scroll.directive';

type SortKey = 'name' | 'rating' | 'added';
const PAGE_SIZE = 60;

@Component({
  selector: 'app-movies-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CategoryTabs, EmptyState, ErrorState, PosterCard, SearchBar, SkeletonLoader, VisibleOnScrollDirective],
  templateUrl: './movies-page.html',
})
export class MoviesPage {
  private readonly api = inject(IptvApiService);
  private readonly favorites = inject(FavoritesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly categories = toSignal(this.api.getVodCategories().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly selectedCategoryId = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly sortKey = signal<SortKey>('added');
  protected readonly visibleCount = signal(PAGE_SIZE);
  protected readonly sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: 'added', label: 'Newest' },
    { key: 'name', label: 'A–Z' },
    { key: 'rating', label: 'Top rated' },
  ];

  private readonly streamsState = signal(initialLoadState<VodStream[]>());
  protected readonly loading = computed(() => this.streamsState().loading);
  protected readonly error = computed(() => this.streamsState().error);

  protected readonly filteredSorted = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const streams = this.streamsState().data ?? [];
    const filtered = query ? streams.filter((s) => s.name.toLowerCase().includes(query)) : streams;
    return [...filtered].sort(sorters[this.sortKey()]);
  });

  protected readonly visibleItems = computed(() => this.filteredSorted().slice(0, this.visibleCount()));
  protected readonly hasMore = computed(() => this.visibleCount() < this.filteredSorted().length);

  constructor() {
    const categoryId = this.route.snapshot.queryParamMap.get('category');
    this.selectedCategoryId.set(categoryId);
    this.load(categoryId);
  }

  protected selectCategory(categoryId: string | null): void {
    this.selectedCategoryId.set(categoryId);
    this.visibleCount.set(PAGE_SIZE);
    this.load(categoryId);
  }

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
    this.visibleCount.set(PAGE_SIZE);
  }

  protected onSort(key: SortKey): void {
    this.sortKey.set(key);
    this.visibleCount.set(PAGE_SIZE);
  }

  protected loadMore(): void {
    this.visibleCount.update((c) => c + PAGE_SIZE);
  }

  protected retry(): void {
    this.load(this.selectedCategoryId());
  }

  protected isFavorite(movie: VodStream): boolean {
    return this.favorites.isFavorite('movie', movie.stream_id);
  }

  protected toggleFavorite(movie: VodStream): void {
    this.favorites.toggle({ kind: 'movie', id: movie.stream_id, name: movie.name, image: movie.stream_icon ?? null, categoryId: movie.category_id });
  }

  protected open(movie: VodStream): void {
    void this.router.navigate(['/movies', movie.stream_id]);
  }

  private load(categoryId: string | null): void {
    this.streamsState.set({ loading: true, error: null, data: this.streamsState().data });
    this.api
      .getVodStreams(categoryId ?? undefined)
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

const sorters: Record<SortKey, (a: VodStream, b: VodStream) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  rating: (a, b) => (b.rating_5based ?? 0) - (a.rating_5based ?? 0),
  added: (a, b) => Number(b.added ?? 0) - Number(a.added ?? 0),
};
