import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { ImageFallbackDirective } from '../../directives/image-fallback.directive';

@Component({
  selector: 'app-channel-list-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FavoriteButton, ImageFallbackDirective],
  template: `
    <button
      type="button"
      (click)="activate.emit()"
      class="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition"
      [class]="active() ? 'bg-brand-primary/15 ring-1 ring-brand-primary/40' : 'hover:bg-brand-deep-800/70'"
    >
      <span class="w-7 shrink-0 text-right text-xs tabular-nums text-brand-deep-500">{{ channelNumber() }}</span>
      <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand-deep-800">
        <img [src]="logo() || placeholder" appImageFallback="logo" [alt]="name()" loading="lazy" class="h-full w-full object-contain p-1" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium" [class]="active() ? 'text-brand-cream' : 'text-brand-deep-200'">{{ name() }}</p>
        @if (nowTitle()) {
          <p class="truncate text-xs text-brand-deep-400">{{ nowTitle() }}</p>
        }
      </div>
      <app-favorite-button
        [active]="isFavorite()"
        (toggled)="favoriteToggle.emit()"
        class="opacity-0 transition group-hover:opacity-100"
        [class.!opacity-100]="isFavorite()"
      />
    </button>
  `,
})
export class ChannelListItem {
  readonly name = input.required<string>();
  readonly logo = input<string | null | undefined>(null);
  readonly channelNumber = input<number | string>('');
  readonly nowTitle = input<string | null>(null);
  readonly active = input(false);
  readonly isFavorite = input(false);

  readonly activate = output<void>();
  readonly favoriteToggle = output<void>();

  protected readonly placeholder =
    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%231e293b"/></svg>';
}
