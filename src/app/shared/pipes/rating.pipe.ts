import { Pipe, PipeTransform } from '@angular/core';

/** Formats a provider rating (e.g. "7.323", 8, "0") down to one decimal place: "7.3". */
@Pipe({ name: 'rating' })
export class RatingPipe implements PipeTransform {
  transform(value: string | number | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(n) ? n.toFixed(1) : null;
  }
}
