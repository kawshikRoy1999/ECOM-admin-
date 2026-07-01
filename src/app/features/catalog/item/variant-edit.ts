import { Component, OnInit, inject, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Modal } from '../../../shared/ui/modal/modal';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ItemService } from './item.service';
import { VariantEdit, VariantPricing, AvailableVariantOption, RepoItem, RepositoryBatch } from './item.models';

/** Selection state for a variant option dropdown. */
interface VariantOptionSelection {
  variantOptionId: number;
  optionName: string;
  values: { optionValueId: number; optionValueName: string }[];
  selectedValueId: number; // 0 = not selected
}

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
  /** The item's name (used to build variant name automatically). */
  readonly itemName = input<string>('');
  /** The category id (needed to load variant option dropdowns). */
  readonly categoryId = input<number>(0);
  readonly close = output<void>();
  readonly saved = output<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly model = signal<VariantEdit | null>(null);

  /** Variant option dropdowns (only for new variants, itemVariantId === 0). */
  readonly variantOptions = signal<VariantOptionSelection[]>([]);
  /** Whether user has manually typed the variant name. */
  isManualName = false;

  /** Sync with Repository state. */
  readonly showRepoModal = signal(false);
  readonly repoSearchQuery = signal('');
  readonly repoSearching = signal(false);
  readonly repoItems = signal<RepoItem[]>([]);
  readonly repoSyncing = signal(false);

  /** Whether this is a new variant (show variant option dropdowns + sync button). */
  readonly isNew = computed(() => this.itemVariantId() === 0);

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

        // For new variants, load variant option dropdowns dynamically from the options configured on the parent item
        if (this.isNew() && v.options?.length) {
          this.variantOptions.set(
            v.options
              .filter((o) => o.isApplicable)
              .map((o) => ({
                variantOptionId: o.variantOptionId,
                optionName: o.variantName,
                values: o.selectedValues.map((val) => ({
                  optionValueId: val.optionValueId,
                  optionValueName: val.optionValue,
                })),
                selectedValueId: 0,
              }))
          );
        }
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

    let numVal = Number(value) || 0;

    this.model.set({
      ...m,
      pricing: m.pricing.map((p, i) => {
        if (i !== index) return p;

        let updated = { ...p, [field]: value };

        const mrp = Number(field === 'mrp' ? numVal : updated.mrp) || 0;
        let discount = Number(field === 'discount' ? numVal : updated.discount) || 0;
        let price = Number(field === 'price' ? numVal : updated.price) || 0;

        if (field === 'mrp') {
          if (discount > 0) {
            price = mrp - (mrp * discount) / 100;
            updated.price = Number(price.toFixed(2));
          } else {
            updated.price = mrp;
          }
        } else if (field === 'discount') {
          if (discount > 100) {
            discount = 100;
            updated.discount = 100;
          } else if (discount < 0) {
            discount = 0;
            updated.discount = 0;
          }
          price = mrp - (mrp * discount) / 100;
          updated.price = Number(price.toFixed(2));
        } else if (field === 'price') {
          if (price > mrp && mrp > 0) {
            price = mrp;
            updated.price = mrp;
          }
          if (mrp > 0) {
            discount = ((mrp - price) / mrp) * 100;
            updated.discount = Number(discount.toFixed(2));
          }
        }

        return updated;
      }),
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

  /** Called when the user changes a variant option dropdown value. Auto-generates name. */
  onVariantOptionChange(): void {
    if (!this.isManualName) {
      this.generateVariantName();
    }
  }

  /** Called when the user manually types in the variant name field. */
  onVariantNameKeyup(): void {
    const m = this.model();
    if (m && m.itemVariantName.trim() === '') {
      this.isManualName = false;
    } else {
      this.isManualName = true;
    }
  }

  /** Auto-generate variant name from selected option values + parent item name. */
  private generateVariantName(): void {
    const m = this.model();
    if (!m) return;

    const selectedTexts: string[] = [];
    for (const opt of this.variantOptions()) {
      if (opt.selectedValueId) {
        const found = opt.values.find((v) => v.optionValueId === opt.selectedValueId);
        if (found) selectedTexts.push(found.optionValueName);
      }
    }

    const optionPart = selectedTexts.join('/');
    const parentName = this.itemName();

    let generatedName = '';
    if (optionPart) {
      generatedName = parentName ? `${parentName}/${optionPart}` : optionPart;
    }

    this.model.set({ ...m, itemVariantName: generatedName });
  }

  /** Collect selected variant option value ids as a comma-separated string. */
  private getVariantOptionValueIds(): string {
    const ids: number[] = [];
    for (const opt of this.variantOptions()) {
      if (opt.selectedValueId) {
        ids.push(opt.selectedValueId);
      }
    }
    return ids.join(',');
  }

  // ── Sync with Repository ───────────────────────────────────
  openRepoModal(): void {
    this.showRepoModal.set(true);
    this.repoSearchQuery.set('');
    this.repoItems.set([]);
  }

  closeRepoModal(): void {
    this.showRepoModal.set(false);
  }

  searchRepo(): void {
    const q = this.repoSearchQuery().trim();
    if (!q) return;
    this.repoSearching.set(true);
    this.service.searchRepository(q).subscribe({
      next: (items) => {
        this.repoItems.set(items);
        this.repoSearching.set(false);
      },
      error: () => this.repoSearching.set(false),
    });
  }

  syncRepoItem(item: RepoItem): void {
    const m = this.model();
    if (!m) return;

    this.repoSyncing.set(true);
    this.service.getRepositoryBatch(item.id).subscribe({
      next: (batches) => {
        // Set variant name from repo item
        this.model.set({
          ...m,
          itemVariantName: item.itemName,
          repoId: item.id,
          // Replace pricing rows with batch data
          pricing: batches.length
            ? batches.map((b) => ({
                itemPricingId: 0,
                mrp: b.price,
                discount: 0,
                price: b.price,
                cost: b.price,
                startDate: '',
                endDate: '',
                batchCode: b.barcode,
              }))
            : [this.blankPricing()],
        });
        this.isManualName = true; // Don't override repo-synced name
        this.repoSyncing.set(false);
        this.showRepoModal.set(false);
        this.toast.success('Synced with repository.');
      },
      error: () => {
        this.repoSyncing.set(false);
        this.toast.error('Failed to sync with repository.');
      },
    });
  }

  save(): void {
    const m = this.model();
    if (!m) return;
    if (!m.itemVariantName.trim()) {
      this.toast.error('Variant name is required.');
      return;
    }

    // For new variants, require at least one option selection
    if (this.isNew() && this.variantOptions().length > 0) {
      const hasSelection = this.variantOptions().some((o) => o.selectedValueId !== 0);
      if (!hasSelection && !m.repoId) {
        this.toast.error('Please select at least one variant option.');
        return;
      }
    }

    this.saving.set(true);
    this.service
      .saveVariant({
        ...m,
        returnDays: Number(m.returnDays),
        mrp: Number(m.mrp),
        discount: Number(m.discount),
        variantOptionValueIds: this.getVariantOptionValueIds(),
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
