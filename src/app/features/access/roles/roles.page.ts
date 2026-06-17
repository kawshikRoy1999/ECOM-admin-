import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DataTable, Column } from '../../../shared/ui/data-table/data-table';
import { Modal } from '../../../shared/ui/modal/modal';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { RolesService } from './roles.service';
import { EMPTY_GUID, Role } from './role.models';

@Component({
  selector: 'app-roles-page',
  imports: [ReactiveFormsModule, DataTable, Modal],
  templateUrl: './roles.page.html',
})
export class RolesPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(RolesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly rows = signal<Role[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly modalOpen = signal(false);
  readonly editingId = signal<string>('');

  readonly columns: Column<Role>[] = [
    { key: 'roleName', header: 'Role' },
    { key: 'description', header: 'Description' },
    { key: 'isActive', header: 'Status', align: 'center', format: (r) => (r.isActive ? 'Active' : 'Inactive') },
  ];

  readonly form = this.fb.nonNullable.group({
    RoleName: ['', [Validators.required]],
    Description: [''],
    IsActive: [true],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (res) => {
        this.rows.set(res?.roleList ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.editingId.set('');
    this.form.reset({ RoleName: '', Description: '', IsActive: true });
    this.modalOpen.set(true);
  }

  openEdit(role: Role): void {
    this.editingId.set(role.roleId);
    this.form.reset({
      RoleName: role.roleName,
      Description: role.description ?? '',
      IsActive: role.isActive,
    });
    this.modalOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.service
      .save({
        roleId: this.editingId() || EMPTY_GUID,
        roleName: v.RoleName,
        description: v.Description,
        isActive: v.IsActive,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.toast.success(this.editingId() ? 'Role updated.' : 'Role created.');
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  async remove(role: Role): Promise<void> {
    const ok = await this.confirm.ask(`Delete role "${role.roleName}"?`, {
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.service.delete(role.roleId).subscribe({
      next: () => {
        this.toast.success('Role deleted.');
        this.load();
      },
    });
  }
}
