import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.waitUntilReady();
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/login']);
};

/**
 * Shell = logged-in customer with profile.
 * Unbound Firebase session without signup gate → login (do not wipe a valid lasting session on transient errors).
 */
export const customerProfileGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.waitUntilReady();
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);

  if (!auth.hasCustomerProfile()) {
    try {
      await auth.refreshProfile();
    } catch {
      /* network blip — keep session; don't force logout */
    }
  }

  if (auth.hasCustomerProfile()) return true;

  if (auth.canAccessSignup()) return router.createUrlTree(['/signup']);

  // Unbound leftover Firebase user with no signup gate → clear and re-OTP
  await auth.logout();
  return router.createUrlTree(['/login']);
};

/**
 * Login is for guests only. Never block the form on Firebase —
 * show UI immediately; redirect once auth resolves.
 */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const redirectIfAuthed = async () => {
    await auth.waitUntilReady();
    if (!auth.isLoggedIn()) return;

    if (!auth.hasCustomerProfile()) {
      try {
        await auth.refreshProfile();
      } catch {
        /* keep session on transient API failure */
      }
    }

    if (auth.hasCustomerProfile()) {
      void router.navigateByUrl('/home');
      return;
    }
    if (auth.canAccessSignup()) {
      void router.navigateByUrl('/signup');
      return;
    }

    await auth.logout();
  };

  if (auth.authReady()) {
    if (!auth.isLoggedIn()) return true;
    if (auth.hasCustomerProfile()) return router.createUrlTree(['/home']);
    if (auth.canAccessSignup()) return router.createUrlTree(['/signup']);
  }

  void redirectIfAuthed();
  return true;
};

/**
 * /signup is NOT a landing page.
 * Allowed only after OTP when needsProfile (session gate).
 * Direct visits → /login.
 */
export const signupGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.waitUntilReady();

  if (!auth.isLoggedIn()) {
    auth.clearOtpSignupGate();
    return router.createUrlTree(['/login']);
  }

  if (!auth.hasCustomerProfile()) {
    try {
      await auth.refreshProfile();
    } catch {
      /* ignore */
    }
  }

  if (auth.hasCustomerProfile()) {
    auth.clearOtpSignupGate();
    return router.createUrlTree(['/home']);
  }

  if (!auth.canAccessSignup()) {
    await auth.logout();
    return router.createUrlTree(['/login']);
  }

  return true;
};
