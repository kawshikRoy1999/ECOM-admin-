import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { IMAGE_CONFIG } from '@angular/common';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/api/error.interceptor';
import { GlobalErrorHandler } from './core/api/global-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      // Logos, brand/category art and product media are uploaded by each company
      // and served from the image host at their original size, so we can't
      // control their intrinsic dimensions from here. Angular's dev-only
      // oversized-image check (NG0913) fires on every one of them and drowns out
      // real console output.
      provide: IMAGE_CONFIG,
      useValue: { disableImageSizeWarning: true, disableImageLazyLoadWarning: true },
    },
  ],
};
