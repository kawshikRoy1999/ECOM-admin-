import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { Modal } from '../../shared/ui/modal/modal';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, skip } from 'rxjs/operators';

import { Tabs, TabItem } from '../../shared/ui/tabs/tabs';
import { DataTable, Column } from '../../shared/ui/data-table/data-table';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { DateRangePicker } from '../../shared/ui/date-range-picker/date-range-picker';
import { OrdersService } from './orders.service';
import { OrderListItem, RefundItem, ReturnItem } from './order.models';
import { InvoicePrint } from './invoice-print';
import { TooltipService } from '../../shared/ui/tooltip.service';

@Component({
  selector: 'app-orders-list-page',
  imports: [Tabs, DataTable, DateRangePicker, FormsModule, InvoicePrint, DecimalPipe, DatePipe, Modal],
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
  /** Return tab status filter: 15 requested (default), 17 returned, 18 rejected. */
  readonly returnStatus = signal<15 | 17 | 18>(15);
  /** Expected pickup date typed per return row (required to accept). */
  readonly pickupDates = signal<Record<string, string>>({});
  /** Cancel-request approval popup. */
  readonly cancelFor = signal<OrderListItem | null>(null);
  cancelExplanation = '';
  readonly savingCancel = signal(false);
  readonly exporting = signal(false);
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
      this.service.listReturns(filters, this.returnStatus()).subscribe({
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
      this.service.listReturns(filters, this.returnStatus()).subscribe({
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

  setReturnStatus(id: 15 | 17 | 18): void {
    if (this.returnStatus() === id) return;
    this.returnStatus.set(id);
    this.pageNo.set(1);
    this.load();
  }

  setPickupDate(r: ReturnItem, value: string): void {
    this.pickupDates.update((m) => ({ ...m, [r.returnItemId]: value }));
  }

  /** Accept (17) needs an expected pickup date, as in the .NET page; reject (18) does not. */
  async decideReturn(r: ReturnItem, statusId: 17 | 18): Promise<void> {
    const pickup = this.pickupDates()[r.returnItemId] || '';
    if (statusId === 17 && !pickup) {
      this.toast.error('Please provide the expected pickup date.');
      return;
    }
    const ok = await this.confirm.ask(
      statusId === 17 ? `Accept return of "${r.itemName}"?` : `Reject return of "${r.itemName}"?`,
      { confirmLabel: statusId === 17 ? 'Accept' : 'Reject', danger: statusId === 18 },
    );
    if (!ok) return;
    this.service.updateReturnStatus(r, statusId, pickup).subscribe({
      next: () => {
        this.toast.success(statusId === 17 ? 'Return request accepted.' : 'Return request rejected.');
        this.load();
      },
      error: (e: { message?: string }) => this.toast.error(e?.message || 'Could not update the return.'),
    });
  }

  // --- Cancel requests ---
  openCancelApproval(o: OrderListItem): void {
    this.cancelExplanation = '';
    this.cancelFor.set(o);
  }

  /** Approves every line of the order that carries a cancel request (the .NET popup does the same for the ticked lines). */
  saveCancelApproval(): void {
    const o = this.cancelFor();
    if (!o) return;
    const explanation = this.cancelExplanation.trim();
    if (!explanation) {
      this.toast.error('Please enter the cancel explanation.');
      return;
    }
    const lines = (o.orderDetails ?? []).filter((d) => d.orderDetailId);
    if (!lines.length) {
      this.toast.error('No order lines found for this request.');
      return;
    }
    this.savingCancel.set(true);
    forkJoin(
      lines.map((d) =>
        this.service.approveCancel(
          { orderId: d.orderId || o.orderId, orderDetailId: d.orderDetailId!, invoiceId: d.invoiceId ?? 0, invoiceDetailId: d.invoiceDetailId ?? 0 },
          explanation,
        ),
      ),
    ).subscribe({
      next: () => {
        this.savingCancel.set(false);
        this.cancelFor.set(null);
        this.toast.success('Cancellation approved.');
        this.load();
      },
      error: (e: { message?: string }) => {
        this.savingCancel.set(false);
        this.toast.error(e?.message || 'Could not approve the cancellation.');
      },
    });
  }

  // --- Export (the .NET "Export to Excel" button) ---
  /** Downloads every order matching the current filters as a CSV that opens in Excel. */
  exportOrders(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    const filters = {
      custOrdStatus: this.isOrder() ? this.active() : '',
      cName: this.cName(), orderno: this.orderno(), custphone: this.custphone(),
      pinCode: this.pinCode(), fromDate: this.fromDate(), toDate: this.toDate(),
    };
    const all: OrderListItem[] = [];
    const fetchPage = (page: number) => {
      this.service.list({ ...filters, pageNo: page }).subscribe({
        next: (res) => {
          all.push(...(res?.orderListV2 ?? []));
          const pages = res?.totalPageNumber ?? 1;
          if (page < pages && page < 100) fetchPage(page + 1);
          else this.downloadCsv(all);
        },
        error: () => {
          this.exporting.set(false);
          this.toast.error('Export failed.');
        },
      });
    };
    fetchPage(1);
  }

  private downloadCsv(rows: OrderListItem[]): void {
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Order No', 'Date', 'Status', 'Customer', 'Phone', 'Address', 'Items', 'Invoices', 'Item Total', 'Tax', 'Delivery', 'Discount', 'Grand Total', 'Paid'];
    const lines = rows.map((o) => [
      o.custOrdNo, o.orderDateStr, o.statusName, this.customerName(o), o.phone, this.addressLine(o),
      this.itemLines(o).join(' | '), this.invoices(o).map((i) => i.invoiceNumber).join(' | '),
      o.subTotal, o.tax, o.delvCharge, o.discount, o.total, o.paidAmount,
    ].map(esc).join(','));
    const blob = new Blob(['\ufeff' + [header.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.exporting.set(false);
    this.toast.success(`Exported ${rows.length} orders.`);
  }


  /** Invoice number whose print-format chooser is open. */
  readonly printChoiceFor = signal<string | null>(null);

  viewInvoice(invoiceNo: string): void {
    if (invoiceNo) this.printChoiceFor.set(invoiceNo);
  }

  customerName(o: OrderListItem): string {
    return [o.firstName, o.middleName, o.lastName].filter((x) => x && x.trim()).join(' ');
  }

  addressLine(o: OrderListItem): string {
    return [o.billAddress1, o.billAddress2, o.city, o.pin].filter((x) => x && String(x).trim()).join(', ');
  }

  /** Real invoices only (the API pads the list with InvoiceId 0 rows). */
  invoices(o: OrderListItem) {
    return (o.invoiceList ?? []).filter((i) => i.invoiceId && i.invoiceNumber);
  }

  itemLines(o: OrderListItem): string[] {
    return (o.orderDetails ?? [])
      .map((d) => (d.items ?? '').trim() + (d.serialNumber ? ` · SN ${d.serialNumber}` : ''))
      .filter(Boolean);
  }

  balance(o: OrderListItem): number {
    return Number(o.total ?? 0) - Number(o.paidAmount ?? 0);
  }

  statusClass(status: string): string {
    const s = (status ?? '').toLowerCase();
    if (s.includes('deliver') || s.includes('complet') || s.includes('success')) return 'success';
    if (s.includes('cancel') || s.includes('refund') || s.includes('return') || s.includes('fail')) return 'danger';
    if (s.includes('partial') || s.includes('invoic') || s.includes('pending') || s.includes('placed') || s.includes('process') || s.includes('dispatch') || s.includes('ready')) return 'warning';
    return 'neutral';
  }
}
