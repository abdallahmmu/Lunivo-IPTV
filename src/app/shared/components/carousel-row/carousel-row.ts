import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { remixArrowLeftSLine, remixArrowRightSLine } from '@ng-icons/remixicon';
import { PosterCard } from '../poster-card/poster-card';

export interface CarouselItem {
  id: number;
  kind: 'movie' | 'series';
  title: string;
  image: string | null;
  rating?: string | null;
  extension?: string | null;
}

const SKELETON_COUNT = Array.from({ length: 6 });

/**
 * A horizontally-scrolling, lazily-populated row of poster cards — the core
 * browsing unit of the Home page, one per category. `items() === null` means
 * "not loaded yet" and renders skeleton placeholders instead of an empty row.
 */
@Component({
  selector: 'app-carousel-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PosterCard, NgIcon, MatTooltipModule, RouterLink],
  providers: [provideIcons({ remixArrowLeftSLine, remixArrowRightSLine })],
  template: `
    <section class="flex flex-col gap-3">
      <div class="flex items-baseline justify-between px-1">
        <h2 class="text-lg font-semibold text-brand-cyan">{{ title() }}</h2>
        @if (showAllRoute(); as route) {
          <a [routerLink]="route" [queryParams]="showAllQueryParams()" class="text-xs font-medium text-brand-sky transition hover:text-brand-cyan">
            Show All ›
          </a>
        }
      </div>
      <div class="group/row relative">
        @if (showLeftArrow()) {
          <button
            type="button"
            (click)="scrollByPage(-1)"
            class="absolute inset-y-0 left-0 z-10 hidden w-12 items-center justify-center bg-linear-to-r from-brand-primary to-transparent text-brand-cyan opacity-0 transition group-hover/row:opacity-100 lg:flex"
            aria-label="Scroll left"
            matTooltip="Scroll left"
          >
            <ng-icon name="remixArrowLeftSLine" size="28" />
          </button>
        }

        <div #scroller (scroll)="onScroll()" class="scrollbar-none flex gap-3 overflow-x-auto scroll-smooth px-1 pb-2">
          @if (items() === null) {
            @for (i of skeletonCount; track i) {
              <div class="aspect-2/3 w-36 shrink-0 animate-pulse rounded-lg bg-brand-violet sm:w-44"></div>
            }
          } @else if (items()!.length === 0) {
            <p class="py-8 text-sm text-brand-sky">Nothing in this category yet.</p>
          } @else {
            @for (item of items(); track item.kind + item.id) {
              <div class="w-36 shrink-0 sm:w-44" animate.enter="carousel-item-enter">
                <app-poster-card
                  [title]="item.title"
                  [image]="item.image"
                  [rating]="item.rating"
                  [extension]="item.extension"
                  (activate)="activate.emit(item)"
                />
              </div>
            }
          }
        </div>

        @if (showRightArrow()) {
          <button
            type="button"
            (click)="scrollByPage(1)"
            class="absolute inset-y-0 right-0 z-10 hidden w-12 items-center justify-center bg-linear-to-l from-brand-primary to-transparent text-brand-cyan opacity-0 transition group-hover/row:opacity-100 lg:flex"
            aria-label="Scroll right"
            matTooltip="Scroll right"
          >
            <ng-icon name="remixArrowRightSLine" size="28" />
          </button>
        }
      </div>
    </section>
  `,
})
export class CarouselRow {
  readonly title = input.required<string>();
  /** null = not loaded yet (shows skeletons); empty array = loaded but genuinely empty. */
  readonly items = input<CarouselItem[] | null>(null);
  /** routerLink target for the "Show All" link — omit to hide it. */
  readonly showAllRoute = input<string[] | null>(null);
  readonly showAllQueryParams = input<Record<string, string> | undefined>(undefined);
  readonly activate = output<CarouselItem>();

  protected readonly skeletonCount = SKELETON_COUNT;
  protected readonly showLeftArrow = signal(false);
  protected readonly showRightArrow = signal(true);

  private readonly scrollerRef = viewChild<ElementRef<HTMLDivElement>>('scroller');

  protected onScroll(): void {
    const el = this.scrollerRef()?.nativeElement;
    if (!el) return;
    this.showLeftArrow.set(el.scrollLeft > 4);
    this.showRightArrow.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  protected scrollByPage(direction: 1 | -1): void {
    const el = this.scrollerRef()?.nativeElement;
    el?.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  }
}
