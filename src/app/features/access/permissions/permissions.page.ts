import { Component, computed, inject, signal } from '@angular/core';

import { ToastService } from '../../../shared/ui/toast/toast.service';
import { RolesService } from '../roles/roles.service';
import { Role } from '../roles/role.models';
import { PermissionsService } from './permissions.service';
import { MenuGroup, PermissionAction } from './permission.models';

@Component({
  selector: 'app-permissions-page',
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

  toggle(action: PermissionAction): void {
    action.isActive = !action.isActive;
    this.actions.set([...this.actions()]);
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

