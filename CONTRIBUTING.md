# Contributing to Lunivo-IPTV

Thanks for considering a contribution. This is a small, frontend-only, open-source project — no process overhead intended, just enough structure to keep things easy to review.

## Ways to contribute

- **Report a bug** you've hit using the app.
- **Report a provider quirk** — if you've tested this against an Xtream-Codes panel other than the one it was built against and something behaves differently, that's genuinely useful information even without a code fix attached.
- **Suggest a feature or improvement.**
- **Submit a pull request** — a bug fix, a new feature, a docs improvement, or broader provider compatibility.

## Before opening an issue

Read the [Known limitations](README.md#known-limitations-read-before-reporting-a-bug) and [Before you build against a different provider](README.md#before-you-build-against-a-different-provider) sections in the README first. MKV files that won't play in-browser, mixed-content errors on an HTTPS deploy against an HTTP-only server, and CORS failures from a provider that doesn't send `Access-Control-Allow-Origin` are all expected behavior of a frontend-only app talking to a server it doesn't control, not bugs in this app.

## Reporting a bug

[Open an issue](https://github.com/abdallahmmu/Lunivo-IPTV/issues/new) and include:

- What you did, what you expected, and what actually happened.
- Whether you're on the web app, Android, or iOS (and OS/browser version).
- Any error visible in the browser console (or `adb logcat` / Xcode console on mobile).
- Whether it reproduces against more than one Xtream provider, if you can check.

## Suggesting a feature

[Open an issue](https://github.com/abdallahmmu/Lunivo-IPTV/issues/new) describing the use case, not just the implementation — for anything non-trivial it's worth aligning on the approach before code gets written, so the PR doesn't have to be reworked from scratch in review.

## Submitting a pull request

1. Fork the repo and create a branch off `main` (`git checkout -b fix/short-description` or `feat/short-description`).
2. `npm install`, then make your changes.
3. Follow the conventions already in the codebase:
   - Standalone Angular components only — no `NgModule`s.
   - Signals for state (`signal`/`computed`), not `BehaviorSubject`-style services unless there's a reason.
   - Colors come from the five flat tokens defined in `src/styles.css` (`brand-primary`, `brand-secondary`, `brand-violet`, `brand-sky`, `brand-cyan`), used only with opacity modifiers (e.g. `bg-brand-primary/60`) for depth — never blended with `color-mix()` or one-off hex values.
   - Routes are lazy-loaded (`loadComponent`); new feature areas should follow the existing `features/<name>` structure.
4. Run the checks before pushing:
   ```bash
   npm test
   npm run build
   ```
5. Commit with a clear, specific message describing *why*, not just *what*.
6. Push your branch and open a pull request against `main`. Describe what changed and why, and link the related issue if there is one.
7. Be responsive to review feedback — small, focused PRs get reviewed faster than large ones.

## Development setup

```bash
npm install
npm start          # ng serve, http://localhost:4200
```

No environment variables or config files are needed — the app takes an IPTV server URL, username, and password at runtime through the login dialog. See the [Getting started](README.md#getting-started) section of the README for details, and [Mobile apps](README.md#mobile-apps-android--ios) if you're working on the Capacitor/Android/iOS side.
