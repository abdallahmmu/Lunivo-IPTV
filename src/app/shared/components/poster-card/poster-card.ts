import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { ImageFallbackDirective } from '../../directives/image-fallback.directive';
import { ProgressBar } from '../progress-bar/progress-bar';
import { RatingPipe } from '../../pipes/rating.pipe';

@Component({
  selector: 'app-poster-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FavoriteButton, ImageFallbackDirective, ProgressBar, RatingPipe],
  template: `
    <button
      type="button"
      (click)="activate.emit()"
      [title]="subtitle() ? title() + ' — ' + subtitle() : title()"
      class="group relative block w-full shrink-0 overflow-hidden rounded-lg bg-brand-primary text-left ring-1 ring-brand-cyan/5 transition duration-200 hover:z-10 hover:-translate-y-1 hover:ring-brand-cyan/20 hover:shadow-2xl hover:shadow-brand-primary/50"
    >
      <div class="aspect-2/3 w-full overflow-hidden bg-brand-violet">
        <img
          [src]="image() || placeholder"
          appImageFallback="poster"
          [alt]="title()"
          loading="lazy"
          class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>

      <div class="absolute inset-x-0 top-0 flex items-start justify-between p-2 opacity-0 transition group-hover:opacity-100">
        <app-favorite-button [active]="isFavorite()" (toggled)="favoriteToggle.emit()" />
      </div>

      @if (rating() | rating; as r) {
        <div class="absolute right-2 top-2 rounded-md bg-brand-primary/60 px-1.5 py-0.5 text-xs font-medium text-amber-400 backdrop-blur" title="Rating: {{ r }}">
          ★ {{ r }}
        </div>
      }

      @if (extension(); as ext) {
        <div
          class="absolute left-2 top-2 rounded-md bg-brand-primary/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-cyan backdrop-blur"
          title="File type: {{ ext }}"
        >
          {{ ext }}
        </div>
      }

      @if (progressPercent() !== null) {
        <div class="absolute inset-x-0 bottom-0 p-1.5">
          <app-progress-bar [position]="progressPercent()!" [duration]="100" />
        </div>
      }

      <div class="absolute inset-x-0 bottom-0 bg-linear-to-t from-brand-primary/90 via-brand-primary/40 to-transparent p-2.5 pt-8">
        <p class="truncate text-sm font-medium text-brand-cyan">{{ title() }}</p>
        @if (subtitle()) {
          <p class="truncate text-xs text-brand-cyan">{{ subtitle() }}</p>
        }
      </div>
    </button>
  `,
})
export class PosterCard {
  readonly title = input.required<string>();
  readonly image = input<string | null | undefined>(null);
  readonly subtitle = input<string | null | undefined>(null);
  readonly rating = input<string | null | undefined | number>(null);
  /** Container format (e.g. "mkv", "mp4"), when the caller has it available without an extra request. */
  readonly extension = input<string | null | undefined>(null);
  readonly isFavorite = input(false);
  /** 0-100, or null to hide the progress bar. */
  readonly progressPercent = input<number | null>(null);

  readonly activate = output<void>();
  readonly favoriteToggle = output<void>();

  protected readonly placeholder =
    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23232539"/></svg>';
}
