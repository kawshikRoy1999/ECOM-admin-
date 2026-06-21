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

  // Payment — plain properties so [(ngModel)] two-way binding works
  mode = 'Cash';
  status = 'Paid';
  note = '';
  isLastInvoice = true;

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

  generate(): void {
    const allocations: InvoiceAllocation[] = this.rows()
      .filter((r) => r.warehouseId && r.binId && r.qty > 0)
      .map((r) => ({
        item: r.item,
        warehouseId: r.warehouseId,
        warehouseName: this.warehouseName(r),
        binId: r.binId,
        binName: this.binName(r),
        qty: Number(r.qty),
      }));

    if (!allocations.length) {
      this.toast.error('Allocate at least one item to a warehouse and bin.');
      return;
    }

    this.generating.set(true);
    this.service
      .generateInvoice(this.orderId(), allocations, {
        mode: this.mode,
        status: this.status,
        note: this.note,
        isLastInvoice: this.isLastInvoice,
      })
      .subscribe({
        next: () => {
          this.generating.set(false);
          this.toast.success('Invoice generated.');
          this.done.emit();
        },
        error: () => this.generating.set(false),
      });
  }
}
