import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { ToastService } from '../../shared/ui/toast/toast.service';

/** Surfaces transport errors as toasts and bounces to /login on 401. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        router.navigateByUrl('/login');
      } else if (err.status === 0) {
        toast.error('Cannot reach the server. Check your connection.');
      } else {
        toast.error(err.error?.message || err.message || 'Request failed.');
      }
      return throwError(() => err);
    }),
  );
};
