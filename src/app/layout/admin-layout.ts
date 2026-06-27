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
  readonly nav: { group: string; items: NavItem[] }[] = [
    {
      group: 'Overview',
      items: [{ label: 'Dashboard', path: '/dashboard', icon: '', info: 'View overall store performance metrics and sales statistics.' }],
    },
    {
      group: 'Access Control',
      items: [
        { label: 'Users', path: '/access/users', icon: '', info: 'Manage administrative user accounts and credentials.' },
        { label: 'Roles', path: '/access/roles', icon: '', info: 'Configure user access roles and responsibilities.' },
        { label: 'Permissions', path: '/access/permissions', icon: '', info: 'Assign module permissions and access control matrices.' },
      ],
    },
    {
      group: 'Catalog',
      items: [
        { label: 'Categories & Brands', path: '/catalog/categories', icon: '', info: 'Manage categories hierarchy and product brands.' },
        { label: 'Review Approval', path: '/catalog/reviews', icon: '', info: 'Moderate and approve customer product reviews.' },
      ],
    },
    {
      group: 'Sales',
      items: [
        { label: 'Orders', path: '/orders', icon: '', info: 'Review and manage customer orders.' },
      ],
    },
    {
      group: 'Marketing',
      items: [
        { label: 'Offers', path: '/offers', icon: '', info: 'Manage coupon codes and discount criteria.' },
        { label: 'Banners', path: '/settings/banners', icon: '', info: 'Configure marketing slideshows and promo images.' },
      ],
    },
    {
      group: 'Reports',
      items: [
        { label: 'Batch Report', path: '/reports/batch', icon: '', info: 'Item-wise stock and batch report with filters.' },
      ],
    },
    {
      group: 'Store Setup',
      items: [
        { label: 'Locations', path: '/settings/locations', icon: '', info: 'Configure warehouses, coordinates, and storage bins.' },
        { label: 'Taxes', path: '/settings/taxes', icon: '', info: 'Set tax rates and financial calculation slabs.' },
        { label: 'Zones', path: '/settings/zones', icon: '', info: 'Define delivery shipping boundaries and zip codes.' },
      ],
    },
    {
      group: 'Design & Layout',
      items: [
        { label: 'Store Front Template', path: '/settings/templates', icon: '', info: 'Customize storefront sections layout and theme colors.' },
        { label: 'Invoice Template', path: '/settings/invoice-template', icon: '', info: 'Configure print styling and content switches for invoices.' },
        { label: 'Order Template', path: '/settings/order-template', icon: '', info: 'Design and customize customer order confirmations.' },
      ],
    },
    {
      group: 'System Settings',
      items: [
        { label: 'Company', path: '/settings/company', icon: '', info: 'Edit company profile, contact, tax, and branding.' },
        { label: 'Notifications', path: '/settings/notifications', icon: '', info: 'Set up SMTP mail and SMS gateways.' },
        { label: 'Social Links', path: '/settings/social', icon: '', info: 'Set storefront social profiles and contact details.' },
        { label: 'Order Statuses', path: '/settings/statuses', icon: '', info: 'Customize order status labels and cancellation reasons.' },
      ],
    },
  ];

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
    if (!q) return this.commands;
    return this.commands.filter((c) =>
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
