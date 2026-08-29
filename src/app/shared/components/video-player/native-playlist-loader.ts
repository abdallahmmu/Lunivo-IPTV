import { CapacitorHttp } from '@capacitor/core';
import type { HlsConfig, Loader, LoaderCallbacks, LoaderConfiguration, LoaderStats, PlaylistLoaderContext } from 'hls.js';

/**
 * hls.js resolves every relative/absolute-path URI in a fetched playlist (segments,
 * `#EXT-X-KEY`/`#EXT-X-MAP`) against the *response's* reported URL, not the URL it originally
 * asked for. Under Capacitor's CapacitorHttp GET interceptor (native platforms only, and only
 * for the `fetch`/`XMLHttpRequest` patch — see below), that reported URL is always its own
 * internal `https://localhost/_capacitor_http_interceptor_?u=...` pseudo-URL, never the real
 * remote URL — verified live: a live channel's absolute-path segment lines resolved to that dead
 * local address instead of the real server.
 *
 * An earlier version of this fix forced the reported URL back to the one we originally
 * requested — correct when the provider serves the playlist directly, but wrong the moment a
 * provider redirects the request to a different delivery host (also verified live: one channel's
 * `.m3u8` 302-redirects to a completely different CDN host:port, and content actually served
 * from *that* host still needs to resolve its own relative references against itself, not the
 * pre-redirect URL). The interceptor swallows redirects internally and never exposes the final
 * URL to JS at all, so there's no fixing this by reading anything off `fetch`/XHR.
 *
 * The one thing that *does* correctly report the final post-redirect URL is the `CapacitorHttp`
 * plugin's own native `request()` API — a separate code path from the fetch/XHR patch, calling
 * straight into native networking. On Android it's backed by `HttpURLConnection`, whose
 * `getURL()` reflects the last URL actually connected to after following redirects (see
 * `HttpRequestHandler.java`: `output.put("url", connection.getURL())`), which the plugin exposes
 * as `HttpResponse.url`. So instead of wrapping hls.js's own default loader, this calls that API
 * directly for playlist loads and trusts its `url` unconditionally — no guessing, no fallback.
 *
 * Used only as the *playlist* loader (`pLoader`); segment fetches need no fix since they're
 * already fully-qualified by the time hls.js requests them and carry no further URIs to resolve.
 */
export class NativePlaylistLoader implements Loader<PlaylistLoaderContext> {
  context: PlaylistLoaderContext | null = null;
  stats: LoaderStats = {
    aborted: false,
    loaded: 0,
    retry: 0,
    total: 0,
    chunkCount: 0,
    bwEstimate: 0,
    loading: { start: 0, first: 0, end: 0 },
    parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 },
  };

  private settled = false;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: HlsConfig) {}

  load(context: PlaylistLoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<PlaylistLoaderContext>): void {
    this.context = context;
    this.settled = false;
    this.stats.aborted = false;

    const startTime = self.performance.now();
    const maxLoadTimeMs = config.loadPolicy?.maxLoadTimeMs ?? 20_000;

    this.timeoutId = setTimeout(() => {
      if (this.settled) return;
      this.settled = true;
      callbacks.onTimeout(this.stats, context, null);
    }, maxLoadTimeMs);

    CapacitorHttp.get({
      url: context.url,
      headers: (context.headers as Record<string, string>) ?? {},
      responseType: 'text',
      connectTimeout: maxLoadTimeMs,
      readTimeout: maxLoadTimeMs,
    })
      .then((response) => {
        if (this.settled) return;
        this.settle();

        const data = typeof response.data === 'string' ? response.data : String(response.data ?? '');
        this.stats.loading = { start: startTime, first: startTime, end: self.performance.now() };
        this.stats.total = this.stats.loaded = data.length;

        if (response.status >= 200 && response.status < 300) {
          callbacks.onSuccess({ url: response.url || context.url, data, code: response.status }, this.stats, context, null);
        } else {
          callbacks.onError({ code: response.status, text: `HTTP ${response.status}` }, context, null, this.stats);
        }
      })
      .catch((error) => {
        if (this.settled) return;
        this.settle();
        callbacks.onError({ code: 0, text: error?.message ?? 'Network error' }, context, null, this.stats);
      });
  }

  abort(): void {
    this.stats.aborted = true;
    this.settle();
  }

  destroy(): void {
    this.settle();
  }

  getResponseHeader(): string | null {
    return null;
  }

  private settle(): void {
    this.settled = true;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
