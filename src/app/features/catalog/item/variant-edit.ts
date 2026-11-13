import { Component, OnInit, inject, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Modal } from '../../../shared/ui/modal/modal';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ItemService } from './item.service';
import { RepoTaxChange, VariantEdit, VariantPricing, StoreOption } from './item.models';
import { RepoPick } from './repo-quick-sync';
import { RepoItemTax } from './repo-item-tax';

/** Selection state for a variant option dropdown. */
interface VariantOptionSelection {
  variantOptionId: number;
  optionName: string;
  values: { optionValueId: number; optionValueName: string }[];
  selectedValueId: number; // 0 = not selected
}

@Component({
  selector: 'app-variant-edit',
  imports: [FormsModule, Modal, RepoItemTax],
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
  /** The parent item's return window; new variants inherit it as their Return Days. */
  readonly itemReturnDays = input<number>(0);
  /**
   * A repository record chosen from the item page's "Sync with Repository" (categories with
   * options). Fills the new variant's name and batch rows and links it on save.
   */
  readonly repoPrefill = input<RepoPick | null>(null);
  /** The item's current tax slab and HSN (compared with a linked ERP record's GST group / HSN). */
  readonly itemTaxId = input<number>(0);
  readonly itemHsn = input<string>('');
  readonly close = output<void>();
  /** Saved; carries the item tax/HSN update accepted for a linked ERP record (else null). */
  readonly saved = output<RepoTaxChange | null>();
  /** Item tax/HSN update chosen in the "Item tax details" panel. */
  readonly taxChange = signal<RepoTaxChange | null>(null);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly model = signal<VariantEdit | null>(null);

  /** Variant option dropdowns (only for new variants, itemVariantId === 0). */
  readonly variantOptions = signal<VariantOptionSelection[]>([]);
  /** Whether user has manually typed the variant name. */
  isManualName = false;

  /** Warehouses for the batch rows. */
  readonly stores = signal<StoreOption[]>([]);

  /** Whether this is a new variant (show variant option dropdowns + sync button). */
  readonly isNew = computed(() => this.itemVariantId() === 0);

  ngOnInit(): void {
    this.service.stores().subscribe({
      next: (s) => {
        this.stores.set(s);
        this.fillMissingWarehouse();
      },
      error: () => this.stores.set([]),
    });
    this.load();
  }

  /** Repository batch rows default to the first warehouse; stores may arrive after the prefill. */
  private fillMissingWarehouse(): void {
    const m = this.model();
    const first = this.stores()[0]?.storeId;
    if (!m?.repoId || !first) return;
    if (!m.pricing.some((p) => !p.wareHouseId)) return;
    this.model.set({ ...m, pricing: m.pricing.map((p) => (p.wareHouseId ? p : { ...p, wareHouseId: first })) });
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
        const prefill = this.repoPrefill();
        if (this.isNew() && prefill) this.applyRepoPrefill(prefill);
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

  // ── Repository prefill ─────────────────────────────────────
  /** The ERP record this new variant will be linked to on save (shown in the banner). */
  readonly linkedRecord = computed(() => (this.model()?.repoId ? this.repoPrefill()?.record ?? null : null));

  /** Fill the new variant from a repository record: its name, and one batch row per held batch. */
  private applyRepoPrefill({ record, batches }: RepoPick): void {
    const m = this.model();
    if (!m) return;
    const store = this.stores()[0]?.storeId ?? null;
    this.model.set({
      ...m,
      itemVariantName: record.itemName,
      repoId: record.id,
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
            wareHouseId: store,
            physicalQty: b.quantity,
            batchId: null,
          }))
        : [this.blankPricing()],
    });
    this.isManualName = true; // keep the ERP name when options are picked
  }

  /** Drop the link; the filled-in name and rows stay so the variant can still be saved by hand. */
  unlinkRepo(): void {
    const m = this.model();
    if (m) this.model.set({ ...m, repoId: 0 });
  }

  save(): void {
    const m = this.model();
    if (!m) return;
    if (!m.itemVariantName.trim()) {
      this.toast.error('Variant name is required.');
      return;
    }

    // For new variants, require at least one option selection — also when filled from the
    // repository (categories without options create their variant on the item page instead).
    if (this.isNew() && this.variantOptions().length > 0) {
      const hasSelection = this.variantOptions().some((o) => o.selectedValueId !== 0);
      if (!hasSelection) {
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
          // The outcome is in data.result; only "Saved Successfully" is a success (as in the .NET page).
          // An empty result means the API swallowed an error while saving the variant or its pricing,
          // even though the envelope says status: true.
          const r = res as Record<string, unknown> | null;
          const result = String(r?.['result'] ?? r?.['Result'] ?? '').trim();
          if (result !== 'Saved Successfully') {
            this.toast.error(result || 'The variant could not be saved. Check its pricing rows and try again.');
            return;
          }
          this.toast.success(this.itemVariantId() ? 'Variant updated.' : 'Variant created.');
          // Only a variant that was actually linked carries the ERP's item tax details.
          this.saved.emit(this.model()?.repoId ? this.taxChange() : null);
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
