import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DataTable, Column } from '../../../shared/ui/data-table/data-table';
import { Modal } from '../../../shared/ui/modal/modal';
import { Checkbox } from '../../../shared/ui/checkbox/checkbox';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ImageUploadService } from '../../../core/api/image-upload.service';
import { ApiError } from '../../../core/api/api.models';
import { of, switchMap } from 'rxjs';

import { UsersService } from './users.service';
import { AdminUser, UserRoleOption } from './user.models';
import { TooltipService } from '../../../shared/ui/tooltip.service';

@Component({
  selector: 'app-users-page',
  imports: [ReactiveFormsModule, DataTable, Modal, Checkbox],
  templateUrl: './users.page.html',
})
export class UsersPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly uploader = inject(ImageUploadService);
  public readonly tooltip = inject(TooltipService);

  readonly localImagePreview = signal<string>('');
  readonly uploadProgress = signal<number>(0);
  selectedFile: File | null = null;

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
      error: (err) => {
        this.loading.set(false);
        this.rows.set([]);
        this.toast.error(err?.message || 'Could not load users.');
      },
    });
  }

  openCreate(): void {
    this.editingId.set('');
    this.selectedRoleIds.set([]);
    this.imagePath.set('');
    this.localImagePreview.set('');
    this.selectedFile = null;
    this.uploadProgress.set(0);
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
    this.localImagePreview.set('');
    this.selectedFile = null;
    this.uploadProgress.set(0);
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

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.error('Please choose an image file.');
      return;
    }

    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.localImagePreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  clearImageSelection(): void {
    this.localImagePreview.set('');
    this.imagePath.set('');
    this.selectedFile = null;
    this.uploadProgress.set(0);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const invalidControls: string[] = [];
      Object.keys(this.form.controls).forEach((key) => {
        const control = this.form.get(key);
        if (control?.invalid) {
          invalidControls.push(key);
        }
      });
      console.warn('Form validation failed. Bypassing save and file upload. Invalid controls:', invalidControls);
      this.toast.error(`Please fill in all required fields: ${invalidControls.join(', ')}`);
      return;
    }
    this.saving.set(true);

    if (this.selectedFile) {
      this.uploadProgress.set(5);
      this.uploader.upload(this.selectedFile, { entityType: 'Users' }).subscribe({
        next: (p) => {
          this.uploadProgress.set(p.progress);
          if (p.done) {
            if (p.url) {
              this.imagePath.set(p.url);
              this.selectedFile = null;
              this.localImagePreview.set('');
              this.uploadProgress.set(0);
              this.submitSavePayload();
            } else {
              this.saving.set(false);
              this.toast.error('Upload finished but no URL was returned.');
            }
          }
        },
        error: (err) => {
          this.saving.set(false);
          this.uploadProgress.set(0);
          this.toast.error('Profile image upload failed.');
          console.error('User profile image upload error details:', err);
        }
      });
    } else {
      this.submitSavePayload();
    }
  }

  submitSavePayload(): void {
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
        // AddEditUser answers `status: true` even when it fails — the real outcome
        // is in data.type / data.msg (see SettingController.AddEditUser). Reject
        // anything that isn't "success" so duplicates don't look like a save.
        switchMap((res) => {
          if (res?.type && res.type.toLowerCase() !== 'success') {
            throw new ApiError(res.msg || 'Could not save the user.');
          }
          const userId = res?.userId || this.editingId();
          // Always sync roles once the user exists — an empty list is how you
          // remove every role, so skipping it would make that a silent no-op.
          return userId ? this.service.assignRoles(userId, this.selectedRoleIds()) : of(null);
        }),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.toast.success(wasEditing ? 'User updated.' : 'User created.');
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(err?.message || 'Could not save the user.');
        },
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
