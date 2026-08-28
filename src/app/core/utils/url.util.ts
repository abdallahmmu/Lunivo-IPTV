import { Capacitor } from '@capacitor/core';

/**
 * Normalizes a user-entered IPTV server URL: adds a scheme if missing,
 * strips any path/query/hash and trailing slashes, and preserves a custom port.
 * Throws for input that isn't a usable absolute URL.
 */
export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Server URL is required.');
  }

  const withScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error('That server URL doesn\'t look valid.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('The server URL must use http:// or https://.');
  }
  if (!parsed.hostname) {
    throw new Error('That server URL doesn\'t look valid.');
  }

  return `${parsed.protocol}//${parsed.host}`;
}

/**
 * True when the app origin is https but the target server is http — the browser will block this
 * as mixed content. Always false inside the native Capacitor shell: its WebView reports a synthetic
 * `https://localhost` origin, but CapacitorHttp routes these calls through native networking (not
 * the WebView's fetch/XHR), which was never subject to the browser's mixed-content policy in the
 * first place — so there's nothing to route around, and the (web-only) /api/proxy below isn't even
 * reachable from inside the native shell.
 */
export function isMixedContentBlocked(serverUrl: string): boolean {
  if (Capacitor.isNativePlatform()) return false;
  return typeof window !== 'undefined' && window.location.protocol === 'https:' && serverUrl.startsWith('http://');
}

/** True when this page itself is served over https (and isn't the native shell) — most IPTV panels
 *  are http-only, so connecting from a real browser tab here would hit mixed-content blocking. */
export function isRunningOverHttps(): boolean {
  if (Capacitor.isNativePlatform()) return false;
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

/**
 * Resolves where an HttpClient call to player_api.php should actually go: directly to
 * the server normally, or through our own same-origin /api/proxy (which forwards it
 * server-side) when this page is https and the server is http — mixed content would
 * otherwise block that call before it ever left the browser. Merge the returned
 * `params` straight into the request; the proxy only ever forwards to player_api.php.
 */
export function playerApiRequest(serverUrl: string, params: Record<string, string>): { url: string; params: Record<string, string> } {
  if (isMixedContentBlocked(serverUrl)) {
    return { url: '/api/proxy', params: { ...params, target: serverUrl } };
  }
  return { url: `${serverUrl}/player_api.php`, params };
}

export function joinUrl(base: string, ...parts: Array<string | number>): string {
  const segments = parts.map((p) => String(p).replace(/^\/+|\/+$/g, ''));
  return [base.replace(/\/+$/, ''), ...segments].join('/');
}
