import { Component, inject, input, output } from '@angular/core';

import { Modal } from '../../shared/ui/modal/modal';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { OrdersService } from './orders.service';

export type InvoicePrintType = 'normal' | 'thermal';

/**
 * "Print Invoice" chooser — the two formats of the .NET admin:
 *  - Standard (A4): original + customer copy side by side (statement html | htmlc)
 *  - 3-inch Slip  : the same HTML re-laid out for an 80mm thermal roll by public/invoice/thermal.js
 * Used by the order list and the order detail page.
 */
@Component({
  selector: 'app-invoice-print',
  imports: [Modal],
  template: `
    <app-modal title="Print Invoice" widthClass="max-w-sm" (close)="close.emit()">
      <p class="text-[12.5px] text-slate-500 mb-3">
        Invoice <span class="font-mono font-semibold text-slate-700">{{ invoiceNo() }}</span> — choose a format.
      </p>
      <div class="grid grid-cols-2 gap-2">
        <button type="button" (click)="print('normal')"
          class="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-4 hover:border-brand-400 hover:bg-brand-50/40 cursor-pointer transition-colors">
          <svg class="h-6 w-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span class="text-[12.5px] font-semibold text-slate-800">Standard (A4)</span>
          <span class="text-[10.5px] text-slate-400">Original + copy</span>
        </button>
        <button type="button" (click)="print('thermal')"
          class="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-4 hover:border-brand-400 hover:bg-brand-50/40 cursor-pointer transition-colors">
          <svg class="h-6 w-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M7 3h10v18l-2-1.5L13 21l-1-1.5L11 21l-2-1.5L7 21V3zm3 5h4m-4 4h4" /></svg>
          <span class="text-[12.5px] font-semibold text-slate-800">3-inch Slip</span>
          <span class="text-[10.5px] text-slate-400">80mm thermal printer</span>
        </button>
      </div>
    </app-modal>
  `,
})
export class InvoicePrint {
  private readonly service = inject(OrdersService);
  private readonly toast = inject(ToastService);

  readonly invoiceNo = input.required<string>();
  readonly close = output<void>();

  /** Opens the tab synchronously on the click (so pop-up blockers allow it), then fills it once loaded. */
  print(type: InvoicePrintType): void {
    const invoiceNo = this.invoiceNo();
    this.close.emit();

    const w = window.open('', '_blank');
    if (!w) {
      this.toast.error('Allow pop-ups for this site to view the invoice.');
      return;
    }
    w.document.write(`<p style="font:14px sans-serif;padding:24px;color:#64748b">Loading invoice ${invoiceNo}…</p>`);

    const asset = (f: string) => new URL(`invoice/${f}`, document.baseURI).href;
    this.service.getStatement(invoiceNo, type === 'thermal').subscribe({
      next: (stmt) => {
        const toolbar = `<div class="no-print" style="padding:10px 12px;background:#f1f5f9;display:flex;gap:8px;font:13px sans-serif">
            <button onclick="window.print()" style="padding:6px 14px;background:#2563eb;color:#fff;border:0;border-radius:6px;cursor:pointer">Print / Save PDF</button>
            <button onclick="window.close()" style="padding:6px 14px;background:#e2e8f0;border:0;border-radius:6px;cursor:pointer">Close</button>
          </div>`;
        const body =
          type === 'thermal'
            ? `<link rel="stylesheet" href="${asset('thermal.css')}">
               ${toolbar}
               <div id="thermal-src" class="thermal-src">${stmt.html}</div>
               <div id="thermal-srcc" class="thermal-src">${stmt.htmlc}</div>
               <div id="thermal-out" class="rcpt"></div>
               <script src="${asset('invoice-fields.js')}"></scr` + `ipt>
               <script src="${asset('thermal.js')}"></scr` + `ipt>`
            : `${toolbar}
               <div id="invA4" style="width:49.5%;display:inline-block;vertical-align:top;">${stmt.html}</div>
               <div id="invA4c" style="width:49.5%;display:inline-block;vertical-align:top;">${stmt.htmlc}</div>
               <script src="${asset('invoice-fields.js')}"></scr` + `ipt>
               <script>
                 if (window.InvoiceFields) {
                   InvoiceFields.stripEmptyFields(document.getElementById('invA4'));
                   InvoiceFields.stripEmptyFields(document.getElementById('invA4c'));
                 }
                 setTimeout(function () { window.print(); }, 500);
               </scr` + `ipt>`;
        w.document.open();
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${invoiceNo}</title>
          <style>body{margin:0} @media print{.no-print{display:none!important}}</style></head><body>${body}</body></html>`);
        w.document.close();
      },
      error: (e: { message?: string }) => {
        w.close();
        this.toast.error(e?.message || 'Could not load the invoice.');
      },
    });
  }
}
