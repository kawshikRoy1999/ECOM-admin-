import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';

import { ToastService } from '../../shared/ui/toast/toast.service';
import { OrdersService } from './orders.service';
import { InvoiceGenerate } from './invoice-generate';
import { DeliveryPersonOption, InvoiceTracking, ItemRateQty, OrderDetail, OrderItem } from './order.models';
import { Tabs, TabItem } from '../../shared/ui/tabs/tabs';
import { Select } from '../../shared/ui/select/select';

@Component({
  selector: 'app-order-detail-page',
  imports: [RouterLink, FormsModule, InvoiceGenerate, DecimalPipe, DatePipe, Tabs, Select],
  templateUrl: './order-detail.page.html',
})
export class OrderDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(OrdersService);
  private readonly toast = inject(ToastService);

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
  readonly invoiceModalOpen = signal(false);
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

  /** Build delivery address string, skipping blanks. */
  formatAddress(parts: (string | undefined | null)[]): string {
    return parts.filter(Boolean).join(', ');
  }

  statusClass(status: string): string {
    const s = (status ?? '').toLowerCase();
    if (s.includes('deliver') || s.includes('complet'))
      return 'bg-emerald-50 text-emerald-700';
    if (s.includes('cancel') || s.includes('refund') || s.includes('return'))
      return 'bg-rose-50 text-rose-700';
    if (s.includes('partial') || s.includes('invoic'))
      return 'bg-amber-50 text-amber-700';
    return 'bg-slate-100 text-slate-600';
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

  onInvoiceGenerated(): void {
    this.invoiceModalOpen.set(false);
    this.load();
  }

  viewInvoice(invoiceNo: string): void {
    if (!invoiceNo) return;
    this.viewingInvoice.set(true);
    this.service.getStatement(invoiceNo).subscribe({
      next: (stmt) => {
        this.viewingInvoice.set(false);
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${invoiceNo}</title>
            <style>body{margin:0;padding:0;} @media print{.no-print{display:none}}</style>
            </head><body>
            <div class="no-print" style="padding:12px;background:#f1f5f9;display:flex;gap:8px;align-items:center">
              <button onclick="window.print()" style="padding:6px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print / Save PDF</button>
              <button onclick="window.close()" style="padding:6px 16px;background:#e2e8f0;border:none;border-radius:6px;cursor:pointer;font-size:13px">Close</button>
            </div>
            ${stmt.html}${stmt.htmlc ? `<hr style="margin:20px 0">${stmt.htmlc}` : ''}
            </body></html>`);
          w.document.close();
        }
      },
      error: () => this.viewingInvoice.set(false),
    });
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
