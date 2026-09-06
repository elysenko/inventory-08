import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Gate for everything inside the shell. Redirects at most once and never from
 * the login route itself, so a guard <-> shell redirect loop is impossible.
 * Under a preview build the session is always seeded, so this passes through
 * and a cold deep link renders the screen it addresses.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
