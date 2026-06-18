import { Component, inject, signal, PLATFORM_ID, HostListener } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';

import { AuthService } from '../core/auth/auth.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
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
      items: [{ label: 'Dashboard', path: '/dashboard', icon: '▦' }],
    },
    {
      group: 'Access',
      items: [
        { label: 'Users', path: '/access/users', icon: '◔' },
        { label: 'Roles', path: '/access/roles', icon: '◑' },
        { label: 'Permissions', path: '/access/permissions', icon: '◕' },
      ],
    },
    {
      group: 'Settings',
      items: [
        { label: 'Invoice Template', path: '/settings/invoice-template', icon: '▤' },
        { label: 'Order Template', path: '/settings/order-template', icon: '▥' },
        { label: 'Store Front Template', path: '/settings/templates', icon: '▦' },
        { label: 'Taxes', path: '/settings/taxes', icon: '%' },
      ],
    },
  ];

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
