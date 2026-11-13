import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

/**
 * Role check on every page, like the .NET controllers' MenuActionId checks
 * (which redirect to "DataNotAvailable"). Here we go to the dashboard with a message.
 */
export const accessGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.canAccessUrl(state.url)) return true;
  inject(ToastService).error("You don't have access to that page.");
  return inject(Router).createUrlTree(['/dashboard']);
};
