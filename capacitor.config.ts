import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lunivo.iptv',
  appName: 'Lunivo',
  webDir: 'dist/iptv-life-easy/browser',

  // Native networking, not the WebView's fetch/XHR — bypasses both CORS and the
  // browser mixed-content policy that blocks this app from reaching http-only IPTV
  // panels on the web. This patches window.fetch/XMLHttpRequest globally on native
  // platforms only, so every existing HttpClient call is covered with no interceptor
  // or platform-detection code needed; on web this config is simply inert.
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#091413',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },

  android: {
    // Target IPTV panels are user-supplied and predominantly http-only — we can't
    // know their domains ahead of time, so this allows cleartext traffic app-wide
    // rather than per-domain (mirrored by the iOS ATS exception below).
    allowMixedContent: true,
  },
};

export default config;
