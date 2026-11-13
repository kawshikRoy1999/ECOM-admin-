import { Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Modal } from '../../../shared/ui/modal/modal';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ItemService } from './item.service';
import { RepoItem, RepoTaxChange, RepositoryBatch, StoreOption } from './item.models';
import { RepoItemTax } from './repo-item-tax';

/** A picked repository record plus its held batches, handed to the variant editor. */
export interface RepoPick {
  record: RepoItem;
  batches: RepositoryBatch[];
}

/** An editable batch row in the confirm step. */
interface QuickBatchRow {
  batchCode: string;
  price: number | null;
  quantity: number | null;
}

/**
 * The one "Sync with Repository" entry point on an item's Variants card. Step 1 always picks
 * an unlinked ERP record. What happens next depends on the category:
 * - no variant options (`createDirectly`): step 2 reviews the name, warehouse and held batches,
 *   then creates the item's default variant and links it in one save;
 * - variant options: emits `picked` so the variant editor opens pre-filled from the record,
 *   and the user only chooses the option values.
 */
@Component({
  selector: 'app-repo-quick-sync',
  imports: [FormsModule, DecimalPipe, Modal, RepoItemTax],
  templateUrl: './repo-quick-sync.html',
})
export class RepoQuickSync implements OnInit, OnDestroy {
  private readonly service = inject(ItemService);
  private readonly toast = inject(ToastService);

  readonly itemId = input.required<number>();
  /** New variants inherit the parent item's return window (as in the variant editor). */
  readonly itemReturnDays = input<number>(0);
  /** True when the category has no variant options: create the variant here instead of in the editor. */
  readonly createDirectly = input<boolean>(true);
  /** The item's current tax slab and HSN, compared with the ERP record's GST group / HSN. */
  readonly itemTaxId = input<number>(0);
  readonly itemHsn = input<string>('');
  readonly close = output<void>();
  /** Variant created and linked; carries the item tax/HSN update the user accepted (or null). */
  readonly synced = output<RepoTaxChange | null>();
  /** Options flow: the chosen record and its held batches, for the variant editor. */
  readonly picked = output<RepoPick>();

  readonly step = signal<'pick' | 'confirm'>('pick');

  // Step 1: pick a record
  readonly query = signal('');
  readonly searching = signal(false);
  readonly records = signal<RepoItem[]>([]);
  readonly loadingBatches = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  // Step 2: review and create
  readonly chosen = signal<RepoItem | null>(null);
  readonly variantName = signal('');
  readonly stores = signal<StoreOption[]>([]);
  readonly wareHouseId = signal(0);
  readonly rows = signal<QuickBatchRow[]>([]);
  /** True when the record had held batches; otherwise the user enters the first batch by hand. */
  readonly hadHeldBatches = signal(false);
  readonly creating = signal(false);
  /** Item tax/HSN update chosen in the "Item tax details" panel. */
  readonly taxChange = signal<RepoTaxChange | null>(null);

  readonly totalUnits = computed(() => this.rows().reduce((n, r) => n + (Number(r.quantity) || 0), 0));

  ngOnInit(): void {
    this.service.stores().subscribe({
      next: (s) => {
        this.stores.set(s);
        if (!this.wareHouseId() && s.length) this.wareHouseId.set(s[0].storeId);
      },
      error: () => this.stores.set([]),
    });
    this.search();
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search(), 300);
  }

  search(): void {
    this.searching.set(true);
    this.service.searchRepository(this.query().trim()).subscribe({
      next: (items) => {
        this.records.set(items);
        this.searching.set(false);
      },
      error: () => {
        this.searching.set(false);
        this.toast.error('Could not load repository records.');
      },
    });
  }

  pick(record: RepoItem): void {
    this.loadingBatches.set(true);
    this.service.getRepositoryBatch(record.id).subscribe({
      next: (batches) => {
        this.loadingBatches.set(false);
        if (!this.createDirectly()) {
          this.picked.emit({ record, batches });
          return;
        }
        this.chosen.set(record);
        this.taxChange.set(null);
        this.variantName.set(record.itemName);
        this.hadHeldBatches.set(batches.length > 0);
        this.rows.set(
          batches.length
            ? batches.map((b) => ({ batchCode: b.barcode, price: b.price, quantity: b.quantity }))
            : [{ batchCode: '', price: null, quantity: 0 }],
        );
        this.step.set('confirm');
      },
      error: () => {
        this.loadingBatches.set(false);
        this.toast.error('Could not load the held batches for this record.');
      },
    });
  }

  back(): void {
    this.step.set('pick');
    this.chosen.set(null);
  }

  patchRow(index: number, field: keyof QuickBatchRow, value: string | number | null): void {
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  create(): void {
    const record = this.chosen();
    if (!record) return;
    const name = this.variantName().trim();
    if (!name) return this.toast.error('Variant name is required.');
    if (!this.wareHouseId()) return this.toast.error('Choose a warehouse.');

    const seen = new Set<string>();
    for (const r of this.rows()) {
      const code = r.batchCode.trim();
      if (!code) return this.toast.error('Every batch needs a batch code.');
      if (seen.has(code.toLowerCase())) return this.toast.error(`Batch code "${code}" is listed twice.`);
      seen.add(code.toLowerCase());
      if (r.price === null || (r.price as unknown) === '' || Number(r.price) < 0) {
        return this.toast.error(`Enter a price for batch "${code}".`);
      }
      if (Number(r.quantity) < 0) return this.toast.error(`Quantity for batch "${code}" can't be negative.`);
    }

    this.creating.set(true);
    this.service
      .createVariantFromRepository({
        itemId: this.itemId(),
        repoId: record.id,
        variantName: name,
        returnDays: Number(this.itemReturnDays()) || 0,
        rows: this.rows().map((r) => ({
          batchCode: r.batchCode.trim(),
          price: Number(r.price),
          quantity: Number(r.quantity) || 0,
          wareHouseId: this.wareHouseId(),
        })),
      })
      .subscribe({
        next: (result) => {
          this.creating.set(false);
          if (result !== 'Saved Successfully') {
            this.toast.error(result || 'The variant could not be created. Check the batches and try again.');
            return;
          }
          this.toast.success(`Variant created and linked to ${record.itemCode}.`);
          this.synced.emit(this.taxChange());
        },
        error: (e: { message?: string }) => {
          this.creating.set(false);
          this.toast.error(e?.message || 'The variant could not be created.');
        },
      });
  }
}
