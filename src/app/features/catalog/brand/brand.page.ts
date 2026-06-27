import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { Modal } from '../../../shared/ui/modal/modal';
import { Checkbox } from '../../../shared/ui/checkbox/checkbox';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { BrandService } from './brand.service';
import { Brand } from './brand.models';

@Component({
  selector: 'app-brand-page',
  imports: [ReactiveFormsModule, FormsModule, Modal, Checkbox, ImageUpload],
  templateUrl: './brand.page.html',
})
export class BrandPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(BrandService);
  private readonly toast = inject(ToastService);

  readonly brands = signal<Brand[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly search = signal('');

  // Modal
  readonly modalOpen = signal(false);
  readonly editingId = signal(0);
  readonly logo = signal('');
  readonly banner = signal('');
  readonly promo = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    notes: [''],
  });

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    const list = this.brands();
    return q ? list.filter((b) => b.name?.toLowerCase().includes(q)) : list;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.brands.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.editingId.set(0);
    this.logo.set('');
    this.banner.set('');
    this.promo.set('');
    this.form.reset({ name: '', notes: '' });
    this.modalOpen.set(true);
  }

  openEdit(b: Brand): void {
    this.editingId.set(b.brandId);
    this.logo.set(b.logoFileName);
    this.banner.set(b.bannerFileName);
    this.promo.set(b.promoFileName);
    this.form.reset({ name: b.name, notes: b.notes ?? '' });
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
        brandId: this.editingId(),
        name: v.name,
        notes: v.notes,
        logoFileName: this.logo(),
        bannerFileName: this.banner(),
        promoFileName: this.promo(),
        isActive: true,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.toast.success(this.editingId() ? 'Brand updated.' : 'Brand created.');
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  toggle(b: Brand): void {
    this.service.toggle(b.brandId, !b.isActive).subscribe({
      next: () => {
        this.brands.update((list) =>
          list.map((x) => (x.brandId === b.brandId ? { ...x, isActive: !x.isActive } : x)),
        );
        this.toast.success(b.isActive ? 'Brand hidden.' : 'Brand visible.');
      },
    });
  }
}
