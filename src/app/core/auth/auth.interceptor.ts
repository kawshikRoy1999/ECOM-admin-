import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from './auth.service';
import { SKIP_AUTH } from './skip-auth';

/** Attaches the bearer token to outgoing API requests (unless SKIP_AUTH is set). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();

  if (!token || req.context.get(SKIP_AUTH)) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
