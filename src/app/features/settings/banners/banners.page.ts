import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DataTable, Column } from '../../../shared/ui/data-table/data-table';
import { Modal } from '../../../shared/ui/modal/modal';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { BannersService } from './banners.service';
import { Banner } from './banner.models';

@Component({
  selector: 'app-banners-page',
  imports: [ReactiveFormsModule, DataTable, Modal, ImageUpload],
  templateUrl: './banners.page.html',
})
export class BannersPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(BannersService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly rows = signal<Banner[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly modalOpen = signal(false);
  readonly editingId = signal(0);
  readonly imageUrl = signal('');

  readonly columns: Column<Banner>[] = [
    { key: 'bannerName', header: 'Banner' },
    { key: 'description', header: 'Description' },
  ];

  readonly form = this.fb.nonNullable.group({
    bannerName: ['', [Validators.required]],
    description: [''],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.rows.set(rows ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.editingId.set(0);
    this.imageUrl.set('');
    this.form.reset({ bannerName: '', description: '' });
    this.modalOpen.set(true);
  }

  openEdit(b: Banner): void {
    this.editingId.set(b.bannerId);
    this.imageUrl.set(b.imagePath ?? '');
    this.form.reset({ bannerName: b.bannerName, description: b.description ?? '' });
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
        bannerId: this.editingId(),
        bannerName: v.bannerName,
        description: v.description,
        imagePath: this.imageUrl(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.toast.success(this.editingId() ? 'Banner updated.' : 'Banner created.');
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  async remove(b: Banner): Promise<void> {
    const ok = await this.confirm.ask(`Delete banner "${b.bannerName}"?`, { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    this.service.delete(b.bannerId).subscribe({
      next: () => {
        this.toast.success('Banner deleted.');
        this.load();
      },
    });
  }
}
