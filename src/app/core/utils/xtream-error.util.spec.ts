import { HttpErrorResponse } from '@angular/common/http';
import { mapAuthError, mapGenericApiError } from './xtream-error.util';

describe('mapAuthError', () => {
  it('treats a status-0 failure as an unreachable/invalid-credentials network error', () => {
    const error = new HttpErrorResponse({ status: 0 });
    expect(mapAuthError(error).code).toBe('network');
  });

  it('treats the non-JSON HTTP 200 auth-failure body as invalid credentials', () => {
    // Reproduces the real Xtream-Masters behavior: wrong password returns HTTP 200 with a
    // plain-text body, which Angular's HttpClient surfaces as a JSON-parse failure.
    const error = new HttpErrorResponse({ status: 200, error: { text: 'Invalid Authorization or URL / 404 Error.' } });
    expect(mapAuthError(error).code).toBe('invalid_credentials');
  });

  it('treats a valid JSON body with auth:"0" as invalid credentials', () => {
    const error = new HttpErrorResponse({ status: 512, error: { user_info: { auth: '0' } } });
    expect(mapAuthError(error).code).toBe('invalid_credentials');
  });

  it('treats a 5xx as a server error', () => {
    const error = new HttpErrorResponse({ status: 502 });
    expect(mapAuthError(error).code).toBe('server_error');
  });

  it('falls back to unknown for a non-HTTP error', () => {
    expect(mapAuthError(new Error('boom')).code).toBe('unknown');
  });
});

describe('mapGenericApiError', () => {
  it('maps status 0 to a network error', () => {
    expect(mapGenericApiError(new HttpErrorResponse({ status: 0 })).code).toBe('network');
  });

  it('maps 5xx to a server error', () => {
    expect(mapGenericApiError(new HttpErrorResponse({ status: 503 })).code).toBe('server_error');
  });
});
