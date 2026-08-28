import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ContentKind } from '../../core/models/common.models';
import { ContentRef } from '../../core/models/library.models';
import { FavoritesService } from '../../core/services/favorites.service';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PosterCard } from '../../shared/components/poster-card/poster-card';

type Tab = 'live' | 'movie' | 'series';

@Component({
  selector: 'app-favorites-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PosterCard, EmptyState],
  templateUrl: './favorites-page.html',
})
export class FavoritesPage {
  protected readonly favorites = inject(FavoritesService);
  private readonly router = inject(Router);

  protected readonly tab = signal<Tab>('live');
  protected readonly tabs: Array<{ key: Tab; label: string }> = [
    { key: 'live', label: 'Live TV' },
    { key: 'movie', label: 'Movies' },
    { key: 'series', label: 'Series' },
  ];

  protected itemsFor(tab: Tab) {
    return tab === 'live' ? this.favorites.live() : tab === 'movie' ? this.favorites.movies() : this.favorites.series();
  }

  protected open(item: ContentRef): void {
    if (item.kind === 'live') {
      void this.router.navigate(['/live-tv'], { queryParams: { channel: item.id } });
    } else if (item.kind === 'movie') {
      void this.router.navigate(['/movies', item.id]);
    } else {
      void this.router.navigate(['/series', item.id]);
    }
  }

  protected remove(kind: ContentKind, id: number): void {
    this.favorites.remove(kind, id);
  }
}
