import { isMixedContentBlocked, joinUrl, normalizeServerUrl } from './url.util';

describe('normalizeServerUrl', () => {
  it('adds a scheme when missing', () => {
    expect(normalizeServerUrl('example.com')).toBe('http://example.com');
  });

  it('strips trailing slashes and any path', () => {
    expect(normalizeServerUrl('http://example.com/')).toBe('http://example.com');
    expect(normalizeServerUrl('http://example.com/player_api.php')).toBe('http://example.com');
  });

  it('preserves a custom port', () => {
    expect(normalizeServerUrl('https://example.com:8443')).toBe('https://example.com:8443');
  });

  it('rejects an empty value', () => {
    expect(() => normalizeServerUrl('  ')).toThrow();
  });

  it('rejects a non-http(s) scheme', () => {
    expect(() => normalizeServerUrl('ftp://example.com')).toThrow();
  });
});

describe('joinUrl', () => {
  it('joins segments without producing a double slash', () => {
    expect(joinUrl('http://example.com/', 'live', 'user', 'pass', 405191)).toBe('http://example.com/live/user/pass/405191');
  });
});

describe('isMixedContentBlocked', () => {
  it('flags an http server when the app itself is https', () => {
    Object.defineProperty(window, 'location', { value: { protocol: 'https:' }, writable: true });
    expect(isMixedContentBlocked('http://example.com')).toBe(true);
  });

  it('does not flag an http server when the app itself is http', () => {
    Object.defineProperty(window, 'location', { value: { protocol: 'http:' }, writable: true });
    expect(isMixedContentBlocked('http://example.com')).toBe(false);
  });
});
