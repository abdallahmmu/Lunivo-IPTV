import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Server-side forwarder for player_api.php, deployed as a Vercel serverless function.
 *
 * Exists only so this app's own https deploy can talk to a visitor's http-only IPTV
 * panel — browsers block that as mixed content when called directly from the client,
 * but a server-to-server request isn't subject to that restriction. Scoped tightly:
 * only ever forwards GET requests to `<target>/player_api.php` for a known allow-list
 * of Xtream actions, and refuses private/loopback targets to avoid becoming an open
 * SSRF relay into Vercel's own network.
 *
 * Not used for video playback — streams still load directly from the IPTV server.
 */

interface VercelLikeRequest extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
}

const UPSTREAM_TIMEOUT_MS = 9000; // stay under Vercel Hobby's ~10s function ceiling

// Every action this app's IptvApiService actually calls. `undefined` covers the
// bare login request (username/password, no `action` param).
const ALLOWED_ACTIONS = new Set([
  'get_live_categories',
  'get_live_streams',
  'get_vod_categories',
  'get_vod_streams',
  'get_vod_info',
  'get_series_categories',
  'get_series',
  'get_series_info',
  'get_short_epg',
]);

export default async function handler(req: VercelLikeRequest, res: ServerResponse): Promise<void> {
  const send = (status: number, body: unknown): void => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  };

  if (req.method !== 'GET') {
    send(405, { error: 'Method not allowed.' });
    return;
  }

  const { target, ...rest } = req.query;
  const targetUrl = firstValue(target);
  if (!targetUrl) {
    send(400, { error: 'Missing "target" query param.' });
    return;
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    send(400, { error: 'Invalid target URL.' });
    return;
  }

  if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
    send(400, { error: 'Only http/https targets are allowed.' });
    return;
  }
  if (isPrivateHostname(parsedTarget.hostname)) {
    send(400, { error: 'Refusing to proxy to a private/internal address.' });
    return;
  }

  const action = firstValue(rest['action']);
  if (action !== undefined && !ALLOWED_ACTIONS.has(action)) {
    send(400, { error: `Unsupported action: ${action}` });
    return;
  }

  const forwardUrl = new URL('/player_api.php', parsedTarget.origin);
  for (const [key, value] of Object.entries(rest)) {
    const v = firstValue(value);
    if (v !== undefined) forwardUrl.searchParams.set(key, v);
  }

  try {
    const upstream = await fetch(forwardUrl.toString(), { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    const body = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json');
    res.end(body);
  } catch {
    send(502, { error: 'The upstream IPTV server request failed or timed out.' });
  }
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true;

  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 — link-local & cloud metadata
  if (a === 127) return true; // 127.0.0.0/8
  return false;
}
