import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { BillingService } from './billing.service';

const isAuthCall = (req: HttpRequest<unknown>) => req.url.startsWith('/api/auth/');

/** Adds the bearer token; on 401 refreshes once and retries, otherwise sends the user to /login. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const billing = inject(BillingService);

  if (!req.url.startsWith('/api/') || isAuthCall(req)) {
    return next(req);
  }

  const withToken = (token: string | null) =>
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(withToken(auth.accessToken)).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 402) {
        // trial over, no subscription: refresh the status and let the guard pick the right page
        billing.clear();
        router.navigateByUrl(auth.isAdmin() ? '/billing' : '/locked');
        return throwError(() => err);
      }
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        switchMap((token) => {
          if (!token) {
            router.navigateByUrl('/login');
            return throwError(() => err);
          }
          return next(withToken(token));
        }),
      );
    }),
  );
};
