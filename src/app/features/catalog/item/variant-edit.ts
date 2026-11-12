import { Component, OnDestroy, OnInit, inject, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Modal } from '../../../shared/ui/modal/modal';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ItemService } from './item.service';
import { VariantEdit, VariantPricing, RepoItem, StoreOption } from './item.models';

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
export class VariantEditModal implements OnInit, OnDestroy {
  private readonly service = inject(ItemService);
  private readonly toast = inject(ToastService);

  readonly itemId = input.required<number>();
  readonly itemVariantId = input.required<number>();
  /** The item's name (used to build variant name automatically). */
  readonly itemName = input<string>('');
  /** The category id (needed to load variant option dropdowns). */
  readonly categoryId = input<number>(0);
  /** The parent item's return window; new variants inherit it as their Return Days. */
  readonly itemReturnDays = input<number>(0);
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
  private repoTimer: ReturnType<typeof setTimeout> | null = null;

  /** Warehouses for the batch rows. */
  readonly stores = signal<StoreOption[]>([]);

  /** Whether this is a new variant (show variant option dropdowns + sync button). */
  readonly isNew = computed(() => this.itemVariantId() === 0);

  ngOnInit(): void {
    this.service.stores().subscribe({ next: (s) => this.stores.set(s), error: () => this.stores.set([]) });
    this.load();
  }

  ngOnDestroy(): void {
    if (this.repoTimer) clearTimeout(this.repoTimer);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** 8-char upper-case alphanumeric SKU (mirrors .NET GenerateUniqueAlphaNumeric). */
  private generateSku(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  load(): void {
    this.loading.set(true);
    this.service.getAddVariant(this.itemId(), this.itemVariantId()).subscribe({
      next: (v) => {
        if (!v.pricing.length) v.pricing = [this.blankPricing()];
        // New variants get an auto-generated, read-only SKU (as in the .NET admin).
        if (this.isNew() && !v.sku) v.sku = this.generateSku();
        if (this.isNew() && !v.itemVariantName) {
          v.itemVariantName = this.itemName();
        }
        // New variants inherit the parent item's return window as their Return Days
        // (mirrors .NET OpenPopupVariant: #ItemDays = #txtReturnWindow).
        if (this.isNew() && !v.returnDays) {
          v.returnDays = this.itemReturnDays();
        }
        this.model.set(v);
        this.loading.set(false);

        // For new variants, load the variant option dropdowns. Like the .NET view, only options
        // applied on variants are shown, and each value is identified by its VariantOptionValueId
        // (that id is what SaveInventoryVariant expects in VariantOptionValueIds).
        if (this.isNew() && v.options?.length) {
          this.variantOptions.set(
            v.options
              .filter((o) => (o.appliedOnVariant !== undefined ? o.appliedOnVariant !== 0 : o.isApplicable))
              .map((o) => ({
                variantOptionId: o.variantOptionId,
                optionName: o.variantName,
                values: o.selectedValues.map((val) => ({
                  optionValueId: val.variantOptionValueId || val.optionValueId,
                  optionValueName: val.optionValue,
                })),
                selectedValueId: 0,
              })),
          );
        }
      },
      error: () => this.loading.set(false),
    });
  }

  private blankPricing(): VariantPricing {
    const d = this.today();
    return { itemPricingId: 0, mrp: 0, discount: 0, price: 0, cost: 0, startDate: d, endDate: d, batchCode: '', wareHouseId: null, physicalQty: null, batchId: null };
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

  /** Allow only digits in numeric-only inputs (mirrors .NET AllowOnlyNumbers). */
  onlyDigits(e: KeyboardEvent): void {
    const ok = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (e.ctrlKey || e.metaKey || ok.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  generateRandomBarcode(): void {
    const m = this.model();
    if (!m) return;
    const code = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    this.patch('barcode', code);
    this.toast.success('Barcode generated.');
  }

  removePricing(index: number): void {
    const m = this.model();
    if (m && m.pricing.length > 1) {
      this.model.set({ ...m, pricing: m.pricing.filter((_, i) => i !== index) });
    }
  }

  onOptionValueChange(variantOptionId: number, valueId: any): void {
    const val = Number(valueId) || 0;
    this.variantOptions.update((list) =>
      list.map((o) => (o.variantOptionId === variantOptionId ? { ...o, selectedValueId: val } : o))
    );
    this.onVariantOptionChange();
  }

  /** Called when the user changes a variant option dropdown value. Auto-generates name. */
  onVariantOptionChange(): void {
    this.generateVariantName();
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
    if (!m || this.isManualName) return;

    const selectedTexts: string[] = [];
    for (const opt of this.variantOptions()) {
      if (opt.selectedValueId) {
        const found = opt.values.find((v) => Number(v.optionValueId) === Number(opt.selectedValueId));
        if (found) selectedTexts.push(found.optionValueName);
      }
    }

    const optionPart = selectedTexts.join('/');
    const parentName = this.itemName() || '';

    const generatedName = optionPart ? (parentName ? `${parentName}/${optionPart}` : optionPart) : parentName;

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

  /** Debounced search-as-you-type (the .NET modal searches 300ms after each keystroke). */
  onRepoQueryChange(value: string): void {
    this.repoSearchQuery.set(value);
    if (this.repoTimer) clearTimeout(this.repoTimer);
    this.repoTimer = setTimeout(() => this.searchRepo(), 300);
  }

  searchRepo(): void {
    const q = this.repoSearchQuery().trim();
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
                startDate: this.today(),
                endDate: this.today(),
                batchCode: b.barcode,
                wareHouseId: this.stores()[0]?.storeId ?? null,
                physicalQty: b.quantity,
                batchId: null,
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

    const rows = m.pricing;
    if (!rows.length) {
      this.toast.error('At least one Pricing required.');
      return;
    }
    const seen = new Set<string>();
    for (const p of rows) {
      const batch = (p.batchCode ?? '').trim();
      if (!p.wareHouseId) return this.fail('Store is required.');
      if (!batch) return this.fail('Batch Code is required.');
      if (seen.has(batch.toLowerCase())) return this.fail('Batch code already present.');
      seen.add(batch.toLowerCase());
      if (p.mrp === null || (p.mrp as unknown) === '') return this.fail('MRP is required.');
      if (p.discount === null || (p.discount as unknown) === '') return this.fail('Discount is required.');
      if (p.price === null || (p.price as unknown) === '') return this.fail('Price is required.');
      if (p.cost === null || (p.cost as unknown) === '') return this.fail('Actual Cost Per Item is required.');
      if (!Number(p.physicalQty)) return this.fail('Quantity is required.');
    }

    this.saving.set(true);
    this.service
      .saveVariant({
        ...m,
        // A new variant comes back from GetAddVariant with ItemId 0; the parent item id is what the save needs.
        itemId: this.itemId(),
        itemVariantId: this.itemVariantId(),
        returnDays: Number(m.returnDays) || 0,
        mrp: Number(m.mrp),
        discount: Number(m.discount),
        variantOptionValueIds: this.getVariantOptionValueIds(),
        pricing: m.pricing.map((p) => ({
          ...p,
          mrp: Number(p.mrp),
          discount: Number(p.discount),
          price: Number(p.price),
          cost: Number(p.cost),
          physicalQty: Number(p.physicalQty),
          startDate: p.startDate || this.today(),
          endDate: p.endDate || this.today(),
        })),
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          // The gateway reports validation problems in data.result (anything but "Saved Successfully").
          const r = res as Record<string, unknown> | null;
          const result = String(r?.['result'] ?? r?.['Result'] ?? '');
          if (result && result !== 'Saved Successfully') {
            this.toast.error(result);
            return;
          }
          this.toast.success(this.itemVariantId() ? 'Variant updated.' : 'Variant created.');
          this.saved.emit();
        },
        error: (e: { message?: string }) => {
          this.saving.set(false);
          this.toast.error(e?.message || 'Could not save the variant.');
        },
      });
  }

  private fail(message: string): void {
    this.toast.error(message);
  }
}
