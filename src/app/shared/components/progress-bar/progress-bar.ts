import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-1 w-full overflow-hidden rounded-full bg-brand-cyan/20">
      <div class="h-full rounded-full bg-brand-secondary" [style.width.%]="percent()"></div>
    </div>
  `,
})
export class ProgressBar {
  readonly position = input(0);
  readonly duration = input(0);

  readonly percent = computed(() => {
    const duration = this.duration();
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (this.position() / duration) * 100));
  });
}
