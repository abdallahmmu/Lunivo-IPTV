import { Pipe, PipeTransform } from '@angular/core';

/** Formats seconds as a running clock: "0:31", "12:04", or "1:02:03" once past an hour. */
@Pipe({ name: 'clockTime' })
export class ClockTimePipe implements PipeTransform {
  transform(totalSeconds: number | null | undefined): string {
    if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
      return '0:00';
    }
    const seconds = Math.floor(totalSeconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const paddedSecs = String(secs).padStart(2, '0');
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSecs}`;
    }
    return `${minutes}:${paddedSecs}`;
  }
}
