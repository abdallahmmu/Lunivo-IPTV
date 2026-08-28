import { Injectable, Signal, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, finalize, forkJoin, of, switchMap } from 'rxjs';
import { LiveStream } from '../models/live.models';
import { SeriesListItem } from '../models/series.models';
import { VodStream } from '../models/vod.models';
import { IptvApiService } from './iptv-api.service';

export interface SearchResults {
  live: LiveStream[];
  movies: VodStream[];
  series: SeriesListItem[];
}

const EMPTY: SearchResults = { live: [], movies: [], series: [] };
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS_PER_SECTION = 30;

/**
 * Global search across the full catalog. The Xtream API has no server-side
 * search, so this lazily loads (and caches via IptvApiService) the full
 * live/VOD/series lists once, then filters in memory — avoiding a network
 * request per keystroke. Input is debounced centrally here so every caller
 * (topbar quick-search, the dedicated search page) gets the same behavior.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly api = inject(IptvApiService);

  private readonly query$ = new Subject<string>();
  readonly indexing = signal(false);

  readonly results: Signal<SearchResults | undefined> = toSignal(
    this.query$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query) => {
        const trimmed = query.trim();
        if (trimmed.length < MIN_QUERY_LENGTH) {
          this.indexing.set(false);
          return of(EMPTY);
        }
        this.indexing.set(true);
        return forkJoin({
          live: this.api.getLiveStreams(),
          movies: this.api.getVodStreams(),
          series: this.api.getSeries(),
        }).pipe(
          switchMap((catalog) => of(filter(catalog, trimmed))),
          catchError(() => of(EMPTY)),
          finalize(() => this.indexing.set(false)),
        );
      }),
    ),
    { initialValue: EMPTY },
  );

  setQuery(query: string): void {
    this.query$.next(query);
  }
}

function filter(
  catalog: { live: LiveStream[]; movies: VodStream[]; series: SeriesListItem[] },
  query: string,
): SearchResults {
  const q = query.toLowerCase();
  const match = (name: string) => name.toLowerCase().includes(q);
  return {
    live: catalog.live.filter((s) => match(s.name)).slice(0, MAX_RESULTS_PER_SECTION),
    movies: catalog.movies.filter((s) => match(s.name)).slice(0, MAX_RESULTS_PER_SECTION),
    series: catalog.series.filter((s) => match(s.name)).slice(0, MAX_RESULTS_PER_SECTION),
  };
}
