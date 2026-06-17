import { Component, inject, signal } from '@angular/core';
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

  readonly displayName = this.auth.displayName;
  readonly sidebarOpen = signal(true);

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
  ];

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
