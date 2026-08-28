import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-favorite-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="toggle($event)"
      [attr.aria-pressed]="active()"
      [attr.aria-label]="active() ? 'Remove from favorites' : 'Add to favorites'"
      [title]="active() ? 'Remove from favorites' : 'Add to favorites'"
      class="flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition"
      [class]="active() ? 'bg-brand-secondary/90 text-brand-primary' : 'bg-brand-primary/50 text-brand-cyan hover:bg-brand-primary/70'"
    >
      <svg viewBox="0 0 24 24" class="h-4.5 w-4.5" [attr.fill]="active() ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
        <path
          d="M12 21s-6.7-4.35-9.3-8.2C1 10.1 1.6 6.6 4.6 5.1c2.4-1.2 5 .1 7.4 3 2.4-2.9 5-4.2 7.4-3 3 1.5 3.6 5 1.9 7.7C18.7 16.65 12 21 12 21z"
        />
      </svg>
    </button>
  `,
})
export class FavoriteButton {
  readonly active = input(false);
  readonly toggled = output<void>();

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.toggled.emit();
  }
}
