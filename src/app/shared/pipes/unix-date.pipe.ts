import { DatePipe } from '@angular/common';
import { Pipe, PipeTransform, inject } from '@angular/core';

/** Converts an Xtream unix-seconds string/number (e.g. `exp_date`, `added`) into a formatted date. */
@Pipe({ name: 'unixDate' })
export class UnixDatePipe implements PipeTransform {
  private readonly datePipe = inject(DatePipe);

  transform(value: string | number | null | undefined, format = 'mediumDate'): string {
    if (value === null || value === undefined || value === '') return '';
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return '';
    return this.datePipe.transform(new Date(seconds * 1000), format) ?? '';
  }
}
