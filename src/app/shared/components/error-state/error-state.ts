import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AppError } from '../../../core/models/common.models';

@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-900/40 bg-red-950/20 px-6 py-16 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-full bg-red-900/30 text-2xl">⚠️</div>
      <p class="text-base font-medium text-brand-cyan">{{ error().message }}</p>
      @if (showRetry()) {
        <button
          type="button"
          (click)="retry.emit()"
          class="mt-1 rounded-full bg-brand-secondary px-4 py-1.5 text-sm font-medium text-brand-primary transition hover:brightness-110"
        >
          Try again
        </button>
      }
    </div>
  `,
})
export class ErrorState {
  readonly error = input.required<AppError>();
  readonly showRetry = input(true);
  readonly retry = output<void>();
}
