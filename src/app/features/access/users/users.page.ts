import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DataTable, Column } from '../../../shared/ui/data-table/data-table';
import { Modal } from '../../../shared/ui/modal/modal';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { Checkbox } from '../../../shared/ui/checkbox/checkbox';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { of, switchMap } from 'rxjs';

import { UsersService } from './users.service';
import { AdminUser, UserRoleOption } from './user.models';
import { TooltipService } from '../../../shared/ui/tooltip.service';

@Component({
  selector: 'app-users-page',
  imports: [ReactiveFormsModule, DataTable, Modal, ImageUpload, Checkbox],
  templateUrl: './users.page.html',
})
export class UsersPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  public readonly tooltip = inject(TooltipService);

  readonly rows = signal<AdminUser[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly modalOpen = signal(false);
  readonly editingId = signal<string>('');

  /** All assignable roles (from the user list response) + the current selection. */
  readonly roleOptions = signal<UserRoleOption[]>([]);
  readonly selectedRoleIds = signal<string[]>([]);

  /** Profile image URL (two-way bound to the uploader). */
  readonly imagePath = signal<string>('');

  readonly columns: Column<AdminUser>[] = [
    { key: 'userName', header: 'Username' },
    { key: 'firstName', header: 'Name', format: (u) => [u.firstName, u.lastName].filter(Boolean).join(' ') },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'isActive', header: 'Status', align: 'center', format: (u) => (u.isActive ? 'Active' : 'Inactive') },
  ];

  readonly form = this.fb.nonNullable.group({
    UserName: ['', [Validators.required]],
    Email: ['', [Validators.required]],
    FirstName: ['', [Validators.required]],
    MiddleName: [''],
    LastName: [''],
    Phone: [''],
    Password: [''],
    Address1: [''],
    Address2: [''],
    City: [''],
    State: [''],
    Country: [''],
    Zip: [''],
    IsActive: [true],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (res) => {
        this.rows.set(res?.userList ?? []);
        this.roleOptions.set(res?.roleList ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.editingId.set('');
    this.selectedRoleIds.set([]);
    this.imagePath.set('');
    this.form.reset({
      UserName: '', Email: '', FirstName: '', MiddleName: '', LastName: '', Phone: '', Password: '',
      Address1: '', Address2: '', City: '', State: '', Country: '', Zip: '', IsActive: true,
    });
    this.form.controls.Password.addValidators(Validators.required);
    this.form.controls.Password.updateValueAndValidity();
    this.modalOpen.set(true);
  }

  openEdit(user: AdminUser): void {
    this.editingId.set(user.userId);
    this.selectedRoleIds.set([]);
    this.imagePath.set(user.imagePath ?? '');
    this.form.reset({
      UserName: user.userName,
      Email: user.email,
      FirstName: user.firstName,
      MiddleName: user.middleName ?? '',
      LastName: user.lastName ?? '',
      Phone: user.phone ?? '',
      Password: '',
      Address1: user.address ?? '',
      Address2: user.address2 ?? '',
      City: user.city ?? '',
      State: user.state ?? '',
      Country: user.country ?? '',
      Zip: user.postalCode ?? '',
      IsActive: !!user.isActive,
    });
    this.form.controls.Password.clearValidators();
    this.form.controls.Password.updateValueAndValidity();
    this.modalOpen.set(true);

    // Pull the full detail (roles + any address fields not in the list payload).
    this.service.detail(user.userId).subscribe({
      next: (res) => {
        this.selectedRoleIds.set((res?.userRoleDtl ?? []).map((r) => r.roleId));
        const d = res?.userDtl;
        if (d) {
          this.imagePath.set(d.imagePath ?? this.imagePath());
          this.form.patchValue({
            MiddleName: d.middleName ?? this.form.controls.MiddleName.value,
            Address1: d.address ?? this.form.controls.Address1.value,
            Address2: d.address2 ?? this.form.controls.Address2.value,
            City: d.city ?? this.form.controls.City.value,
            State: d.state ?? this.form.controls.State.value,
            Country: d.country ?? this.form.controls.Country.value,
            Zip: d.postalCode ?? this.form.controls.Zip.value,
          });
        }
      },
    });
  }

  toggleRole(roleId: string, checked: boolean): void {
    this.selectedRoleIds.update((ids) =>
      checked ? [...new Set([...ids, roleId])] : ids.filter((id) => id !== roleId),
    );
  }

  isRoleSelected(roleId: string): boolean {
    return this.selectedRoleIds().includes(roleId);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const wasEditing = !!this.editingId();
    this.service
      .save({
        userId: this.editingId(),
        userName: v.UserName,
        email: v.Email,
        firstName: v.FirstName,
        middleName: v.MiddleName,
        lastName: v.LastName,
        phone: v.Phone,
        address: v.Address1,
        address2: v.Address2,
        city: v.City,
        state: v.State,
        country: v.Country,
        postalCode: v.Zip,
        imagePath: this.imagePath(),
        password: v.Password,
        isActive: v.IsActive,
      })
      .pipe(
        // Once the user exists, assign the selected roles (uses the returned id for new users).
        switchMap((res) => {
          const userId = res?.userId || this.editingId();
          const roleIds = this.selectedRoleIds();
          return userId && roleIds.length ? this.service.assignRoles(userId, roleIds) : of(null);
        }),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.toast.success(wasEditing ? 'User updated.' : 'User created.');
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  async remove(user: AdminUser): Promise<void> {
    const ok = await this.confirm.ask(`Delete user "${user.userName}"?`, { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    this.service.delete(user.userId).subscribe({
      next: () => {
        this.toast.success('User deleted.');
        this.load();
      },
    });
  }
}
