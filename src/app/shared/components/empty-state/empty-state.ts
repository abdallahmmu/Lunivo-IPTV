import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-brand-violet px-6 py-16 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-full bg-brand-violet/60 text-2xl">{{ icon() }}</div>
      <p class="text-base font-medium text-brand-cyan">{{ title() }}</p>
      @if (subtitle()) {
        <p class="max-w-sm text-sm text-brand-sky">{{ subtitle() }}</p>
      }
      <ng-content></ng-content>
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('📭');
  readonly title = input('Nothing here yet');
  readonly subtitle = input<string | null>(null);
}
