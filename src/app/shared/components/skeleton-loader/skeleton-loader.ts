import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type SkeletonVariant = 'poster-grid' | 'list-rows' | 'hero';

@Component({
  selector: 'app-skeleton-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (variant()) {
      @case ('poster-grid') {
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          @for (i of items(); track i) {
            <div class="animate-pulse">
              <div class="aspect-[2/3] rounded-lg bg-brand-deep-800"></div>
              <div class="mt-2 h-3 w-3/4 rounded bg-brand-deep-800"></div>
            </div>
          }
        </div>
      }
      @case ('list-rows') {
        <div class="flex flex-col gap-2">
          @for (i of items(); track i) {
            <div class="flex animate-pulse items-center gap-3 rounded-lg p-2">
              <div class="h-10 w-10 shrink-0 rounded bg-brand-deep-800"></div>
              <div class="h-3 w-1/2 rounded bg-brand-deep-800"></div>
            </div>
          }
        </div>
      }
      @case ('hero') {
        <div class="aspect-video w-full animate-pulse rounded-xl bg-brand-deep-800"></div>
      }
    }
  `,
})
export class SkeletonLoader {
  readonly variant = input<SkeletonVariant>('poster-grid');
  readonly count = input(12);

  protected items(): number[] {
    return Array.from({ length: this.count() }, (_, i) => i);
  }
}
