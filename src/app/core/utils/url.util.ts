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

/** True when the app origin is https but the target server is http — the browser will block this as mixed content. */
export function isMixedContentBlocked(serverUrl: string): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' && serverUrl.startsWith('http://');
}

/** True when this page itself is served over https — most IPTV panels are http-only, so connecting from here would hit mixed-content blocking. */
export function isRunningOverHttps(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

export function joinUrl(base: string, ...parts: Array<string | number>): string {
  const segments = parts.map((p) => String(p).replace(/^\/+|\/+$/g, ''));
  return [base.replace(/\/+$/, ''), ...segments].join('/');
}
