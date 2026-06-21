import { Component, inject, signal, PLATFORM_ID, HostListener } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';

import { AuthService } from '../core/auth/auth.service';

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

  readonly displayName = this.auth.displayName;
  readonly logoUrl = this.auth.logoUrl;
  readonly sidebarOpen = signal(false);
  readonly lgScreen = signal(false);
  readonly tooltipState = signal<{
    visible: boolean;
    label: string;
    info?: string;
    left: number;
    top: number;
  }>({
    visible: false,
    label: '',
    info: '',
    left: 0,
    top: 0
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
    }
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

  private tooltipTimeout?: any;

  showTooltip(event: MouseEvent, item: NavItem): void {
    // Only show tooltips when the sidebar is collapsed (sidebarOpen is false)
    if (this.sidebarOpen()) {
      return;
    }
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const left = 56; // Left offset when sidebar is collapsed (w-12 / 48px + 8px gap)
    const top = rect.top + rect.height / 2;
    
    // Soothing 150ms delay to filter fast sweeps
    this.tooltipTimeout = setTimeout(() => {
      this.tooltipState.set({
        visible: true,
        label: item.label,
        info: item.info,
        left: left,
        top: top
      });
    }, 150);
  }

  hideTooltip(): void {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = undefined;
    }
    // Set visible: false but preserve coordinates for smooth transition exit
    this.tooltipState.update(state => ({ ...state, visible: false }));
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
