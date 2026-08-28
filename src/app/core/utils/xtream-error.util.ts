import { HttpErrorResponse } from '@angular/common/http';
import { AppError } from '../models/common.models';

/**
 * Maps a failed HTTP call against the IPTV server to a human-readable AppError.
 *
 * Verified against a real Xtream-Masters panel, this API's failure modes are
 * inconsistent (see project memory "IPTV API discovery"):
 *  - wrong password  -> HTTP 200 / application/json header, but a plain-text
 *    body ("Invalid Authorization or URL / 404 Error."). Angular's HttpClient
 *    treats the JSON-parse failure as an error and stashes the raw text at
 *    `error.error.text`.
 *  - wrong username  -> HTTP 404 with no CORS headers at all, which a browser
 *    reports as an opaque network failure (status 0) — indistinguishable from
 *    a real connectivity/CORS problem.
 *  - empty creds     -> non-standard HTTP 512 with a valid `{user_info:{auth:"0"}}` body.
 * so this mapper treats status 0 and the non-JSON-200 case as "likely invalid
 * credentials or unreachable" rather than pretending certainty it doesn't have.
 */
export function mapAuthError(error: unknown): AppError {
  if (!(error instanceof HttpErrorResponse)) {
    return { message: 'Something unexpected went wrong. Please try again.', code: 'unknown' };
  }

  if (error.status === 0) {
    return {
      message:
        'Could not reach the server. Check the server URL, your network connection, and that the ' +
        'server allows browser (CORS) requests — invalid credentials can also produce this exact error.',
      code: 'network',
    };
  }

  // Angular's JSON parse failure shape: { error: SyntaxError, text: string }
  const parseFailureText = (error.error as { text?: unknown } | null)?.text;
  if (typeof parseFailureText === 'string') {
    return { message: 'Invalid username or password.', code: 'invalid_credentials', status: error.status };
  }

  const body = error.error as { user_info?: { auth?: string | number } } | null;
  if (body?.user_info && String(body.user_info.auth) === '0') {
    return { message: 'Invalid username or password.', code: 'invalid_credentials', status: error.status };
  }

  if (error.status === 401 || error.status === 403) {
    return { message: 'Invalid username or password.', code: 'invalid_credentials', status: error.status };
  }
  if (error.status === 404) {
    return {
      message: 'Server did not recognize this account. Double-check the username, or the server URL.',
      code: 'invalid_credentials',
      status: 404,
    };
  }
  if (error.status === 429) {
    return { message: 'Too many requests. Please wait a moment and try again.', code: 'server_error', status: 429 };
  }
  if (error.status >= 500) {
    return { message: 'The IPTV server is having problems right now. Please try again shortly.', code: 'server_error', status: error.status };
  }

  return { message: `Connection failed (HTTP ${error.status}).`, code: 'unknown', status: error.status };
}

export function mapGenericApiError(error: unknown): AppError {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return { message: 'Lost connection to the IPTV server.', code: 'network' };
    }
    if (error.status >= 500) {
      return { message: 'The IPTV server is having problems right now.', code: 'server_error', status: error.status };
    }
    return { message: `Request failed (HTTP ${error.status}).`, code: 'unknown', status: error.status };
  }
  return { message: 'Something unexpected went wrong.', code: 'unknown' };
}
