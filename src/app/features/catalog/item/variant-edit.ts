import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Modal } from '../../../shared/ui/modal/modal';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ItemService } from './item.service';
import { VariantEdit, VariantPricing } from './item.models';

@Component({
  selector: 'app-variant-edit',
  imports: [FormsModule, Modal],
  templateUrl: './variant-edit.html',
})
export class VariantEditModal implements OnInit {
  private readonly service = inject(ItemService);
  private readonly toast = inject(ToastService);

  readonly itemId = input.required<number>();
  readonly itemVariantId = input.required<number>();
  readonly close = output<void>();
  readonly saved = output<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly model = signal<VariantEdit | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.getAddVariant(this.itemId(), this.itemVariantId()).subscribe({
      next: (v) => {
        if (!v.pricing.length) v.pricing = [this.blankPricing()];
        this.model.set(v);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private blankPricing(): VariantPricing {
    return { itemPricingId: 0, mrp: 0, discount: 0, price: 0, cost: 0, startDate: '', endDate: '', batchCode: '' };
  }

  patch<K extends keyof VariantEdit>(key: K, value: VariantEdit[K]): void {
    const m = this.model();
    if (m) this.model.set({ ...m, [key]: value });
  }

  updatePricing(index: number, field: keyof VariantPricing, value: string | number): void {
    const m = this.model();
    if (!m) return;
    this.model.set({
      ...m,
      pricing: m.pricing.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    });
  }

  addPricing(): void {
    const m = this.model();
    if (m) this.model.set({ ...m, pricing: [...m.pricing, this.blankPricing()] });
  }

  removePricing(index: number): void {
    const m = this.model();
    if (m && m.pricing.length > 1) {
      this.model.set({ ...m, pricing: m.pricing.filter((_, i) => i !== index) });
    }
  }

  save(): void {
    const m = this.model();
    if (!m) return;
    if (!m.itemVariantName.trim()) {
      this.toast.error('Variant name is required.');
      return;
    }
    this.saving.set(true);
    this.service
      .saveVariant({
        ...m,
        returnDays: Number(m.returnDays),
        mrp: Number(m.mrp),
        discount: Number(m.discount),
        pricing: m.pricing.map((p) => ({
          ...p,
          mrp: Number(p.mrp),
          discount: Number(p.discount),
          price: Number(p.price),
          cost: Number(p.cost),
        })),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success(this.itemVariantId() ? 'Variant updated.' : 'Variant created.');
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
  }
}
