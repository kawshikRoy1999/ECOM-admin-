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
  binId: number;
  qty: number;
  /** Include this item in the invoice (the .NET page uses a checkbox per row). */
  selected: boolean;
}

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
      }));
    this.rows.set(rows);
    rows.forEach((r) => this.loadWarehouses(r));
  }

  private loadWarehouses(row: AllocRow): void {
    this.service.warehouses(row.item.itemId, row.item.itemVariantId).subscribe({
      next: (w) => {
        row.warehouses = w;
        this.rows.set([...this.rows()]);
      },
    });
  }

  onWarehouse(row: AllocRow, id: number): void {
    row.warehouseId = Number(id);
    row.binId = 0;
    row.bins = [];
    this.rows.set([...this.rows()]);
    if (id) {
      this.service.bins(row.item.itemId, row.item.itemVariantId, Number(id)).subscribe({
        next: (b) => {
          row.bins = b;
          this.rows.set([...this.rows()]);
        },
      });
    }
  }

  onBin(row: AllocRow, id: number): void {
    row.binId = Number(id);
    this.rows.set([...this.rows()]);
  }

  warehouseName(row: AllocRow): string {
    return row.warehouses.find((w) => w.storeId === row.warehouseId)?.storeName ?? '';
  }
  binName(row: AllocRow): string {
    return row.bins.find((b) => b.id === row.binId)?.name ?? '';
  }

  toggle(row: AllocRow, on: boolean): void {
    row.selected = on;
    this.rows.set([...this.rows()]);
  }

  allSelected(): boolean {
    return this.rows().length > 0 && this.rows().every((r) => r.selected);
  }

  toggleAll(on: boolean): void {
    this.rows().forEach((r) => (r.selected = on));
    this.rows.set([...this.rows()]);
  }

  /**
   * Like the .NET GenerateInvoice: only the ticked items are required. Warehouse and bin are optional —
   * stock allocation is sent only for rows where both were chosen. "Last invoice" is worked out from the
   * quantities (every order line fully covered by delivered + invoiced) instead of being asked.
   */
  generate(): void {
    const picked = this.rows().filter((r) => r.selected && Number(r.qty) > 0);
    if (!picked.length) {
      this.toast.error('Select at least one item to invoice.');
      return;
    }
    const over = picked.find((r) => Number(r.qty) > r.item.orderQty - (r.item.deliveredQty ?? 0));
    if (over) {
      this.toast.error(`Quantity for "${over.item.itemName}" is more than what is left to deliver.`);
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
