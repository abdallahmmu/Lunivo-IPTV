# Lunivo-IPTV

**Lunivo — Your Streams. Your Screen. Your Way.**

A frontend-only Angular web player for Xtream-Codes-compatible IPTV providers. You enter your provider's server URL, username, and password through a login dialog on the landing page; the app talks directly to that server from your browser — there is no backend, proxy, or intermediary server of any kind.

```
Browser  ──────────────────────────►  Your IPTV provider's server
   ▲                                            │
   └──────────────── JSON / video streams ──────┘
```

## Before you build against a different provider

This app's API layer (`core/services`, `core/models`) was written from **real, live-tested responses** against one specific Xtream-Codes panel ("Xtream-Masters OTT Panel" v2.3.80), not from generic documentation. Most Xtream-compatible providers share the same shape, but a few things are genuinely provider-specific and worth knowing before you assume something is broken:

- **Numeric-looking fields in `user_info` come back as strings** (`"auth": "1"`, `"max_connections": "1"`, etc.) — the models reflect this.
- **Auth failures are not uniform.** Wrong password → HTTP 200 with a plain-text body (not JSON). Wrong username → HTTP 404 with *no* CORS headers, which your browser reports as a generic network failure indistinguishable from "server unreachable." Both are handled, but if your provider fails differently, check `core/utils/xtream-error.util.ts`.
- **EPG may simply be off.** The provider this was built against returns `{"epg_listings": []}` for every channel and an empty `xmltv.php`. The app treats an empty EPG response as "no program data" and hides Now/Next UI accordingly — it doesn't treat it as an error.
- **VOD/series container formats vary per item** (`container_extension` on each stream — `mp4`, `mkv`, `avi` were all observed on one provider). The playback URL always uses the real extension from the API, never a hardcoded one.

If you point this at a provider that deviates further, the most likely places to adjust are `core/services/iptv-api.service.ts` (which actions exist / what params they take) and `core/models/*.ts` (response shapes).

## Known limitations (read before reporting a "bug")

**MKV playback depends on your browser.** A meaningful share of most Xtream catalogs (roughly half, on the provider this was tested against) is encoded as `.mkv`. There is no backend here to transcode it, by design — the app plays it directly via a native `<video>` element. Some browsers can decode the video/audio inside an MKV container anyway; many can't and will show "Your browser can't play this file," with an option to open or copy the direct stream URL for an external player (VLC, etc.) instead. This is expected behavior, not a bug.

**HTTP-only providers + an HTTPS-hosted app = mixed content.** If you deploy this app over HTTPS but your IPTV server only serves HTTP (very common — many panels' HTTPS port isn't actually wired up), the browser will block every request as mixed content. The app detects this combination before attempting to connect and shows a clear error rather than a cryptic failure — but the underlying constraint is a browser security rule, not something this app can work around. Serve the app over HTTP too, or use a provider/URL that genuinely supports HTTPS.

**CORS is entirely up to your provider.** Every request — auth, catalog, and the video streams themselves — goes straight from your browser to your IPTV server. If that server doesn't send `Access-Control-Allow-Origin`, the browser will block it and there is no proxy here to route around that (see below — that's intentional). You'll see this as a "network / CORS" error at login, or as playback failures with no other symptoms.

## Why no backend, by default

This was an explicit requirement, not an oversight. A backend/proxy would trivially solve CORS and mixed-content issues, but it would also mean your IPTV credentials and stream traffic flow through a server you don't control. So, no exceptions:

- Every API call and every video stream goes straight from your browser to your IPTV server, always. There is no proxy anywhere in this app, deployed or local — nothing forwards `player_api.php` on your behalf, ever. (A JSON-only proxy was tried and reverted — it can't cover video playback, since streaming every byte of every stream through a serverless function isn't reasonable, so it only ever bought a working login followed by broken playback.)
- Credentials are entered by the user and live only in `AuthService`'s in-memory state, backed by `sessionStorage` (cleared when the tab closes) unless you check **Remember me**, in which case they're written to `localStorage` instead (survives browser restarts, on this device, until you disconnect or clear it).
- Nothing is sent anywhere except the server URL you typed in.
- If your provider doesn't support CORS or HTTPS, that's a real limitation of a frontend-only architecture — see above — and this app surfaces it honestly instead of quietly adding a server to paper over it. Practically: **the web app needs to be served over plain HTTP** to reach an HTTP-only IPTV panel (the vast majority of them) — run it locally, or self-host it over HTTP. A publicly-hosted HTTPS copy can only work with providers that themselves support HTTPS. The Android/iOS apps don't have this restriction at all (see below) — their WebView routes API calls through native networking, not the page's own fetch, so the page's own origin scheme is irrelevant there.

## Architecture

```
src/app/
├── core/
│   ├── models/        Xtream API response shapes (auth, live, vod, series, epg, library)
│   ├── services/       AuthService, IptvApiService, StreamService, EpgService,
│   │                    FavoritesService, HistoryService, SearchService, CacheService, StorageService
│   ├── guards/         authGuard / guestGuard
│   ├── interceptors/   dev-console logging for failed API calls
│   └── utils/          URL normalization, https-hosting detection, error mapping
├── layout/             MainLayout (topbar + responsive sidebar) wrapping every authenticated route
├── shared/
│   ├── components/     video-player, poster-card, channel-list-item, category-tabs,
│   │                    skeleton-loader, empty/error states, favorite-button, search-bar, progress-bar
│   ├── pipes/           duration, unixDate
│   └── directives/      image-fallback (broken poster/logo → placeholder), visible-on-scroll (infinite scroll)
└── features/            landing, home, live-tv, movies, series, favorites, history, search, settings
```

Every feature route is lazy-loaded (`loadComponent`). Catalog data (categories, streams, series, VOD info) is cached in memory per session via `CacheService`, with categories additionally persisted to `localStorage`; large stream/series lists deliberately are **not** persisted to `localStorage` to avoid quota issues on catalogs with tens of thousands of items. Movies/series grids load 60 items at a time and fetch more as you scroll (`VisibleOnScrollDirective`); the live-channel list uses CDK virtual scrolling since a single "All" category can be several thousand channels.

Stream URLs are built in exactly one place — `StreamService` — using the pattern verified against a real server: `/live/{user}/{pass}/{id}.m3u8`, `/movie/{user}/{pass}/{id}.{ext}`, `/series/{user}/{pass}/{episodeId}.{ext}`, where `{ext}` always comes from the API's own `container_extension` field.

The video player prefers **hls.js** for HLS streams over the browser's native HLS support. This matters: some Chromium builds report `canPlayType('application/vnd.apple.mpegurl')` as `"maybe"` without actually being able to play it, which silently breaks playback if trusted first — confirmed while testing this app against a live stream. hls.js is only skipped in favor of native `<video>` on browsers where `Hls.isSupported()` is false (Safari/iOS).

## Getting started

```bash
npm install
npm start        # ng serve, http://localhost:4200
```

Open the app, click "Connect to your IPTV" on the landing page, and enter your provider's server URL, username, and password in the dialog. No configuration or environment variables are needed — everything is provided at runtime through that form.

**If your provider's requests fail on `localhost` with what looks like a `521`/unreachable error even though `curl` to the same URL works fine:** Chrome is silently rewriting that domain's requests from `http://` to `https://` before they ever hit the network — driven by a real DNS `HTTPS` record the provider's CDN publishes (confirmed via `dig <domain> HTTPS`), not by a cached per-profile decision, so it isn't something `chrome://net-internals/#hsts` has anything to delete and it will recur on every request, every session. Many HTTP-only IPTV panels' HTTPS port isn't actually wired up, so the rewritten request fails upstream (`521`, or a raw connection failure). This can't be detected or worked around from app code — it's decided by Chrome's network stack before the page's JS ever sees the request, and it's a race against Chrome's own DNS lookup, so it doesn't even happen consistently (Chrome feature flags that are supposed to disable it, like `--disable-features=HttpsUpgrades,UseDnsHttpsSvcbAlpn`, only worked ~1 in 3 tries when we measured it — not good enough to rely on).

Fix: `npm run dev:chrome` launches a disposable Chrome profile (`scripts/dev-chrome.sh`; separate from your main one, no reset needed) pointed at `http://localhost:4200`. Set `IPTV_HOST` to your provider's domain and it resolves that domain's real IP once via `dig` and passes Chrome `--host-resolver-rules="MAP <host> <ip>"` — this is what's actually reliable (5/5 in repeated live testing, vs. the flaky feature-flag approach above), since it makes Chrome connect straight to the IP without ever doing the DNS lookup that triggers the upgrade:
```bash
IPTV_HOST=mvo25.in npm run dev:chrome
```
Without `IPTV_HOST` set, it just launches a clean profile with no override — fine for providers that don't trigger this at all.

If a window from that profile is already open when you run it again, the script kills it first — command-line flags (including the host override) only take effect on a cold start, and a reused process would silently keep whatever flags it originally launched with.

```bash
npm run build     # production build to dist/
npm test          # unit tests (Vitest)
```

## Mobile apps (Android / iOS)

The same Angular codebase ships as native Android and iOS apps via [Capacitor](https://capacitorjs.com/), wrapping the built web app in a native shell rather than maintaining a second codebase.

```bash
npm run cap:sync      # build the web app and sync it into android/ and ios/
npm run cap:android   # build, sync, and open the project in Android Studio
npm run cap:ios       # build, sync, and open the project in Xcode
```

A few things behave differently on native than on web:

- **API calls** go through `@capacitor/core`'s `CapacitorHttp` plugin (configured in `capacitor.config.ts`), which transparently patches `fetch`/`XMLHttpRequest` to use native networking instead of the WebView's — this is what lets the app reach HTTP-only IPTV panels from inside an HTTPS-origin WebView without the mixed-content restriction ever coming into play, and without any platform-detection code in the app itself.
- **Direct (non-HLS) video playback on Android** goes through a small loopback relay (`android/app/src/main/java/com/lunivo/iptv/LocalVideoRelayServer.java`, embedded via [NanoHTTPD](https://github.com/NanoHttpd/nanohttpd)) bound to `127.0.0.1`. `<video>` elements load media directly rather than through `fetch`/`XHR`, so `CapacitorHttp`'s patch doesn't cover them, and some WebView versions still block mixed-content media loads even with `allowMixedContent` set — a loopback origin sidesteps both. This only exists on Android; `<video>` playback on iOS goes straight to the provider.
- Android additionally sets `android:usesCleartextTraffic="true"`, and iOS sets `NSAppTransportSecurity` / `NSAllowsArbitraryLoads`, since most Xtream panels are HTTP-only and both platforms block cleartext networking by default.

## Contributing

Contributions are welcome — bug reports, provider-compatibility notes, feature ideas, and pull requests all help.

- **Found a bug?** Check the [Known limitations](#known-limitations-read-before-reporting-a-bug) section above first — MKV playback, mixed content, and CORS failures are usually the provider, not this app. If it's still a real bug, [open an issue](https://github.com/abdallahmmu/Lunivo-IPTV/issues/new) with steps to reproduce, your browser/OS (or Android/iOS version if on the mobile app), and any console errors.
- **Have an idea?** [Open an issue](https://github.com/abdallahmmu/Lunivo-IPTV/issues/new) describing the use case before writing code for anything non-trivial, so we can align on approach first.
- **Want to fix something yourself?** Pull requests are very welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow (fork, branch, coding conventions, and how to submit the PR).

## License

[MIT](LICENSE) — use it, fork it, ship it.
