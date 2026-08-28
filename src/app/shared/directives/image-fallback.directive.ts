import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';

/**
 * Swaps a broken/missing poster or channel-logo `<img>` for an inline SVG
 * placeholder instead of showing the browser's broken-image icon. Provider
 * catalogs commonly have null/dead `stream_icon` URLs at scale (thousands of
 * items), so this is applied broadly rather than case-by-case.
 */
@Directive({ selector: 'img[appImageFallback]' })
export class ImageFallbackDirective {
  private readonly el = inject<ElementRef<HTMLImageElement>>(ElementRef);
  readonly appImageFallback = input<'poster' | 'logo'>('poster');

  private swapped = false;

  @HostListener('error')
  onError(): void {
    if (this.swapped) return;
    this.swapped = true;
    this.el.nativeElement.src = placeholderFor(this.appImageFallback());
  }
}

function placeholderFor(kind: 'poster' | 'logo'): string {
  const icon =
    kind === 'logo'
      ? '<path d="M4 6h16v10H4z"/><path d="M9 20h6"/><path d="M12 16v4"/>'
      : '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23475569" stroke-width="1.5"><rect width="24" height="24" fill="%231e293b"/>${icon}</svg>`;
  return `data:image/svg+xml,${svg}`;
}
