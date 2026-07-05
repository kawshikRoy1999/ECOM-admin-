import { Component, inject, signal, computed, PLATFORM_ID, HostListener } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';

import { AuthService } from '../core/auth/auth.service';
import { TooltipService } from '../shared/ui/tooltip.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  info?: string;
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
})
export class AdminLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly tooltip = inject(TooltipService);

  readonly displayName = this.auth.displayName;
  readonly logoUrl = this.auth.logoUrl;
  readonly sidebarOpen = signal(false);
  readonly lgScreen = signal(false);
  readonly tooltipState = this.tooltip.state;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
    }
    this.router.events.subscribe(() => {
      this.hideTooltip();
    });
  }

  @HostListener('window:resize')
  checkScreenSize(): void {
    const isLg = window.innerWidth >= 1024;
    this.lgScreen.set(isLg);
    if (isLg) {
      this.sidebarOpen.set(true);
    } else {
      this.sidebarOpen.set(false);
    }
  }

  // Static for now; will be replaced by the DB-driven menu on the shell day.
  // Ordering: daily operations first (catalog → sales → marketing → reports),
  // then store configuration (setup → design), then admin (access → system).
  // Icons are Heroicons (outline) single-path `d` strings rendered generically.
  readonly nav: { group: string; items: NavItem[] }[] = [
    {
      group: 'Overview',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', info: 'View overall store performance metrics and sales statistics.' },
      ],
    },
    {
      group: 'Catalog',
      items: [
        { label: 'Items & Inventory', path: '/catalog/items', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', info: 'Manage products, pricing, variants, and media.' },
        { label: 'Categories & Brands', path: '/catalog/categories', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z', info: 'Manage categories hierarchy and product brands.' },
        { label: 'Review Approval', path: '/catalog/reviews', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', info: 'Moderate and approve customer product reviews.' },
      ],
    },
    {
      group: 'Sales',
      items: [
        { label: 'Orders', path: '/orders', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', info: 'Review and manage customer orders.' },
      ],
    },
    {
      group: 'Marketing',
      items: [
        { label: 'Offers', path: '/offers', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z', info: 'Manage coupon codes and discount criteria.' },
        { label: 'Banners', path: '/settings/banners', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', info: 'Configure marketing slideshows and promo images.' },
      ],
    },
    {
      group: 'Reports',
      items: [
        { label: 'Batch Report', path: '/reports/batch', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', info: 'Item-wise stock and batch report with filters.' },
      ],
    },
    {
      group: 'Store Setup',
      items: [
        { label: 'Locations', path: '/settings/locations', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z', info: 'Configure warehouses, coordinates, and storage bins.' },
        { label: 'Taxes', path: '/settings/taxes', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', info: 'Set tax rates and financial calculation slabs.' },
        { label: 'Zones', path: '/settings/zones', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', info: 'Define delivery shipping boundaries and zip codes.' },
      ],
    },
    {
      group: 'Design & Layout',
      items: [
        { label: 'Store Front Template', path: '/settings/templates', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', info: 'Customize storefront sections layout and theme colors.' },
        { label: 'Invoice Template', path: '/settings/invoice-template', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', info: 'Configure print styling and content switches for invoices.' },
        { label: 'Order Template', path: '/settings/order-template', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', info: 'Design and customize customer order confirmations.' },
      ],
    },
    {
      group: 'Access Control',
      items: [
        { label: 'Users', path: '/access/users', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', info: 'Manage administrative user accounts and credentials.' },
        { label: 'Roles', path: '/access/roles', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', info: 'Configure user access roles and responsibilities.' },
        { label: 'Permissions', path: '/access/permissions', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z', info: 'Assign module permissions and access control matrices.' },
      ],
    },
    {
      group: 'System Settings',
      items: [
        { label: 'Company', path: '/settings/company', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', info: 'Edit company profile, contact, tax, and branding.' },
        { label: 'Notifications', path: '/settings/notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', info: 'Set up SMTP mail and SMS gateways.' },
        { label: 'Social Links', path: '/settings/social', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', info: 'Set storefront social profiles and contact details.' },
        { label: 'Order Statuses', path: '/settings/statuses', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z', info: 'Customize order status labels and cancellation reasons.' },
      ],
    },
  ];

  /**
   * Maps each nav route to the .NET menu name/url tokens used for role-based access.
   * A nav item is shown when any of its tokens matches a permitted menu (see
   * AuthService.canAccess). Fail-open when the session has no permission data.
   */
  private readonly menuTokens: Record<string, string[]> = {
    '/dashboard': ['dashboard'],
    '/catalog/items': ['item', 'inventory'],
    '/catalog/categories': ['category', 'brand'],
    '/catalog/reviews': ['review'],
    '/orders': ['order'],
    '/offers': ['offer'],
    '/settings/banners': ['banner'],
    '/reports/batch': ['batch'],
    '/settings/locations': ['location'],
    '/settings/taxes': ['tax'],
    '/settings/zones': ['zone'],
    '/settings/templates': ['template', 'storefront'],
    '/settings/invoice-template': ['invoice'],
    '/settings/order-template': ['ordertemplate'],
    '/access/users': ['user'],
    '/access/roles': ['role'],
    '/access/permissions': ['permission'],
    '/settings/company': ['company'],
    '/settings/notifications': ['notification'],
    '/settings/social': ['social'],
    '/settings/statuses': ['status', 'cancellation'],
  };

  /** The nav filtered to the current user's role-permitted menus (empty groups dropped). */
  readonly visibleNav = computed(() =>
    this.nav
      .map((g) => ({ group: g.group, items: g.items.filter((i) => this.auth.canAccess(this.menuTokens[i.path] ?? [])) }))
      .filter((g) => g.items.length > 0),
  );

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
    this.hideTooltip();
  }

  showTooltip(event: MouseEvent, item: NavItem): void {
    // Only show tooltips when the sidebar is collapsed (sidebarOpen is false)
    if (this.sidebarOpen()) {
      return;
    }
    this.tooltip.show(event, item.label, { info: item.info, placement: 'right', customLeft: 56 });
  }

  hideTooltip(): void {
    this.tooltip.hide();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  // ── Global Command Palette (Ctrl+K) ──────────────────────────────────────
  readonly commandPaletteOpen = signal(false);
  readonly commandQuery = signal('');

  readonly commands = [
    { name: 'Dashboard', category: 'Navigation', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', path: '/dashboard' },
    { name: 'Users List', category: 'Access Control', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197', path: '/access/users' },
    { name: 'Roles Config', category: 'Access Control', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', path: '/access/roles' },
    { name: 'Permissions Grid', category: 'Access Control', icon: 'M8 11V7a4 4 0 118 0m-4.815 12.496A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', path: '/access/permissions' },
    { name: 'Categories & Brands', category: 'Catalog', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', path: '/catalog/categories' },
    { name: 'Reviews Moderation', category: 'Catalog', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', path: '/catalog/reviews' },
    { name: 'Orders List', category: 'Sales', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', path: '/orders' },
    { name: 'Offers & Coupons', category: 'Marketing', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 009.5 8H12zm-7.463 8.2l1.3-2.6A2 2 0 017.618 12h8.764a2 2 0 011.781 1.1l1.3 2.6c.381.761-.173 1.65-.98 1.65H5.517c-.808 0-1.362-.89-.98-1.65z', path: '/offers' },
    { name: 'Marketing Banners', category: 'Marketing', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', path: '/settings/banners' },
    { name: 'Batch Report', category: 'Reports', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', path: '/reports/batch' },
    { name: 'Locations & Warehouses', category: 'Store Setup', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z', path: '/settings/locations' },
    { name: 'Tax Slabs', category: 'Store Setup', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 00-2 2z', path: '/settings/taxes' },
    { name: 'Delivery Zones', category: 'Store Setup', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', path: '/settings/zones' },
    { name: 'Company Settings', category: 'System Settings', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', path: '/settings/company' },
    { name: 'Notifications Config', category: 'System Settings', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', path: '/settings/notifications' },
  ];

  readonly filteredCommands = computed(() => {
    const q = this.commandQuery().trim().toLowerCase();
    const allowed = this.commands.filter((c) => this.auth.canAccess(this.menuTokens[c.path] ?? []));
    if (!q) return allowed;
    return allowed.filter((c) =>
      c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  });

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      this.toggleCommandPalette();
    } else if (event.key === 'Escape' && this.commandPaletteOpen()) {
      this.commandPaletteOpen.set(false);
    }
  }

  toggleCommandPalette(): void {
    this.commandQuery.set('');
    this.commandPaletteOpen.update((v) => !v);
  }

  executeCommand(path: string): void {
    this.commandPaletteOpen.set(false);
    this.router.navigateByUrl(path);
  }
}
