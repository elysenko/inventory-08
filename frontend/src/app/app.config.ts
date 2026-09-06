import { ApplicationConfig } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      // Query/route params bind straight onto component inputs, which is what
      // keeps filters, wizard steps and modal state addressable by URL.
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      // Child tab routes need the parent's `:id`, so params flow all the way down.
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
    ),
    // Bearer token on the way out; 401 -> /login and 403 -> /403 on the way back.
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
  ],
};
