import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SearchBar } from '../../shared/components/search-bar/search-bar';

@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SearchBar],
  template: `
    <header class="flex items-center gap-3 border-b border-brand-deep-800/80 bg-brand-deep-950/80 px-4 py-3 backdrop-blur lg:px-6">
      <button type="button" (click)="menuToggle.emit()" class="text-brand-deep-400 hover:text-brand-cream lg:hidden" aria-label="Toggle menu" title="Toggle menu">
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>

      <a routerLink="/home" title="Home" class="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-brand-cream">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-sm text-brand-cream">L</span>
        <span class="hidden sm:inline">Lunivo</span>
      </a>

      <div class="mx-2 max-w-md flex-1">
        <app-search-bar [value]="''" (valueChange)="goToSearch($event)" />
      </div>

      <a routerLink="/settings" title="Settings" class="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm text-brand-deep-300 hover:bg-brand-deep-800/70">
        <span class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-deep-700 text-xs font-semibold uppercase text-brand-cream">
          {{ initial() }}
        </span>
        <span class="hidden truncate max-w-24 md:inline">{{ username() }}</span>
      </a>
    </header>
  `,
})
export class Topbar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly menuToggle = output<void>();

  protected readonly username = () => this.auth.credentials()?.username ?? '';
  protected readonly initial = () => (this.username()[0] ?? '?').toUpperCase();

  goToSearch(query: string): void {
    if (query.trim().length >= 2) {
      void this.router.navigate(['/search'], { queryParams: { q: query } });
    }
  }
}
