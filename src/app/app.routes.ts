import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'access/users',
        loadComponent: () => import('./features/access/users/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'access/roles',
        loadComponent: () => import('./features/access/roles/roles.page').then((m) => m.RolesPage),
      },
      {
        path: 'access/permissions',
        loadComponent: () =>
          import('./features/access/permissions/permissions.page').then((m) => m.PermissionsPage),
      },
      {
        path: 'settings/invoice-template',
        loadComponent: () =>
          import('./features/settings/invoice-template/invoice-template.page').then(
            (m) => m.InvoiceTemplatePage,
          ),
      },
      {
        path: 'settings/order-template',
        loadComponent: () =>
          import('./features/settings/order-template/order-template.page').then(
            (m) => m.OrderTemplatePage,
          ),
      },
      {
        path: 'settings/templates',
        loadComponent: () =>
          import('./features/settings/templates/templates.page').then((m) => m.TemplatesPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
