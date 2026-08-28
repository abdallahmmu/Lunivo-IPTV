import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { XtreamCategory } from '../../core/models/common.models';
import { ContentRef } from '../../core/models/library.models';
import { SeriesListItem } from '../../core/models/series.models';
import { VodStream } from '../../core/models/vod.models';
import { AuthService } from '../../core/services/auth.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { HistoryService } from '../../core/services/history.service';
import { IptvApiService } from '../../core/services/iptv-api.service';
import { CarouselItem, CarouselRow } from '../../shared/components/carousel-row/carousel-row';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { HeroBanner } from '../../shared/components/hero-banner/hero-banner';
import { PosterCard } from '../../shared/components/poster-card/poster-card';
import { VisibleOnScrollDirective } from '../../shared/directives/visible-on-scroll.directive';

/** How many category rows to feature on Home — kept small so we're not firing a dozen
 *  parallel catalog requests; each row still only actually loads once scrolled into view. */
const FEATURED_VOD_CATEGORY_COUNT = 6;
const FEATURED_SERIES_CATEGORY_COUNT = 3;
/** Items per row — a browsing preview, not the full catalog (Movies/Series pages already do that). */
const ITEMS_PER_ROW = 20;

interface HeroDetails {
  id: number;
  title: string;
  plot: string | null;
  backdrop: string | null;
}

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PosterCard, EmptyState, DatePipe, HeroBanner, CarouselRow, VisibleOnScrollDirective],
  templateUrl: './home-page.html',
})
export class HomePage {
  private readonly router = inject(Router);
  private readonly history = inject(HistoryService);
  private readonly favorites = inject(FavoritesService);
  private readonly api = inject(IptvApiService);
  protected readonly auth = inject(AuthService);

  protected readonly continueWatching = this.history.continueWatching;
  protected readonly recentlyWatched = this.history.recentlyWatched;
  protected readonly favoriteItems = this.favorites.all;

  protected readonly heroItem = signal<HeroDetails | null>(null);
  protected readonly vodCategories = signal<XtreamCategory[]>([]);
  protected readonly seriesCategories = signal<XtreamCategory[]>([]);

  /** Netflix-style "Movies" / "Series" overview rows — newest across all categories, shown before the per-category rows. */
  protected readonly topMovies = signal<CarouselItem[] | null>(null);
  protected readonly topSeries = signal<CarouselItem[] | null>(null);

  private readonly categoryItems = signal<Record<string, CarouselItem[] | null>>({});
  private readonly loadedCategoryIds = new Set<string>();

  constructor() {
    this.api
      .getVodCategories()
      .pipe(catchError(() => of([])))
      .subscribe((cats) => this.vodCategories.set(cats.slice(0, FEATURED_VOD_CATEGORY_COUNT)));

    this.api
      .getSeriesCategories()
      .pipe(catchError(() => of([])))
      .subscribe((cats) => this.seriesCategories.set(cats.slice(0, FEATURED_SERIES_CATEGORY_COUNT)));

    // Newest-first movie list drives both the "Movies" overview row and the hero spotlight
    // (the single most recent title, enriched with its full info for a real backdrop/plot).
    this.api
      .getVodStreams()
      .pipe(
        map((list) => [...list].sort((a, b) => Number(b.added ?? 0) - Number(a.added ?? 0))),
        catchError(() => of([] as VodStream[])),
      )
      .subscribe((sorted) => {
        this.topMovies.set(this.mapVodItems(sorted));
        const top = sorted[0];
        if (!top) {
          this.heroItem.set(null);
          return;
        }
        this.api
          .getVodInfo(top.stream_id)
          .pipe(
            map(
              (info): HeroDetails => ({
                id: top.stream_id,
                title: info.info.name ?? top.name,
                plot: info.info.plot ?? info.info.description ?? null,
                backdrop: info.info.backdrop_path?.[0] ?? info.info.movie_image ?? top.stream_icon ?? null,
              }),
            ),
            catchError(() => of(null)),
          )
          .subscribe((hero) => this.heroItem.set(hero));
      });

    this.api
      .getSeries()
      .pipe(
        map((list) => [...list].sort((a, b) => Number(b.last_modified ?? 0) - Number(a.last_modified ?? 0))),
        catchError(() => of([] as SeriesListItem[])),
      )
      .subscribe((sorted) => this.topSeries.set(this.mapSeriesItems(sorted)));
  }

  protected itemsFor(categoryId: string): CarouselItem[] | null {
    return this.categoryItems()[categoryId] ?? null;
  }

  protected loadCategoryRow(category: XtreamCategory, kind: 'movie' | 'series'): void {
    if (this.loadedCategoryIds.has(category.category_id)) return;
    this.loadedCategoryIds.add(category.category_id);

    const items$ =
      kind === 'movie'
        ? this.api.getVodStreams(category.category_id).pipe(map((list) => this.mapVodItems(list)))
        : this.api.getSeries(category.category_id).pipe(map((list) => this.mapSeriesItems(list)));

    items$.pipe(catchError(() => of([] as CarouselItem[]))).subscribe((items) => {
      this.categoryItems.update((map) => ({ ...map, [category.category_id]: items }));
    });
  }

  protected openCarouselItem(item: CarouselItem): void {
    void this.router.navigate([item.kind === 'movie' ? '/movies' : '/series', item.id]);
  }

  protected playHero(): void {
    const hero = this.heroItem();
    if (hero) void this.router.navigate(['/movies', hero.id], { queryParams: { resume: 1 } });
  }

  protected moreInfoHero(): void {
    const hero = this.heroItem();
    if (hero) void this.router.navigate(['/movies', hero.id]);
  }

  protected progressPercent(ref: { positionSecs?: number; durationSecs?: number }): number | null {
    if (!ref.positionSecs || !ref.durationSecs) return null;
    return Math.min(100, (ref.positionSecs / ref.durationSecs) * 100);
  }

  protected open(ref: ContentRef, resume = false): void {
    if (ref.kind === 'live') {
      void this.router.navigate(['/live-tv'], { queryParams: { channel: ref.id } });
    } else if (ref.kind === 'movie') {
      void this.router.navigate(['/movies', ref.id], resume ? { queryParams: { resume: 1 } } : {});
    } else {
      void this.router.navigate(['/series', ref.id], ref.episodeId ? { queryParams: { episode: ref.episodeId, resume: resume ? 1 : null } } : {});
    }
  }

  protected removeFromHistory(ref: ContentRef): void {
    this.history.remove(ref.kind, ref.id, ref.episodeId);
  }

  private mapVodItems(list: VodStream[]): CarouselItem[] {
    return list.slice(0, ITEMS_PER_ROW).map((m) => ({
      id: m.stream_id,
      kind: 'movie' as const,
      title: m.name,
      image: m.stream_icon ?? null,
      rating: m.rating,
      extension: m.container_extension,
    }));
  }

  private mapSeriesItems(list: SeriesListItem[]): CarouselItem[] {
    return list.slice(0, ITEMS_PER_ROW).map((s) => ({
      id: s.series_id,
      kind: 'series' as const,
      title: s.name,
      image: s.cover ?? null,
      rating: s.rating,
    }));
  }
}
