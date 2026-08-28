import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { remixInformationLine, remixPlayFill } from '@ng-icons/remixicon';

@Component({
  selector: 'app-hero-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ remixPlayFill, remixInformationLine })],
  template: `
    <section class="relative aspect-21/9 w-full overflow-hidden rounded-2xl bg-brand-primary sm:aspect-32/9" animate.enter="hero-enter">
      @if (backdrop(); as bg) {
        <img [src]="bg" alt="" class="absolute inset-0 h-full w-full object-cover" />
      }
      <div class="absolute inset-0 bg-linear-to-t from-brand-primary via-brand-primary/30 to-transparent"></div>
      <div class="absolute inset-0 bg-linear-to-r from-brand-primary/85 via-brand-primary/10 to-transparent"></div>

      <div class="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 sm:max-w-lg sm:p-10">
        <h1 class="text-2xl font-extrabold leading-tight text-brand-cyan drop-shadow-lg sm:text-4xl">{{ title() }}</h1>
        @if (plot(); as p) {
          <p class="line-clamp-2 text-sm text-brand-cyan drop-shadow sm:text-base">{{ p }}</p>
        }
        <div class="mt-2 flex gap-3">
          <button
            type="button"
            (click)="play.emit()"
            class="flex items-center gap-2 rounded-full bg-brand-secondary px-6 py-2.5 text-sm font-semibold text-brand-primary transition hover:brightness-110"
          >
            <ng-icon name="remixPlayFill" size="18" />
            Play
          </button>
          <button
            type="button"
            (click)="moreInfo.emit()"
            class="flex items-center gap-2 rounded-full bg-brand-violet/70 px-6 py-2.5 text-sm font-semibold text-brand-cyan backdrop-blur transition hover:bg-brand-violet"
          >
            <ng-icon name="remixInformationLine" size="18" />
            More Info
          </button>
        </div>
      </div>
    </section>
  `,
})
export class HeroBanner {
  readonly title = input.required<string>();
  readonly plot = input<string | null>(null);
  readonly backdrop = input<string | null>(null);

  readonly play = output<void>();
  readonly moreInfo = output<void>();
}
