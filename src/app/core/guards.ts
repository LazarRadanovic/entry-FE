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
 * When the entrance's trial ended without a subscription, admins can only open /billing and
 * residents are sent to /locked.
 */
export const subscriptionGuard: CanActivateChildFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const billing = await inject(BillingService).ensureLoaded();
  if (!billing || billing.accessAllowed) return true;
  if (auth.isAdmin()) return state.url.startsWith('/billing') || router.parseUrl('/billing');
  return router.parseUrl('/locked');
};

/** The "subscription expired" page for residents: only while locked. */
export const lockedGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.parseUrl('/login');
  const billing = await inject(BillingService).ensureLoaded();
  return billing?.accessAllowed === false || router.parseUrl('/feed');
};

/** Login/register: already logged-in users skip them. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.isLoggedIn() || inject(Router).parseUrl(auth.homeUrl());
};
