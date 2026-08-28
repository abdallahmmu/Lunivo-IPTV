package com.lunivo.iptv;

import android.util.Log;
import fi.iki.elonen.NanoHTTPD;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Local loopback relay for <video> playback on Android.
 *
 * The WebView's <video> element loads media directly rather than through fetch/XMLHttpRequest,
 * so CapacitorHttp's global network patch (see capacitor.config.ts) doesn't cover it — and on
 * some WebView versions, Android's mixed-content policy still blocks an https-origin page from
 * loading an http:// video even with allowMixedContent enabled.
 *
 * 127.0.0.1 is a "potentially trustworthy" origin per the mixed-content spec, so relaying
 * through here sidesteps the restriction entirely: this server fetches the real (often http://)
 * stream via native networking — the same approach CapacitorHttp already uses for API calls —
 * and re-serves it locally, forwarding the Range header both ways so seeking/buffering behave
 * exactly as if the WebView were talking to the origin server directly.
 */
public class LocalVideoRelayServer extends NanoHTTPD {
    private static final String TAG = "LocalVideoRelay";
    public static final int PORT = 8098;
    private static final int TIMEOUT_MS = 15000;

    public LocalVideoRelayServer() {
        super("127.0.0.1", PORT);
    }

    @Override
    public Response serve(IHTTPSession session) {
        // The WebView loads this relay with crossOrigin="anonymous" (see video-player.ts, needed
        // for the Web Audio gain graph), so every request — including the actual GET — is subject
        // to CORS, and a Range header (used for seeking) isn't CORS-safelisted, so the browser
        // preflights it with OPTIONS first. Without these headers the browser blocks the response
        // even though the relay itself succeeded.
        if (Method.OPTIONS.equals(session.getMethod())) {
            Response preflight = newFixedLengthResponse(Response.Status.NO_CONTENT, "text/plain", "");
            addCorsHeaders(preflight);
            preflight.addHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
            preflight.addHeader("Access-Control-Allow-Headers", "Range, Content-Type");
            preflight.addHeader("Access-Control-Max-Age", "86400");
            return preflight;
        }

        Map<String, String> params = session.getParms();
        String target = params.get("url");
        if (target == null || target.isEmpty()) {
            return corsResponse(Response.Status.BAD_REQUEST, "Missing url param");
        }

        String decoded;
        try {
            decoded = URLDecoder.decode(target, StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            return corsResponse(Response.Status.BAD_REQUEST, "Invalid url param");
        }

        if (!decoded.startsWith("http://") && !decoded.startsWith("https://")) {
            return corsResponse(Response.Status.BAD_REQUEST, "Only http/https targets are allowed");
        }

        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(decoded).openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(TIMEOUT_MS);
            conn.setReadTimeout(TIMEOUT_MS);

            String range = session.getHeaders().get("range");
            if (range != null) {
                conn.setRequestProperty("Range", range);
            }
            String userAgent = session.getHeaders().get("user-agent");
            conn.setRequestProperty("User-Agent", userAgent != null ? userAgent : "Mozilla/5.0");

            int upstreamStatus = conn.getResponseCode();
            InputStream body = upstreamStatus >= 400 ? conn.getErrorStream() : conn.getInputStream();
            if (body == null) {
                return corsResponse(Response.Status.INTERNAL_ERROR, "No response body from upstream");
            }

            String contentType = conn.getContentType();
            if (contentType == null) contentType = "video/mp4";

            long length = conn.getContentLengthLong();
            Response.IStatus status = upstreamStatus == 206 ? Response.Status.PARTIAL_CONTENT : Response.Status.OK;
            Response response = length >= 0
                ? newFixedLengthResponse(status, contentType, body, length)
                : newChunkedResponse(status, contentType, body);

            String contentRange = conn.getHeaderField("Content-Range");
            if (contentRange != null) {
                response.addHeader("Content-Range", contentRange);
            }
            response.addHeader("Accept-Ranges", "bytes");
            addCorsHeaders(response);
            response.addHeader("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length");
            return response;
            // Not calling conn.disconnect() here — NanoHTTPD reads `body` lazily while streaming the
            // response to the client after serve() returns, so closing the connection early would
            // truncate playback.
        } catch (IOException e) {
            Log.e(TAG, "relay failed for " + decoded, e);
            return corsResponse(Response.Status.INTERNAL_ERROR, "Upstream request failed: " + e.getMessage());
        }
    }

    private Response corsResponse(Response.IStatus status, String message) {
        Response response = newFixedLengthResponse(status, "text/plain", message);
        addCorsHeaders(response);
        return response;
    }

    private void addCorsHeaders(Response response) {
        response.addHeader("Access-Control-Allow-Origin", "*");
    }
}
