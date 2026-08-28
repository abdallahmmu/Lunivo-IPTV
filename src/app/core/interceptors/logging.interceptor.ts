import { HttpInterceptorFn } from '@angular/common/http';
import { tap } from 'rxjs';

/**
 * Dev-console visibility into IPTV API failures. Never rewrites or swallows
 * the error — user-facing messages are derived where the response shape is
 * actually known (see core/utils/xtream-error.util.ts), because this API's
 * error responses aren't consistent enough to normalize generically.
 */
export const loggingInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    tap({
      error: (error: unknown) => console.error(`[IPTV API] ${req.method} ${req.urlWithParams} failed`, error),
    }),
  );
