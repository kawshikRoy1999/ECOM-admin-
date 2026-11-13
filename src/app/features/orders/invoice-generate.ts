import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Modal } from '../../shared/ui/modal/modal';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { InvoiceAllocation, OrdersService } from './orders.service';
import { OrderItem, StockBin, Warehouse } from './order.models';

interface AllocRow {
  item: OrderItem;
  warehouses: Warehouse[];
  bins: StockBin[];
  warehouseId: number;
  /** 0 = not chosen. "No Bin" stock comes back from GetBinList with id -1, which is a valid choice. */
  binId: number;
  qty: number;
  /** Include this item in the invoice (the .NET page uses a checkbox per row). */
  selected: boolean;
  loadingWarehouses: boolean;
  loadingBins: boolean;
  /** Warehouse list loaded and empty: no warehouse holds stock of this variant. */
  noStock: boolean;
}

/**
 * Invoice allocation popup. Every invoiced item needs a warehouse and bin: the backend deducts
 * stock only from the locations it is given (UpdateStock), and rejects items without one.
 * Like the .NET page (GetDefaultSelectStock), a variant held in exactly one warehouse with exactly
 * one bin is filled in automatically, so the user only chooses where there is a real choice.
 */
@Component({
  selector: 'app-invoice-generate',
  imports: [FormsModule, Modal],
  templateUrl: './invoice-generate.html',
})
export class InvoiceGenerate implements OnInit {
  private readonly service = inject(OrdersService);
  private readonly toast = inject(ToastService);

  readonly orderId = input.required<number>();
  readonly items = input.required<OrderItem[]>();
  readonly close = output<void>();
  readonly done = output<void>();

  readonly rows = signal<AllocRow[]>([]);
  readonly generating = signal(false);

  ngOnInit(): void {
    const rows: AllocRow[] = this.items()
      .filter((it) => it.orderQty - (it.deliveredQty ?? 0) > 0)
      .map((it) => ({
        item: it,
        warehouses: [],
        bins: [],
        warehouseId: 0,
        binId: 0,
        qty: it.orderQty - (it.deliveredQty ?? 0),
        selected: true,
        loadingWarehouses: true,
        loadingBins: false,
        noStock: false,
      }));
    this.rows.set(rows);
    rows.forEach((r) => this.loadWarehouses(r));
  }

  private refresh(): void {
    this.rows.set([...this.rows()]);
  }

  private loadWarehouses(row: AllocRow): void {
    this.service.warehouses(row.item.itemId, row.item.itemVariantId).subscribe({
      next: (w) => {
        row.warehouses = w;
        row.loadingWarehouses = false;
        row.noStock = w.length === 0;
        this.refresh();
        // Only one place holds it: choose it (its bins load next and may auto-select too).
        if (w.length === 1) this.onWarehouse(row, w[0].storeId);
      },
      error: () => {
        row.loadingWarehouses = false;
        this.refresh();
      },
    });
  }

  onWarehouse(row: AllocRow, id: number): void {
    row.warehouseId = Number(id);
    row.binId = 0;
    row.bins = [];
    row.loadingBins = !!row.warehouseId;
    this.refresh();
    if (row.warehouseId) {
      this.service.bins(row.item.itemId, row.item.itemVariantId, row.warehouseId).subscribe({
        next: (b) => {
          row.bins = b;
          row.loadingBins = false;
          if (b.length === 1) row.binId = b[0].id;
          this.refresh();
        },
        error: () => {
          row.loadingBins = false;
          this.refresh();
        },
      });
    }
  }

  onBin(row: AllocRow, id: number): void {
    row.binId = Number(id);
    this.refresh();
  }

  warehouseName(row: AllocRow): string {
    return row.warehouses.find((w) => w.storeId === row.warehouseId)?.storeName ?? '';
  }
  binName(row: AllocRow): string {
    return this.selectedBin(row)?.name ?? '';
  }
  selectedBin(row: AllocRow): StockBin | null {
    return row.binId ? row.bins.find((b) => b.id === row.binId) ?? null : null;
  }

  /** Quantity asked for is more than the chosen bin holds. */
  overBin(row: AllocRow): boolean {
    const bin = this.selectedBin(row);
    return !!bin && Number(row.qty) > Number(bin.qty);
  }

  toggle(row: AllocRow, on: boolean): void {
    row.selected = on;
    this.refresh();
  }

  allSelected(): boolean {
    return this.rows().length > 0 && this.rows().every((r) => r.selected);
  }

  toggleAll(on: boolean): void {
    this.rows().forEach((r) => (r.selected = on));
    this.refresh();
  }

  /** Short item label for messages ("CLOTH WASH BRUSH" without the code prefix). */
  private label(row: AllocRow): string {
    const name = (row.item.itemName || '').trim();
    const code = (row.item.itemCode || '').trim();
    return code && name.startsWith(code) ? name.slice(code.length).replace(/^\s*[-–:]\s*/, '') || name : name;
  }

  /**
   * Only the ticked items are invoiced. Each needs a warehouse and bin with enough stock.
   * "Last invoice" is worked out from the quantities (every order line fully covered by delivered +
   * invoiced) instead of being asked.
   */
  generate(): void {
    const picked = this.rows().filter((r) => r.selected && Number(r.qty) > 0);
    if (!picked.length) {
      this.toast.error('Select at least one item to invoice.');
      return;
    }
    const over = picked.find((r) => Number(r.qty) > r.item.orderQty - (r.item.deliveredQty ?? 0));
    if (over) {
      this.toast.error(`Quantity for "${this.label(over)}" is more than what is left to deliver.`);
      return;
    }
    const empty = picked.find((r) => r.noStock);
    if (empty) {
      this.toast.error(`"${this.label(empty)}" has no stock in any warehouse. Add stock for it, or untick it.`);
      return;
    }
    const unallocated = picked.find((r) => !r.warehouseId || !r.binId);
    if (unallocated) {
      this.toast.error(`Choose a warehouse and bin for "${this.label(unallocated)}".`);
      return;
    }
    const short = picked.find((r) => this.overBin(r));
    if (short) {
      this.toast.error(
        `"${this.label(short)}": the chosen bin holds ${this.selectedBin(short)?.qty ?? 0}, but ${short.qty} are being invoiced.`,
      );
      return;
    }

    const allocations: InvoiceAllocation[] = picked.map((r) => ({
      item: r.item,
      warehouseId: r.warehouseId,
      warehouseName: this.warehouseName(r),
      binId: r.binId,
      binName: this.binName(r),
      qty: Number(r.qty),
    }));

    const invoicedQty = new Map(picked.map((r) => [r.item.orderDetailId, Number(r.qty)]));
    const isLastInvoice = this.items().every(
      (it) => (it.deliveredQty ?? 0) + (invoicedQty.get(it.orderDetailId) ?? 0) >= it.orderQty,
    );

    this.generating.set(true);
    this.service.generateInvoice(this.orderId(), allocations, isLastInvoice).subscribe({
      next: () => {
        this.generating.set(false);
        this.toast.success('Invoice generated.');
        this.done.emit();
      },
      error: (e: { message?: string }) => {
        this.generating.set(false);
        this.toast.error(e?.message || 'Could not generate the invoice.');
      },
    });
  }
}
