import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AppError, initialLoadState } from '../../core/models/common.models';
import { SeriesListItem } from '../../core/models/series.models';
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

const PAGE_SIZE = 60;

@Component({
  selector: 'app-series-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CategoryTabs, EmptyState, ErrorState, PosterCard, SearchBar, SkeletonLoader, VisibleOnScrollDirective],
  templateUrl: './series-page.html',
})
export class SeriesPage {
  private readonly api = inject(IptvApiService);
  private readonly favorites = inject(FavoritesService);
  private readonly router = inject(Router);

  protected readonly categories = toSignal(this.api.getSeriesCategories().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly selectedCategoryId = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly visibleCount = signal(PAGE_SIZE);

  private readonly state = signal(initialLoadState<SeriesListItem[]>());
  protected readonly loading = computed(() => this.state().loading);
  protected readonly error = computed(() => this.state().error);

  protected readonly filtered = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const items = this.state().data ?? [];
    return query ? items.filter((s) => s.name.toLowerCase().includes(query)) : items;
  });

  protected readonly visibleItems = computed(() => this.filtered().slice(0, this.visibleCount()));
  protected readonly hasMore = computed(() => this.visibleCount() < this.filtered().length);

  constructor() {
    this.load(null);
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

  protected loadMore(): void {
    this.visibleCount.update((c) => c + PAGE_SIZE);
  }

  protected retry(): void {
    this.load(this.selectedCategoryId());
  }

  protected isFavorite(series: SeriesListItem): boolean {
    return this.favorites.isFavorite('series', series.series_id);
  }

  protected toggleFavorite(series: SeriesListItem): void {
    this.favorites.toggle({ kind: 'series', id: series.series_id, name: series.name, image: series.cover ?? null, categoryId: series.category_id });
  }

  protected open(series: SeriesListItem): void {
    void this.router.navigate(['/series', series.series_id]);
  }

  private load(categoryId: string | null): void {
    this.state.set({ loading: true, error: null, data: this.state().data });
    this.api
      .getSeries(categoryId ?? undefined)
      .pipe(catchError((e: unknown) => of({ __error: mapGenericApiError(e) })))
      .subscribe((result) => {
        if (Array.isArray(result)) {
          this.state.set({ loading: false, error: null, data: result });
        } else {
          this.state.set({ loading: false, error: (result as { __error: AppError }).__error, data: null });
        }
      });
  }
}
