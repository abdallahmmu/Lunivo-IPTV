import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { XtreamCategory } from '../../../core/models/common.models';

@Component({
  selector: 'app-category-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scrollbar-none flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        (click)="select.emit(null)"
        title="All categories"
        class="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition"
        [class]="activeId() === null ? 'bg-brand-primary text-brand-cream' : 'bg-brand-deep-800 text-brand-deep-300 hover:bg-brand-deep-700'"
      >
        All
      </button>
      @for (category of categories(); track category.category_id) {
        <button
          type="button"
          (click)="select.emit(category.category_id)"
          [title]="category.category_name"
          class="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition"
          [class]="activeId() === category.category_id ? 'bg-brand-primary text-brand-cream' : 'bg-brand-deep-800 text-brand-deep-300 hover:bg-brand-deep-700'"
        >
          {{ category.category_name }}
          @if (category.stream_count) {
            <span class="ml-1 opacity-60">{{ category.stream_count }}</span>
          }
        </button>
      }
    </div>
  `,
})
export class CategoryTabs {
  readonly categories = input.required<XtreamCategory[]>();
  readonly activeId = input<string | null>(null);
  readonly select = output<string | null>();
}
