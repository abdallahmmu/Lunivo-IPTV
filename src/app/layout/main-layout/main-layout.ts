import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Sidebar, Topbar],
  template: `
    <div class="flex h-dvh flex-col bg-brand-deep-950 text-brand-deep-100">
      <app-topbar (menuToggle)="mobileNavOpen.set(!mobileNavOpen())" />

      <div class="flex min-h-0 flex-1">
        <aside class="hidden w-56 shrink-0 border-r border-brand-deep-800/80 lg:block">
          <app-sidebar />
        </aside>

        @if (mobileNavOpen()) {
          <div class="fixed inset-0 z-40 lg:hidden">
            <div class="absolute inset-0 bg-brand-deep-950/60" (click)="mobileNavOpen.set(false)"></div>
            <aside class="absolute inset-y-0 left-0 w-64 bg-brand-deep-950 shadow-xl" (click)="mobileNavOpen.set(false)">
              <app-sidebar />
            </aside>
          </div>
        }

        <main class="min-w-0 flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class MainLayout {
  protected readonly mobileNavOpen = signal(false);
}
