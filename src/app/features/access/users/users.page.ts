import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DataTable, Column } from '../../../shared/ui/data-table/data-table';
import { Modal } from '../../../shared/ui/modal/modal';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { UsersService } from './users.service';
import { AdminUser } from './user.models';

@Component({
  selector: 'app-users-page',
  imports: [ReactiveFormsModule, DataTable, Modal],
  templateUrl: './users.page.html',
})
export class UsersPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly rows = signal<AdminUser[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly modalOpen = signal(false);
  readonly editingId = signal<string>('');

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
    LastName: [''],
    Phone: [''],
    Password: [''],
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
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.editingId.set('');
    this.form.reset({ UserName: '', Email: '', FirstName: '', LastName: '', Phone: '', Password: '', IsActive: true });
    this.form.controls.Password.addValidators(Validators.required);
    this.form.controls.Password.updateValueAndValidity();
    this.modalOpen.set(true);
  }

  openEdit(user: AdminUser): void {
    this.editingId.set(user.userId);
    this.form.reset({
      UserName: user.userName,
      Email: user.email,
      FirstName: user.firstName,
      LastName: user.lastName ?? '',
      Phone: user.phone ?? '',
      Password: '',
      IsActive: !!user.isActive,
    });
    this.form.controls.Password.clearValidators();
    this.form.controls.Password.updateValueAndValidity();
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
        userId: this.editingId(),
        userName: v.UserName,
        email: v.Email,
        firstName: v.FirstName,
        middleName: '',
        lastName: v.LastName,
        phone: v.Phone,
        password: v.Password,
        isActive: v.IsActive,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.toast.success(this.editingId() ? 'User updated.' : 'User created.');
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
