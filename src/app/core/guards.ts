import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { BillingService } from './billing.service';

/** Logged-in, approved members. Pending users go to /pending, anonymous users to /login. */
export const memberGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.parseUrl('/login');
  if (!auth.isActive()) return router.parseUrl('/pending');
  return true;
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() || inject(Router).parseUrl('/feed');
};

/** The "waiting for approval" page: only for logged-in users who are not active yet. */
export const pendingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.parseUrl('/login');
  if (auth.isActive()) return router.parseUrl('/feed');
  return true;
};

/**
 * Loads the entrance's billing status before the app opens. A trial that ended without a subscription
 * never blocks a page: the entrance is read-only and the shell shows a banner.
 */
export const subscriptionGuard: CanActivateChildFn = async () => {
  await inject(BillingService).ensureLoaded();
  return true;
};

/** Login/register: already logged-in users skip them. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.isLoggedIn() || inject(Router).parseUrl(auth.homeUrl());
};
