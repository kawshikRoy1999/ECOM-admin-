import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { ToastService } from '../../../shared/ui/toast/toast.service';
import { RolesService } from '../roles/roles.service';
import { Role } from '../roles/role.models';
import { PermissionsService } from './permissions.service';
import { MenuGroup, PermissionAction } from './permission.models';
import { Checkbox } from '../../../shared/ui/checkbox/checkbox';

@Component({
  selector: 'app-permissions-page',
  imports: [NgTemplateOutlet, Checkbox],
  templateUrl: './permissions.page.html',
})
export class PermissionsPage {
  private readonly rolesService = inject(RolesService);
  private readonly service = inject(PermissionsService);
  private readonly toast = inject(ToastService);

  readonly roles = signal<Role[]>([]);
  readonly selectedRoleId = signal<string>('');
  readonly actions = signal<PermissionAction[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly searchQuery = signal<string>('');
  readonly expandedGroups = signal<Record<string, boolean>>({});
  readonly permissionSearchQuery = signal<string>('');

  /** Roles filtered by the search query. */
  readonly filteredRoles = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.roles();
    return this.roles().filter((r) => r.roleName.toLowerCase().includes(query));
  });

  /** Selected role object details. */
  readonly selectedRole = computed(() => 
    this.roles().find((r) => r.roleId === this.selectedRoleId())
  );

  /** Summary stats of active permissions. */
  readonly activeCount = computed(() => 
    this.actions().filter((a) => a.isActive).length
  );
  readonly totalCount = computed(() => 
    this.actions().length
  );

  /** Checks if all visible groups are currently expanded. */
  readonly allGroupsExpanded = computed(() => {
    const grps = this.filteredGroups();
    if (grps.length === 0) return false;
    return grps.every((g) => this.expandedGroups()[g.menuId]);
  });

  /** Actions grouped by menu for the matrix layout. */
  readonly groups = computed<MenuGroup[]>(() => {
    const map = new Map<string, MenuGroup>();
    for (const a of this.actions()) {
      let g = map.get(a.menuId);
      if (!g) {
        g = { menuId: a.menuId, menuName: a.menuName, actions: [] };
        map.set(a.menuId, g);
      }
      g.actions.push(a);
    }
    return [...map.values()];
  });

  /** Filtered groups based on the search query. */
  readonly filteredGroups = computed<MenuGroup[]>(() => {
    const query = this.permissionSearchQuery().toLowerCase().trim();
    const allGroups = this.groups();
    if (!query) return allGroups;
    return allGroups.filter((g) => g.menuName.toLowerCase().includes(query));
  });

  activeCountForGroup(group: MenuGroup): number {
    return group.actions.filter((a) => a.isActive).length;
  }

  constructor() {
    this.rolesService.list().subscribe((res) => {
      const roleList = res?.roleList ?? [];
      this.roles.set(roleList);
      // Auto-select the first active role if any exist to improve UX
      const activeRoles = roleList.filter(r => r.isActive);
      if (activeRoles.length > 0) {
        this.onRoleChange(activeRoles[0].roleId);
      }
    });
  }

  onRoleChange(roleId: string): void {
    this.selectedRoleId.set(roleId);
    this.actions.set([]);
    this.expandedGroups.set({});
    this.permissionSearchQuery.set('');
    if (!roleId) return;
    this.loading.set(true);
    this.service.getForRole(roleId).subscribe({
      next: (res) => {
        this.actions.set(res?.permissionList ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleGroup(menuId: string): void {
    this.expandedGroups.update((map) => ({
      ...map,
      [menuId]: !map[menuId],
    }));
  }

  toggleAllGroups(): void {
    const expanded = this.allGroupsExpanded();
    const map: Record<string, boolean> = { ...this.expandedGroups() };
    for (const g of this.filteredGroups()) {
      map[g.menuId] = !expanded;
    }
    this.expandedGroups.set(map);
  }

  toggle(action: PermissionAction): void {
    action.isActive = !action.isActive;
    this.actions.set([...this.actions()]);
  }

  isAllSelected(group: MenuGroup): boolean {
    if (group.actions.length === 0) return false;
    return group.actions.every((a) => a.isActive);
  }

  toggleAllGroupPermissions(group: MenuGroup): void {
    const targetState = !this.isAllSelected(group);
    for (const a of group.actions) {
      a.isActive = targetState;
    }
    this.actions.set([...this.actions()]);
  }

  isSomeSelected(group: MenuGroup): boolean {
    const active = this.activeCountForGroup(group);
    return active > 0 && active < group.actions.length;
  }

  save(): void {
    if (!this.selectedRoleId()) return;
    this.saving.set(true);
    this.service.save(this.selectedRoleId(), this.actions()).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Permissions saved.');
      },
      error: () => this.saving.set(false),
    });
  }
}

