import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, skip } from 'rxjs/operators';

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

  readonly active = signal('');
  readonly showAdvanced = signal(false);

  readonly isRefund = computed(() => this.active() === 'refund');
  readonly isReturn = computed(() => this.active() === 'returnorder');
  readonly isOrder = computed(() => !this.isRefund() && !this.isReturn());

  readonly rows = signal<OrderListItem[]>([]);
  readonly refundRows = signal<RefundItem[]>([]);
  readonly returnRows = signal<ReturnItem[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly pageNo = signal(1);
  readonly totalPages = signal(1);
  readonly totalRecords = signal(0);

  readonly tabs = computed<TabItem[]>(() => {
    const activeTab = this.active();
    
    // Determine count to display
    let activeCount = 0;
    if (activeTab === 'refund') {
      activeCount = this.refundRows().length;
    } else if (activeTab === 'returnorder') {
      activeCount = this.returnRows().length;
    } else {
      activeCount = this.totalRecords();
    }

    const countSuffix = activeCount > 0 ? ` (${activeCount})` : '';

    return [
      { id: '', label: activeTab === '' ? `All Orders${countSuffix}` : 'All Orders' },
      { id: 'cancelrequested', label: activeTab === 'cancelrequested' ? `Cancel Requests${countSuffix}` : 'Cancel Requests' },
      { id: 'cancelled', label: activeTab === 'cancelled' ? `Cancelled${countSuffix}` : 'Cancelled' },
      { id: 'delivered', label: activeTab === 'delivered' ? `Delivered${countSuffix}` : 'Delivered' },
      { id: 'refund', label: activeTab === 'refund' ? `Refund${countSuffix}` : 'Refund' },
      { id: 'returnorder', label: activeTab === 'returnorder' ? `Return${countSuffix}` : 'Return' },
    ];
  });

  // Depletion trackers for APIs that don't return total page counts
  readonly refundsDepleted = signal(false);
  readonly returnsDepleted = signal(false);

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

  constructor() {
    this.load();

    // Auto-apply filters when any search input changes (debounced by 400ms)
    toObservable(computed(() => ({
      cName: this.cName(),
      orderno: this.orderno(),
      custphone: this.custphone(),
      pinCode: this.pinCode(),
      fromDate: this.fromDate(),
      toDate: this.toDate(),
    }))).pipe(
      skip(1), // Skip initial evaluation
      debounceTime(400)
    ).subscribe(() => {
      this.applyFilters();
    });
  }

  changeTab(id: string): void {
    this.active.set(id);
    this.pageNo.set(1);
    this.totalRecords.set(0);
    this.refundRows.set([]);
    this.returnRows.set([]);
    this.refundsDepleted.set(false);
    this.returnsDepleted.set(false);
    this.load();
  }

  applyFilters(): void {
    this.pageNo.set(1);
    this.totalRecords.set(0);
    this.refundRows.set([]);
    this.returnRows.set([]);
    this.refundsDepleted.set(false);
    this.returnsDepleted.set(false);
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
          const list = rows ?? [];
          this.refundRows.set(list);
          this.refundsDepleted.set(list.length < 20);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else if (this.isReturn()) {
      this.service.listReturns(filters).subscribe({
        next: (rows) => {
          const list = rows ?? [];
          this.returnRows.set(list);
          this.returnsDepleted.set(list.length < 20);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.service.list({ custOrdStatus: this.active(), ...filters }).subscribe({
        next: (res) => {
          const list = res?.orderListV2 ?? [];
          if (list.length > 0) {
            console.log('API Order Row Keys:', Object.keys(list[0]), list[0]);
          }
          this.rows.set(list);
          this.totalPages.set(res?.totalPageNumber ?? 1);
          this.totalRecords.set(res?.totalRecord ?? 0);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  onTableScroll(event: Event): void {
    const el = event.target as HTMLElement;
    // Check if scrolled near the bottom (within 60px)
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
      this.loadNextPage();
    }
  }

  loadNextPage(): void {
    let hasMore = false;
    if (this.isRefund()) {
      hasMore = !this.refundsDepleted() && !this.loadingMore() && !this.loading();
    } else if (this.isReturn()) {
      hasMore = !this.returnsDepleted() && !this.loadingMore() && !this.loading();
    } else {
      hasMore = this.pageNo() < this.totalPages() && !this.loadingMore() && !this.loading();
    }

    if (!hasMore) return;

    this.loadingMore.set(true);
    const nextPage = this.pageNo() + 1;
    this.pageNo.set(nextPage);

    const filters = {
      cName: this.cName(),
      orderno: this.orderno(),
      custphone: this.custphone(),
      pinCode: this.pinCode(),
      fromDate: this.fromDate(),
      toDate: this.toDate(),
      pageNo: nextPage,
    };

    if (this.isRefund()) {
      this.service.listRefunds(filters).subscribe({
        next: (rows) => {
          const list = rows ?? [];
          this.refundRows.update((existing) => [...existing, ...list]);
          this.refundsDepleted.set(list.length < 20);
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false),
      });
    } else if (this.isReturn()) {
      this.service.listReturns(filters).subscribe({
        next: (rows) => {
          const list = rows ?? [];
          this.returnRows.update((existing) => [...existing, ...list]);
          this.returnsDepleted.set(list.length < 20);
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false),
      });
    } else {
      this.service.list({ custOrdStatus: this.active(), ...filters }).subscribe({
        next: (res) => {
          const list = res?.orderListV2 ?? [];
          this.rows.update((existing) => [...existing, ...list]);
          this.totalPages.set(res?.totalPageNumber ?? 1);
          this.totalRecords.set(res?.totalRecord ?? 0);
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false),
      });
    }
  }

  open(o: OrderListItem): void {
    this.router.navigate(['/orders', o.orderId]);
  }

  getRefundRisk(r: RefundItem): { label: string; class: string; info: string } {
    const amount = r.itemTotalAmountAtInvoice ?? 0;
    const qty = r.itemQty ?? 0;

    if (amount > 1000 || qty > 5) {
      return { label: 'High Risk', class: 'danger', info: 'Suspicious order quantity or refund invoice amount > 1000.' };
    }
    if (amount > 400) {
      return { label: 'Medium Risk', class: 'warning', info: 'Refund invoice amount between 400 and 1000.' };
    }
    return { label: 'Low Risk', class: 'success', info: 'Standard refund claim request bounds.' };
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
    const ok = await this.confirm.ask(`Approve return of "${r.itemName}"?`, { confirmLabel: 'Approve' });
    if (!ok) return;
    this.service.updateReturnStatus(r, 1).subscribe({
      next: () => {
        this.toast.success('Return updated.');
        this.load();
      },
    });
  }

  viewInvoice(invoiceNo: string): void {
    if (!invoiceNo) return;
    this.service.getStatement(invoiceNo).subscribe({
      next: (stmt) => {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${invoiceNo}</title>
            <style>body{margin:0;padding:0;} @media print{.no-print{display:none}}</style>
            </head><body>
            <div class="no-print" style="padding:12px;background:#f1f5f9;display:flex;gap:8px;align-items:center">
              <button onclick="window.print()" style="padding:6px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print / Save PDF</button>
              <button onclick="window.close()" style="padding:6px 16px;background:#e2e8f0;border:none;border-radius:6px;cursor:pointer;font-size:13px">Close</button>
            </div>
            \${stmt.html}\${stmt.htmlc ? \`<hr style="margin:20px 0">\${stmt.htmlc}\` : ''}
            </body></html>`);
          w.document.close();
        }
      },
    });
  }
}
