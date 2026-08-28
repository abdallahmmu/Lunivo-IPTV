/**
 * ASSUMPTION, not verified live: this provider has EPG disabled (`get_short_epg`
 * and `xmltv.php` both returned empty on this panel), so this shape follows the
 * generic Xtream-Codes convention rather than an observed response. Parsing
 * code must fail soft if a real provider's shape differs.
 */
export interface XtreamEpgListing {
  id?: string;
  epg_id?: string;
  title: string;
  lang?: string;
  start: string;
  end: string;
  description?: string;
  channel_id?: string;
  start_timestamp: string;
  stop_timestamp: string;
  now_playing?: number | string;
  has_archive?: number | string;
}

export interface ShortEpgResponse {
  epg_listings: XtreamEpgListing[];
}

/** Decoded, UI-friendly program entry. */
export interface EpgProgram {
  title: string;
  description: string;
  start: Date;
  end: Date;
  isNow: boolean;
}
