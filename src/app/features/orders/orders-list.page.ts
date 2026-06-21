import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Tabs, TabItem } from '../../shared/ui/tabs/tabs';
import { DataTable, Column } from '../../shared/ui/data-table/data-table';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { DateRangePicker } from '../../shared/ui/date-range-picker/date-range-picker';
import { OrdersService } from './orders.service';
import { OrderListItem, RefundItem, ReturnItem } from './order.models';
import { TooltipService } from '../../shared/ui/tooltip.service';

@Component({
  selector: 'app-orders-list-page',
  imports: [Tabs, DataTable, DateRangePicker, FormsModule],
  templateUrl: './orders-list.page.html',
})
export class OrdersListPage {
  private readonly service = inject(OrdersService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  public readonly tooltip = inject(TooltipService);

  readonly tabs: TabItem[] = [
    { id: '', label: 'All Orders' },
    { id: 'cancelrequested', label: 'Cancel Requests' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'refund', label: 'Refund' },
    { id: 'returnorder', label: 'Return' },
  ];
  readonly active = signal('');
  readonly showAdvanced = signal(false);

  readonly isRefund = computed(() => this.active() === 'refund');
  readonly isReturn = computed(() => this.active() === 'returnorder');
  readonly isOrder = computed(() => !this.isRefund() && !this.isReturn());

  readonly rows = signal<OrderListItem[]>([]);
  readonly refundRows = signal<RefundItem[]>([]);
  readonly returnRows = signal<ReturnItem[]>([]);
  readonly loading = signal(false);
  readonly pageNo = signal(1);
  readonly totalPages = signal(1);
  readonly totalRecords = signal(0);

  // filters
  readonly cName = signal('');
  readonly orderno = signal('');
  readonly custphone = signal('');
  readonly pinCode = signal('');
  readonly fromDate = signal('');
  readonly toDate = signal('');

  readonly columns: Column<OrderListItem>[] = [
    { key: 'custOrdNo', header: 'Order #' },
    { key: 'orderDateStr', header: 'Date' },
    { key: 'firstName', header: 'Customer', format: (o) => [o.firstName, o.lastName].filter(Boolean).join(' ') },
    { key: 'phone', header: 'Phone' },
    { key: 'total', header: 'Total', align: 'right', format: (o) => Number(o.total ?? 0).toFixed(2) },
    { key: 'statusName', header: 'Status' },
  ];

  readonly refundColumns: Column<RefundItem>[] = [
    { key: 'custOrdNo', header: 'Order #' },
    { key: 'invoiceNumber', header: 'Invoice' },
    { key: 'items', header: 'Item' },
    { key: 'itemQty', header: 'Qty', align: 'center', format: (r) => r.itemQty !== null ? String(r.itemQty) : '-' },
    { key: 'itemTotalAmountAtInvoice', header: 'Amount', align: 'right', format: (r) => Number(r.itemTotalAmountAtInvoice ?? 0).toFixed(2) },
    { key: 'invoiceLineItemStatus', header: 'Status' },
  ];

  readonly returnColumns: Column<ReturnItem>[] = [
    { key: 'imagePath', header: 'Image', align: 'center' },
    { key: 'itemName', header: 'Item' },
    { key: 'itemQty', header: 'Qty', align: 'center', format: (r) => r.itemQty !== null ? String(r.itemQty) : '-' },
    { key: 'amount', header: 'Amount', align: 'right', format: (r) => Number(r.amount ?? 0).toFixed(2) },
    { key: 'returnReason', header: 'Reason' },
    { key: 'returnImageList' as any, header: 'Evidence', align: 'center' },
    { key: 'statusName', header: 'Status' },
  ];

  readonly canPrev = computed(() => this.pageNo() > 1);
  readonly canNext = computed(() => this.pageNo() < this.totalPages());


  constructor() {
    this.load();
  }

  changeTab(id: string): void {
    this.active.set(id);
    this.pageNo.set(1);
    this.load();
  }

  applyFilters(): void {
    this.pageNo.set(1);
    this.load();
  }

  clearFilters(): void {
    this.cName.set('');
    this.orderno.set('');
    this.custphone.set('');
    this.pinCode.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.applyFilters();
  }

  load(): void {
    this.loading.set(true);
    const filters = {
      cName: this.cName(),
      orderno: this.orderno(),
      custphone: this.custphone(),
      pinCode: this.pinCode(),
      fromDate: this.fromDate(),
      toDate: this.toDate(),
      pageNo: this.pageNo(),
    };

    if (this.isRefund()) {
      this.service.listRefunds(filters).subscribe({
        next: (rows) => {
          this.refundRows.set(rows ?? []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else if (this.isReturn()) {
      this.service.listReturns(filters).subscribe({
        next: (rows) => {
          this.returnRows.set(rows ?? []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.service.list({ custOrdStatus: this.active(), ...filters }).subscribe({
        next: (res) => {
          this.rows.set(res?.orderListV2 ?? []);
          this.totalPages.set(res?.totalPageNumber ?? 1);
          this.totalRecords.set(res?.totalRecord ?? 0);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  prev(): void {
    if (!this.canPrev()) return;
    this.pageNo.update((p) => p - 1);
    this.load();
  }

  next(): void {
    if (!this.canNext()) return;
    this.pageNo.update((p) => p + 1);
    this.load();
  }

  open(o: OrderListItem): void {
    this.router.navigate(['/orders', o.orderId]);
  }

  // --- Refund / Return actions ---
  async approveRefund(r: RefundItem): Promise<void> {
    const ok = await this.confirm.ask(`Approve refund for order ${r.custOrdNo}?`, { confirmLabel: 'Approve' });
    if (!ok) return;
    this.service.approveRefund(r.orderId, r.orderDetailId).subscribe({
      next: () => {
        this.toast.success('Refund approved.');
        this.load();
      },
    });
  }

  async approveReturn(r: ReturnItem): Promise<void> {
    // status 1 = approved (advance the return); adjust if the lookup differs.
    const ok = await this.confirm.ask(`Approve return of "${r.itemName}"?`, { confirmLabel: 'Approve' });
    if (!ok) return;
    this.service.updateReturnStatus(r, 1).subscribe({
      next: () => {
        this.toast.success('Return updated.');
        this.load();
      },
    });
  }
}
