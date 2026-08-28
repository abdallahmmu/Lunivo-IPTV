import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { HistoryService } from '../../core/services/history.service';
import { ContentRef } from '../../core/models/library.models';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PosterCard } from '../../shared/components/poster-card/poster-card';

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PosterCard, EmptyState, DatePipe],
  templateUrl: './home-page.html',
})
export class HomePage {
  private readonly router = inject(Router);
  private readonly history = inject(HistoryService);
  private readonly favorites = inject(FavoritesService);
  protected readonly auth = inject(AuthService);

  protected readonly continueWatching = this.history.continueWatching;
  protected readonly recentlyWatched = this.history.recentlyWatched;
  protected readonly favoriteItems = this.favorites.all;

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
}
