import { Injectable, inject } from '@angular/core';
import { Observable, map, catchError, of } from 'rxjs';
import { EpgProgram, XtreamEpgListing } from '../models/epg.models';
import { IptvApiService } from './iptv-api.service';

export interface NowNext {
  now: EpgProgram | null;
  next: EpgProgram | null;
}

const EMPTY: NowNext = { now: null, next: null };

/**
 * Wraps `get_short_epg`. EPG availability varies a lot by provider (the one
 * this app was verified against has it disabled entirely), so every method
 * here fails soft to an empty result instead of surfacing an error — the UI
 * is expected to simply hide Now/Next when this comes back empty.
 */
@Injectable({ providedIn: 'root' })
export class EpgService {
  private readonly api = inject(IptvApiService);

  getNowNext(streamId: number): Observable<NowNext> {
    return this.api.getShortEpg(streamId, 4).pipe(
      map((res) => {
        const listings = (res?.epg_listings ?? []).map(decodeListing).sort((a, b) => a.start.getTime() - b.start.getTime());
        const now = listings.find((p) => p.isNow) ?? null;
        const upcoming = listings.filter((p) => p.start.getTime() > (now?.start.getTime() ?? 0));
        return { now, next: upcoming[0] ?? null };
      }),
      catchError(() => of(EMPTY)),
    );
  }
}

function decodeListing(listing: XtreamEpgListing): EpgProgram {
  const start = new Date(Number(listing.start_timestamp) * 1000);
  const end = new Date(Number(listing.stop_timestamp) * 1000);
  const now = Date.now();
  return {
    title: decodeMaybeBase64(listing.title),
    description: decodeMaybeBase64(listing.description ?? ''),
    start,
    end,
    isNow: start.getTime() <= now && now < end.getTime(),
  };
}

/** Xtream EPG text fields are conventionally base64 — decode defensively, fall back to raw text. */
function decodeMaybeBase64(value: string): string {
  if (!value) return '';
  try {
    const binary = atob(value);
    // A real base64 payload decodes to readable UTF-8; anything producing control-heavy
    // garbage was probably plain text to begin with.
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0e-\x1f]/.test(binary)) return value;
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return value;
  }
}
