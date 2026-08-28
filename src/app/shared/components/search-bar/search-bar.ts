import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <label class="relative flex items-center">
      <svg viewBox="0 0 24 24" class="pointer-events-none absolute left-3 h-4 w-4 text-brand-sky" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        [placeholder]="placeholder()"
        [ngModel]="value()"
        (ngModelChange)="onInput($event)"
        class="w-full rounded-full border border-brand-violet bg-brand-primary/80 py-2 pl-9 pr-4 text-sm text-brand-cyan placeholder-brand-sky outline-none transition focus:border-brand-violet focus:bg-brand-primary"
      />
    </label>
  `,
})
export class SearchBar {
  readonly placeholder = input('Search live TV, movies, series…');
  readonly value = input('');
  readonly valueChange = output<string>();

  onInput(next: string): void {
    this.valueChange.emit(next);
  }
}
