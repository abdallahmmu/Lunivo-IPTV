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

/** True when this page itself is served over https (and isn't the native shell) — most IPTV panels
 *  are http-only, so a direct call from a real https browser tab would be blocked as mixed content.
 *  There's no server-side workaround for this — even a JSON-API proxy can't cover video playback
 *  (streaming every byte of every stream through a serverless function isn't reasonable), so a
 *  proxy would only get you a working login and then broken playback. Run the app over http
 *  instead (locally, or self-hosted), or use the native Android/iOS app, whose WebView routes API
 *  calls through native networking (CapacitorHttp) rather than the page's own fetch/XHR, so the
 *  page's own origin scheme doesn't matter there. */
export function isRunningOverHttps(): boolean {
  if (Capacitor.isNativePlatform()) return false;
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

/** The player_api.php URL for a given server — always called directly from the browser, no proxy. */
export function playerApiUrl(serverUrl: string): string {
  return `${serverUrl}/player_api.php`;
}

export function joinUrl(base: string, ...parts: Array<string | number>): string {
  const segments = parts.map((p) => String(p).replace(/^\/+|\/+$/g, ''));
  return [base.replace(/\/+$/, ''), ...segments].join('/');
}
