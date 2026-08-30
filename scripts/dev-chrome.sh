#!/usr/bin/env bash
# Launches a disposable Chrome profile for local dev, pointed at http://localhost:4200,
# with Chrome's DNS-HTTPS-record-driven http->https auto-upgrade suppressed for your
# IPTV provider's domain. See README.md ("If your provider's requests fail on localhost...")
# for why this exists.
#
# Usage:
#   IPTV_HOST=mvo25.in npm run dev:chrome
#
# If IPTV_HOST isn't set, Chrome launches with no host override — fine for providers
# that don't trigger the upgrade, but won't help the ones that do.
set -euo pipefail

PROFILE_GLOB="/tmp/lunivo-chrome-dev*"
pkill -f "user-data-dir=${PROFILE_GLOB}" 2>/dev/null || true
sleep 1
DIR=$(mktemp -d /tmp/lunivo-chrome-dev.XXXXXX)

ARGS=(--user-data-dir="$DIR")

if [ -n "${IPTV_HOST:-}" ]; then
  IP=$(dig +short "$IPTV_HOST" A | head -1)
  if [ -n "$IP" ]; then
    echo "dev:chrome — routing $IPTV_HOST to $IP directly, bypassing its DNS HTTPS record"
    ARGS+=(--host-resolver-rules="MAP $IPTV_HOST $IP")
  else
    echo "dev:chrome — could not resolve IPTV_HOST=$IPTV_HOST, launching without an override"
  fi
fi

case "$(uname -s)" in
  Darwin)
    open -na "Google Chrome" --args "${ARGS[@]}" "http://localhost:4200"
    ;;
  *)
    CHROME_BIN=$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)
    if [ -z "$CHROME_BIN" ]; then
      echo "Could not find a Chrome/Chromium binary on PATH. Launch it manually with:" >&2
      echo "  --user-data-dir=$DIR ${ARGS[*]:1} http://localhost:4200" >&2
      exit 1
    fi
    "$CHROME_BIN" "${ARGS[@]}" "http://localhost:4200" &
    ;;
esac
