export type ContentKind = 'live' | 'movie' | 'series';

/** Category shape shared by get_live_categories / get_vod_categories / get_series_categories. */
export interface XtreamCategory {
  category_id: string;
  category_name: string;
  icon?: string | null;
  parent_id?: number;
  is_adult?: number | string;
  stream_count?: number;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** Normalized error surfaced to components — never a raw stack trace. */
export interface AppError {
  message: string;
  code:
    | 'invalid_url'
    | 'invalid_credentials'
    | 'network'
    | 'cors'
    | 'mixed_content'
    | 'server_error'
    | 'expired'
    | 'disabled'
    | 'not_supported'
    | 'unknown';
  status?: number;
}

export interface LoadState<T> {
  loading: boolean;
  error: AppError | null;
  data: T | null;
}

export function initialLoadState<T>(): LoadState<T> {
  return { loading: false, error: null, data: null };
}
