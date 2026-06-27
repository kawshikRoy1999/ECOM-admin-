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
      {
        path: 'settings/templates/:id',
        loadComponent: () =>
          import('./features/settings/templates/template-builder.page').then(
            (m) => m.TemplateBuilderPage,
          ),
      },
      {
        path: 'settings/taxes',
        loadComponent: () =>
          import('./features/settings/taxes/taxes.page').then((m) => m.TaxesPage),
      },
      {
        path: 'settings/zones',
        loadComponent: () =>
          import('./features/settings/zones/zones.page').then((m) => m.ZonesPage),
      },
      {
        path: 'offers',
        loadComponent: () => import('./features/offers/offers.page').then((m) => m.OffersPage),
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/orders/orders-list.page').then((m) => m.OrdersListPage),
      },
      {
        path: 'orders/:id',
        loadComponent: () => import('./features/orders/order-detail.page').then((m) => m.OrderDetailPage),
      },
      {
        path: 'settings/notifications',
        loadComponent: () =>
          import('./features/settings/notifications/notifications.page').then((m) => m.NotificationsPage),
      },
      {
        path: 'settings/banners',
        loadComponent: () =>
          import('./features/settings/banners/banners.page').then((m) => m.BannersPage),
      },
      {
        path: 'settings/social',
        loadComponent: () =>
          import('./features/settings/social/social.page').then((m) => m.SocialPage),
      },
      {
        path: 'settings/locations',
        loadComponent: () =>
          import('./features/settings/locations/locations.page').then((m) => m.LocationsPage),
      },
      {
        path: 'settings/statuses',
        loadComponent: () =>
          import('./features/settings/statuses/statuses.page').then((m) => m.StatusesPage),
      },
      {
        path: 'settings/company',
        loadComponent: () =>
          import('./features/settings/company/company.page').then((m) => m.CompanyPage),
      },
      {
        path: 'reports/batch',
        loadComponent: () =>
          import('./features/reports/batch-report/batch-report.page').then(
            (m) => m.BatchReportPageComponent,
          ),
      },
      {
        path: 'catalog/categories',
        loadComponent: () =>
          import('./features/catalog/category/category.page').then((m) => m.CategoryPage),
      },
      {
        path: 'catalog/brands',
        redirectTo: 'catalog/categories',
        pathMatch: 'full',
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
