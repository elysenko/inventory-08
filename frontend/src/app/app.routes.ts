import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { adminGuard, managerGuard } from './core/role.guard';

/**
 * Every navigable state of StockRoom has its own URL. Filters, wizard steps,
 * detail tabs and modals live in route or query params (never in component
 * memory) so a deep link and a hard refresh both land on the same screen.
 */
export const routes: Routes = [
  {
    path: 'login',
    data: { flow: 'auth.login' },
    loadComponent: () =>
      import('./auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    data: { flow: 'auth.signup' },
    loadComponent: () =>
      import('./auth/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: '403',
    data: { flow: 'forbidden' },
    loadComponent: () =>
      import('./shared/forbidden.component').then((m) => m.ForbiddenComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'items' },
      {
        path: 'items',
        data: { flow: 'items.list' },
        loadComponent: () =>
          import('./items/item-list.component').then((m) => m.ItemListComponent),
      },
      {
        path: 'items/:id',
        data: { flow: 'items.detail' },
        loadComponent: () =>
          import('./items/item-detail.component').then(
            (m) => m.ItemDetailComponent,
          ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'levels' },
          {
            path: 'levels',
            data: { flow: 'items.detail.levels' },
            loadComponent: () =>
              import('./items/item-levels.component').then(
                (m) => m.ItemLevelsComponent,
              ),
          },
          {
            path: 'movements',
            data: { flow: 'items.detail.movements' },
            loadComponent: () =>
              import('./items/item-movements.component').then(
                (m) => m.ItemMovementsComponent,
              ),
          },
        ],
      },
      {
        path: 'locations',
        data: { flow: 'locations.list' },
        canActivate: [managerGuard],
        loadComponent: () =>
          import('./locations/location-list.component').then(
            (m) => m.LocationListComponent,
          ),
      },
      {
        path: 'movements/new',
        data: { flow: 'movements.new' },
        loadComponent: () =>
          import('./movements/movement-new.component').then(
            (m) => m.MovementNewComponent,
          ),
      },
      {
        path: 'movements',
        data: { flow: 'movements.log' },
        canActivate: [managerGuard],
        loadComponent: () =>
          import('./movements/movement-log.component').then(
            (m) => m.MovementLogComponent,
          ),
      },
      {
        path: 'reports/low-stock',
        data: { flow: 'reports.lowStock' },
        canActivate: [managerGuard],
        loadComponent: () =>
          import('./reports/low-stock.component').then(
            (m) => m.LowStockComponent,
          ),
      },
      {
        path: 'admin/settings',
        data: { flow: 'admin.settings' },
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
