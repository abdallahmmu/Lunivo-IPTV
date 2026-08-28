import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The Lunivo mark: an "L" whose foot tapers into a play arrow. Renders in
 * `currentColor` so it re-tints with whatever brand color wraps it, matching
 * the badges it drops into across the app (topbar, landing page, login dialog).
 */
@Component({
  selector: 'app-logo-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size() * (30 / 36)" viewBox="0 0 36 30" fill="currentColor" aria-hidden="true">
      <path d="M6,4h6v16h12l6,3l-6,3H6Z" />
    </svg>
  `,
})
export class LogoMark {
  readonly size = input(24);
}
