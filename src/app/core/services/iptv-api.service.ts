import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { IptvCredentials } from '../models/auth.models';
import { XtreamCategory } from '../models/common.models';
import { ShortEpgResponse } from '../models/epg.models';
import { LiveStream } from '../models/live.models';
import { SeriesInfo, SeriesListItem } from '../models/series.models';
import { VodInfo, VodStream } from '../models/vod.models';
import { playerApiUrl } from '../utils/url.util';
import { AuthService } from './auth.service';
import { CacheService } from './cache.service';

const ALL = 'all';

/**
 * Typed layer over `player_api.php`. Every method transparently caches its
 * result (in-memory, category catalogs also persisted) so navigating between
 * screens never re-downloads a multi-MB catalog. Call the matching
 * `refresh*` variant, or `IptvApiService.invalidateAll()`, to force a reload.
 */
@Injectable({ providedIn: 'root' })
export class IptvApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly cache = inject(CacheService);

  invalidateAll(): void {
    this.cache.invalidate('iptv:');
  }

  getLiveCategories(): Observable<XtreamCategory[]> {
    return this.cached('iptv:live:categories', true, () => this.action<XtreamCategory[]>('get_live_categories'));
  }

  getLiveStreams(categoryId?: string): Observable<LiveStream[]> {
    return this.cached(`iptv:live:streams:${categoryId ?? ALL}`, false, () =>
      this.action<LiveStream[]>('get_live_streams', categoryId ? { category_id: categoryId } : {}),
    );
  }

  getVodCategories(): Observable<XtreamCategory[]> {
    return this.cached('iptv:vod:categories', true, () => this.action<XtreamCategory[]>('get_vod_categories'));
  }

  getVodStreams(categoryId?: string): Observable<VodStream[]> {
    return this.cached(`iptv:vod:streams:${categoryId ?? ALL}`, false, () =>
      this.action<VodStream[]>('get_vod_streams', categoryId ? { category_id: categoryId } : {}),
    );
  }

  getVodInfo(vodId: number): Observable<VodInfo> {
    return this.cached(`iptv:vod:info:${vodId}`, false, () => this.action<VodInfo>('get_vod_info', { vod_id: String(vodId) }));
  }

  getSeriesCategories(): Observable<XtreamCategory[]> {
    return this.cached('iptv:series:categories', true, () => this.action<XtreamCategory[]>('get_series_categories'));
  }

  getSeries(categoryId?: string): Observable<SeriesListItem[]> {
    return this.cached(`iptv:series:list:${categoryId ?? ALL}`, false, () =>
      this.action<SeriesListItem[]>('get_series', categoryId ? { category_id: categoryId } : {}),
    );
  }

  getSeriesInfo(seriesId: number): Observable<SeriesInfo> {
    return this.cached(`iptv:series:info:${seriesId}`, false, () =>
      this.action<SeriesInfo>('get_series_info', { series_id: String(seriesId) }),
    );
  }

  /** Empty listings are common (many providers, including the one this app was built against, disable EPG entirely). */
  getShortEpg(streamId: number, limit = 4): Observable<ShortEpgResponse> {
    return this.cached(
      `iptv:epg:${streamId}:${limit}`,
      false,
      () => this.action<ShortEpgResponse>('get_short_epg', { stream_id: String(streamId), limit: String(limit) }),
      5 * 60 * 1000,
    );
  }

  private cached<T>(key: string, persist: boolean, load: () => Observable<T>, ttlMs?: number): Observable<T> {
    const hit = this.cache.get<T>(key, persist);
    if (hit !== null) {
      return new Observable<T>((subscriber) => {
        subscriber.next(hit);
        subscriber.complete();
      });
    }
    return load().pipe(
      map((value) => {
        this.cache.set(key, value, { persist, ttlMs });
        return value;
      }),
    );
  }

  private action<T>(action: string, extraParams: Record<string, string> = {}): Observable<T> {
    const creds = this.requireCredentials();
    return this.http.get<T>(playerApiUrl(creds.serverUrl), {
      params: { username: creds.username, password: creds.password, action, ...extraParams },
    });
  }

  private requireCredentials(): IptvCredentials {
    const creds = this.auth.credentials();
    if (!creds) {
      throw new Error('Not connected to an IPTV server.');
    }
    return creds;
  }
}
