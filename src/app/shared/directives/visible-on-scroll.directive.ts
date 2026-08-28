import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, output } from '@angular/core';

/**
 * Emits `visible` when the host element scrolls into view — used to drive
 * "load more" pagination for large catalogs (movies/series can run into the
 * tens of thousands of items) without rendering everything up front.
 */
@Directive({ selector: '[appVisibleOnScroll]' })
export class VisibleOnScrollDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  readonly visible = output<void>();

  private observer: IntersectionObserver | null = null;

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.visible.emit();
        }
      },
      { rootMargin: '400px' },
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
