import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/** Endpoints that legitimately answer 401/403 as part of their normal contract. */
function isAuthEndpoint(url: string): boolean {
  return url.includes('/api/auth/login') || url.includes('/api/auth/signup');
}

/**
 * Attaches the bearer token to every API call and gives the two rejection
 * codes a single, predictable landing spot:
 *
 *  - 401 — the token is missing, expired or no longer matches a user. The
 *    stored session is dropped and the user is sent to /login with a returnUrl
 *    so they resume where they were. Login/signup are exempt: their 401 is the
 *    "wrong password" answer, which the form renders inline.
 *  - 403 — authenticated but out of role (a clerk reaching a manager-only
 *    endpoint). The session stays valid; the user lands on /403.
 *
 * The error is always re-thrown so callers still render their own inline
 * message; this only handles the navigation side-effect.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.token();
  const request =
    token && req.url.startsWith('/api')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && !isAuthEndpoint(req.url)) {
        if (error.status === 401) {
          auth.expireSession(router.url);
        } else if (error.status === 403) {
          void router.navigate(['/403']);
        }
      }
      return throwError(() => error);
    }),
  );
};
