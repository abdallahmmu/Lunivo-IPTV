import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/home', icon: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { label: 'Live TV', path: '/live-tv', icon: 'M4 6h16v11H4zM8 20h8M12 17v3' },
  { label: 'Movies', path: '/movies', icon: 'M4 4h16v16H4zM4 9h16M9 4v5M4 15h16M9 15v5' },
  { label: 'Series', path: '/series', icon: 'M4 5h16v12H4zM8 21h8M9 8l5 3-5 3z' },
  { label: 'Favorites', path: '/favorites', icon: 'M12 21s-6.7-4.35-9.3-8.2C1 10.1 1.6 6.6 4.6 5.1c2.4-1.2 5 .1 7.4 3 2.4-2.9 5-4.2 7.4-3 3 1.5 3.6 5 1.9 7.7C18.7 16.65 12 21 12 21z' },
  { label: 'History', path: '/history', icon: 'M12 8v4l3 3M21 12a9 9 0 1 1-3-6.7M21 4v5h-5' },
  { label: 'Settings', path: '/settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z' },
];

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, DatePipe],
  template: `
    <nav class="flex h-full flex-col gap-1 p-3">
      @for (item of items; track item.path) {
        <a
          [routerLink]="item.path"
          [title]="item.label"
          routerLinkActive="bg-brand-secondary/15 text-brand-cyan border-brand-secondary"
          class="flex items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2.5 text-sm font-medium text-brand-sky transition hover:bg-brand-violet/60 hover:text-brand-cyan"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path [attr.d]="item.icon" />
          </svg>
          <span class="lg:inline">{{ item.label }}</span>
        </a>
      }
    </nav>

    @if (expiryDate(); as exp) {
      <div class="hidden border-t border-brand-violet p-4 text-xs text-brand-sky lg:block">
        <p>Account expires</p>
        <p class="text-brand-cyan">{{ exp | date: 'mediumDate' }}</p>
      </div>
    }
  `,
})
export class Sidebar {
  private readonly auth = inject(AuthService);
  protected readonly items = NAV_ITEMS;
  protected readonly expiryDate = this.auth.expiryDate;
}
