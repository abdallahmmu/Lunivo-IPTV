import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { LiveStream } from '../../core/models/live.models';
import { SeriesListItem } from '../../core/models/series.models';
import { VodStream } from '../../core/models/vod.models';
import { SearchService } from '../../core/services/search.service';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PosterCard } from '../../shared/components/poster-card/poster-card';
import { SearchBar } from '../../shared/components/search-bar/search-bar';

@Component({
  selector: 'app-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PosterCard, EmptyState, SearchBar],
  templateUrl: './search-page.html',
})
export class SearchPage {
  protected readonly search = inject(SearchService);
  private readonly router = inject(Router);

  readonly q = input('');

  constructor() {
    effect(() => this.search.setQuery(this.q()));
  }

  protected onSearch(value: string): void {
    void this.router.navigate([], { queryParams: { q: value || null }, queryParamsHandling: 'merge' });
  }

  protected openLive(item: LiveStream): void {
    void this.router.navigate(['/live-tv'], { queryParams: { channel: item.stream_id } });
  }

  protected openMovie(item: VodStream): void {
    void this.router.navigate(['/movies', item.stream_id]);
  }

  protected openSeries(item: SeriesListItem): void {
    void this.router.navigate(['/series', item.series_id]);
  }
}
