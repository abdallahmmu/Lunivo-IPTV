import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ContentRef } from '../../core/models/library.models';
import { FavoritesService } from '../../core/services/favorites.service';
import { HistoryService } from '../../core/services/history.service';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PosterCard } from '../../shared/components/poster-card/poster-card';

@Component({
  selector: 'app-history-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PosterCard, EmptyState],
  templateUrl: './history-page.html',
})
export class HistoryPage {
  protected readonly history = inject(HistoryService);
  protected readonly favorites = inject(FavoritesService);
  private readonly router = inject(Router);

  protected progressPercent(ref: { positionSecs?: number; durationSecs?: number }): number | null {
    if (!ref.positionSecs || !ref.durationSecs) return null;
    return Math.min(100, (ref.positionSecs / ref.durationSecs) * 100);
  }

  protected open(ref: ContentRef): void {
    if (ref.kind === 'live') {
      void this.router.navigate(['/live-tv'], { queryParams: { channel: ref.id } });
    } else if (ref.kind === 'movie') {
      void this.router.navigate(['/movies', ref.id], { queryParams: { resume: 1 } });
    } else {
      void this.router.navigate(['/series', ref.id], ref.episodeId ? { queryParams: { episode: ref.episodeId, resume: 1 } } : {});
    }
  }

  protected remove(ref: ContentRef): void {
    this.history.remove(ref.kind, ref.id, ref.episodeId);
  }

  protected clearAll(): void {
    this.history.clear();
  }
}
