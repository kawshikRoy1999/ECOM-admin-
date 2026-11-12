import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { forkJoin, of, map, switchMap, catchError, Observable } from 'rxjs';

import { ToastService } from '../../shared/ui/toast/toast.service';
import { InvoiceAllocation, OrdersService } from './orders.service';
import { InvoiceGenerate } from './invoice-generate';
import { InvoicePrint } from './invoice-print';
import { DeliveryPersonOption, InvoiceTracking, ItemRateQty, OrderDetail, OrderItem } from './order.models';
import { Tabs, TabItem } from '../../shared/ui/tabs/tabs';
import { Select } from '../../shared/ui/select/select';
import { TooltipService } from '../../shared/ui/tooltip.service';

@Component({
  selector: 'app-order-detail-page',
  imports: [RouterLink, InvoicePrint, FormsModule, InvoiceGenerate, DecimalPipe, DatePipe, Tabs, Select],
  templateUrl: './order-detail.page.html',
})
export class OrderDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(OrdersService);
  private readonly toast = inject(ToastService);
  public readonly tooltip = inject(TooltipService);

  readonly tabs: TabItem[] = [
    { id: 'items', label: 'Items List' },
    { id: 'manage', label: 'Status & Delivery' },
    { id: 'history', label: 'Payments & Log' },
  ];
  readonly activeTab = signal('items');

  private orderId = 0;
  readonly detail = signal<OrderDetail | null>(null);
  readonly loading = signal(false);
  readonly savingStatus = signal(false);
  readonly sendingEmail = signal(false);
  readonly sendingTracking = signal(false);
  /**
   * Send Tracking, Send Invoice Email and the order-level "Update Status Details" form are not on the
   * .NET order page, so they are hidden. Flip to true to bring them back.
   */
  readonly showNonLegacyActions = false;
  readonly invoiceModalOpen = signal(false);
  /** True while checking stock locations / generating a one-click invoice. */
  readonly preparingInvoice = signal(false);
  readonly viewingInvoice = signal(false);
  readonly deliveryPersons = signal<DeliveryPersonOption[]>([]);
  readonly assigningDelivery = signal(false);
  readonly previewImageUrl = signal<string>('');
  // selected delivery person per invoiceId
  selectedDeliveryPerson: Record<number, string> = {};

  // Action-panel form state — plain properties for ngModel
  paymentStatus = '';
  deliveryStatus = '';
  paymentNote = '';
  deliveryNote = '';
  paidAmount = 0;
  trackingUrl = '';
  trackingId = '';

  constructor() {
    this.orderId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.detail(this.orderId).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.paymentStatus = d?.selectedPaymentStatus?.paymentStatuslkupvalue ?? '';
        this.deliveryStatus = d?.selectedDeliveryStatus?.deliveryStatuslkupvalue ?? '';
        this.paymentNote = d?.paymentNotes ?? '';
        this.deliveryNote = d?.deliveryNotes ?? '';
        this.paidAmount = d?.customerPaidAmount ?? 0;
        this.trackingUrl = d?.delvTrackingUrl ?? '';
        this.trackingId = d?.delvTrackingId ?? '';
        this.loading.set(false);
        this.loadDeliveryPersons(d?.invoiceTrackingDetail ?? []);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadDeliveryPersons(tracking: import('./order.models').InvoiceTracking[]): void {
    const storeIds = [...new Set(tracking.map((t) => t.storeId).filter((id) => id > 0))];
    if (!storeIds.length) return;
    const calls = storeIds.map((id) => this.service.getDeliveryPersonsByWarehouse(id));
    forkJoin(calls.length ? calls : [of([])]).subscribe({
      next: (results) => {
        const seen = new Set<string>();
        const merged: import('./order.models').DeliveryPersonOption[] = [];
        for (const list of results) {
          for (const p of list ?? []) {
            if (p.userId && !seen.has(p.userId)) {
              seen.add(p.userId);
              p.fullName = p.fullName || `${p.firstName} ${p.lastName}`.trim();
              merged.push(p);
            }
          }
        }
        this.deliveryPersons.set(merged);
      },
    });
  }

  assignDelivery(inv: InvoiceTracking): void {
    const personId = this.selectedDeliveryPerson[inv.invoiceId];
    if (!personId) {
      this.toast.error('Select a delivery person first.');
      return;
    }
    this.assigningDelivery.set(true);
    this.service.assignDeliveryPerson(personId, inv.invoiceId, inv.storeId).subscribe({
      next: () => {
        this.assigningDelivery.set(false);
        this.toast.success('Delivery person assigned.');
        this.load();
      },
      error: () => this.assigningDelivery.set(false),
    });
  }

  deliveryPersonName(userId: string): string {
    const p = this.deliveryPersons().find((d) => d.userId === userId);
    return p ? (p.fullName || `${p.firstName} ${p.lastName}`.trim()) : userId;
  }

  /** Unique non-empty invoice numbers across all order items. */
  invoiceNumbers(items?: OrderItem[]): string[] {
    if (!items?.length) return [];
    return [...new Set(items.map((i) => i.invoiceNumber).filter(Boolean))];
  }

  getInvoiceNo(): string | null {
    const d = this.detail();
    if (!d) return null;
    if (d.invoiceNo) return d.invoiceNo;
    const nums = this.invoiceNumbers(d.orderDtl);
    return nums.length ? nums[0] : null;
  }

  /** Look up the rate/amount row for a given order item from order.data. */
  rateFor(item: OrderItem, data?: any[]): any | undefined {
    if (!data?.length) return undefined;
    
    // 1. Try matching both itemId and variantId exactly
    const exactMatch = data.find((r) => {
      const rId = r.id ?? r.itemId ?? r.itemid;
      const rVariantId = r.variantid ?? r.variantId ?? r.itemVariantId;
      return rId !== undefined && Number(rId) === Number(item.itemId) &&
             rVariantId !== undefined && Number(rVariantId) === Number(item.itemVariantId);
    });
    if (exactMatch) return exactMatch;
    
    // 2. Fallback: match by itemId only (in case variant mappings are not populated or zeroed)
    return data.find((r) => {
      const rId = r.id ?? r.itemId ?? r.itemid;
      return rId !== undefined && Number(rId) === Number(item.itemId);
    });
  }

  /** Item name without the "CODE - " prefix the API prepends (the code has its own column). */
  displayName(it: OrderItem): string {
    const name = (it.itemName || '').trim();
    const code = (it.itemCode || '').trim();
    if (code && name.toLowerCase().startsWith(code.toLowerCase())) {
      return name.slice(code.length).replace(/^\s*[-–:]\s*/, '') || name;
    }
    return name;
  }

  /** Only the distinguishing part of the variant name (e.g. "250 GM" from "Garam Masala/250 GM"). */
  variantLabel(it: OrderItem): string {
    const v = (it.itemVariantName || '').trim();
    if (!v) return '';
    const base = this.displayName(it).toLowerCase();
    if (v.toLowerCase().startsWith(base)) {
      const rest = v.slice(base.length).replace(/^\s*[/\-–:]\s*/, '').trim();
      return rest;
    }
    return v.toLowerCase() === base ? '' : v;
  }

  /** Build delivery address string, skipping blanks. */
  formatAddress(parts: (string | undefined | null)[]): string {
    return parts.filter(Boolean).join(', ');
  }

  statusClass(status: string): string {
    const s = (status ?? '').toLowerCase();
    if (s.includes('deliver') || s.includes('complet') || s.includes('success'))
      return 'success';
    if (s.includes('cancel') || s.includes('refund') || s.includes('return') || s.includes('fail'))
      return 'danger';
    if (s.includes('partial') || s.includes('invoic') || s.includes('pending') || s.includes('placed') || s.includes('process') || s.includes('dispatch') || s.includes('ready'))
      return 'warning';
    return 'neutral';
  }

  saveStatus(): void {
    const d = this.detail();
    if (!d) return;
    this.savingStatus.set(true);
    this.service
      .updateStatus({
        orderId: this.orderId,
        invoiceId: d.invId,
        invId: d.invId,
        paymentStatusValue: this.paymentStatus,
        delvStatusLkupValue: this.deliveryStatus,
        paymentNote: this.paymentNote,
        delvNote: this.deliveryNote,
        paidAmt: Number(this.paidAmount),
        delvChargeAmt: d.order?.deliverychargeamt ?? 0,
        delvTrackingUrl: this.trackingUrl,
        delvTrackingId: this.trackingId,
      })
      .subscribe({
        next: () => {
          this.savingStatus.set(false);
          this.toast.success('Order status updated.');
          this.load();
        },
        error: () => this.savingStatus.set(false),
      });
  }

  sendInvoiceEmail(): void {
    const d = this.detail();
    if (!d) return;
    this.sendingEmail.set(true);
    this.service.sendInvoiceEmail(d.invId).subscribe({
      next: () => {
        this.sendingEmail.set(false);
        this.toast.success('Invoice email sent.');
      },
      error: () => this.sendingEmail.set(false),
    });
  }

  /**
   * Generate Invoice. When every item still to deliver has exactly one warehouse holding it, and that
   * warehouse has exactly one bin, there is nothing to choose — invoice everything straight away.
   * Otherwise (several locations, serialized items, or a lookup failing) open the allocation popup.
   */
  startInvoice(): void {
    const d = this.detail();
    if (!d || this.preparingInvoice()) return;
    const pending = (d.orderDtl ?? []).filter((it) => it.orderQty - (it.deliveredQty ?? 0) > 0);
    if (!pending.length) {
      this.toast.error('All items are already invoiced or delivered.');
      return;
    }
    if (pending.some((it) => it.isSerialized)) {
      this.invoiceModalOpen.set(true);
      return;
    }

    this.preparingInvoice.set(true);
    const lookups: Observable<InvoiceAllocation | null>[] = pending.map((it) =>
      this.service.warehouses(it.itemId, it.itemVariantId).pipe(
        switchMap((whs) => {
          if (whs.length !== 1) return of(null);
          const wh = whs[0];
          return this.service.bins(it.itemId, it.itemVariantId, wh.storeId).pipe(
            map((bins) =>
              bins.length === 1
                ? {
                    item: it,
                    warehouseId: wh.storeId,
                    warehouseName: wh.storeName,
                    binId: bins[0].id,
                    binName: bins[0].name,
                    qty: it.orderQty - (it.deliveredQty ?? 0),
                  }
                : null,
            ),
          );
        }),
        catchError(() => of(null)),
      ),
    );

    forkJoin(lookups).subscribe((allocs) => {
      if (allocs.some((a) => a === null)) {
        this.preparingInvoice.set(false);
        this.invoiceModalOpen.set(true);
        return;
      }
      // Every pending line is invoiced in full, so this is the last invoice.
      this.service.generateInvoice(d.order?.orderId || this.orderId, allocs as InvoiceAllocation[], true).subscribe({
        next: () => {
          this.preparingInvoice.set(false);
          this.toast.success('Invoice generated.');
          this.onInvoiceGenerated();
        },
        error: (e: { message?: string }) => {
          this.preparingInvoice.set(false);
          this.toast.error(e?.message || 'Could not generate the invoice.');
        },
      });
    });
  }

  onInvoiceGenerated(): void {
    this.invoiceModalOpen.set(false);
    this.load();
  }

  /** Invoice number whose print-format chooser is open (null = closed). */
  readonly printChoiceFor = signal<string | null>(null);

  /** Opens the format chooser, like the .NET "Print Invoice" popup. */
  viewInvoice(invoiceNo: string): void {
    if (invoiceNo) this.printChoiceFor.set(invoiceNo);
  }




  sendTrackingEmail(): void {
    const d = this.detail();
    if (!d) return;
    if (!this.trackingId && !this.trackingUrl) {
      this.toast.error('Add a tracking ID or URL first, then save status.');
      return;
    }
    this.sendingTracking.set(true);
    this.service
      .sendTrackingEmail({
        invId: d.invId,
        trackingId: this.trackingId,
        trackingUrl: this.trackingUrl,
        invoiceNumber: d.invoiceNo,
        invoiceDate: d.invoiceDateAndTime,
      })
      .subscribe({
        next: () => {
          this.sendingTracking.set(false);
          this.toast.success('Tracking email sent.');
        },
        error: () => this.sendingTracking.set(false),
      });
  }

  logFromLabel(logFrom: string): string {
    const s = logFrom ?? '';
    if (s.includes('InvoiceStatus')) return 'Invoice Status';
    if (s.includes('OrderLineStatus')) return 'Line Item';
    if (s.includes('OrderStatus')) return 'Order Status';
    return s.replace(/Log$/, '').replace(/([A-Z])/g, ' $1').trim();
  }

  logFromColorClass(logFrom: string): string {
    const s = logFrom ?? '';
    if (s.includes('InvoiceStatus')) return 'bg-brand-50 border-brand-100 text-brand-700';
    if (s.includes('OrderLineStatus')) return 'bg-purple-50 border-purple-100 text-purple-700';
    if (s.includes('OrderStatus')) return 'bg-indigo-50 border-indigo-100 text-indigo-700';
    return 'bg-slate-50 border-slate-200 text-slate-650';
  }
}
