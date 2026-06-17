import { Component, inject, signal } from '@angular/core';

import { Modal } from '../../../shared/ui/modal/modal';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { TemplateEditor } from '../invoice-template/template-editor';
import { TEMPLATE_PROVIDER, TemplatePlaceholder } from '../invoice-template/template-provider';
import { OrderTemplateService } from './order-template.service';
import { OrderField, OrderTemplateMaster } from './order-template.models';

@Component({
  selector: 'app-order-template-page',
  imports: [TemplateEditor, Modal],
  providers: [{ provide: TEMPLATE_PROVIDER, useExisting: OrderTemplateService }],
  templateUrl: './order-template.page.html',
})
export class OrderTemplatePage {
  private readonly service = inject(OrderTemplateService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly galleryOpen = signal(false);
  /** Forces the editor to reload after a master design is applied. */
  readonly editorKey = signal(0);

  readonly fields = signal<OrderField[]>([]);
  readonly fieldsLoading = signal(false);

  readonly masters = signal<OrderTemplateMaster[]>([]);
  readonly mastersLoading = signal(false);

  readonly placeholders: TemplatePlaceholder[] = [
    { name: 'Order Number', tag: 'OrderNumber' },
    { name: 'Order Date', tag: 'OrderDate' },
    { name: 'Order Status', tag: 'OrderStatus' },
    { name: 'Customer Name', tag: 'CustomerName' },
    { name: 'Customer Email', tag: 'CustomerEmail' },
    { name: 'Customer Phone', tag: 'CustomerPhone' },
    { name: 'Billing Address', tag: 'BillingAddress' },
    { name: 'Shipping Address', tag: 'ShippingAddress' },
    { name: 'Payment Method', tag: 'PaymentMethod' },
    { name: 'Subtotal', tag: 'Subtotal' },
    { name: 'Tax Amount', tag: 'TaxAmount' },
    { name: 'Shipping Charge', tag: 'ShippingCharge' },
    { name: 'Total Amount', tag: 'TotalAmount' },
    { name: 'Company Name', tag: 'CompanyName' },
    { name: 'Company Address', tag: 'CompanyAddress' },
    { name: 'Items Table', tag: 'ItemsTable' },
  ];

  constructor() {
    this.loadFields();
    this.loadMasters();
  }

  loadFields(): void {
    this.fieldsLoading.set(true);
    this.service.getFields().subscribe({
      next: (rows) => {
        this.fields.set(rows ?? []);
        this.fieldsLoading.set(false);
      },
      error: () => this.fieldsLoading.set(false),
    });
  }

  toggleField(field: OrderField, checked: boolean): void {
    this.service.toggleField(field.configurationId, checked).subscribe({
      next: () => {
        field.isActive = checked;
        this.fields.set([...this.fields()]);
        this.toast.success('Field updated.');
      },
    });
  }

  loadMasters(): void {
    this.mastersLoading.set(true);
    this.service.getMasters().subscribe({
      next: (rows) => {
        this.masters.set(rows ?? []);
        this.mastersLoading.set(false);
      },
      error: () => this.mastersLoading.set(false),
    });
  }

  async applyMaster(master: OrderTemplateMaster): Promise<void> {
    const ok = await this.confirm.ask(
      'Apply this design to the order template? It will replace the current one.',
      { confirmLabel: 'Apply' },
    );
    if (!ok) return;
    this.service.applyMaster(master.orderTemplateMasterId).subscribe({
      next: () => {
        this.toast.success('Design applied successfully.');
        this.galleryOpen.set(false);
        this.editorKey.update((k) => k + 1); // remount editor to reload
      },
    });
  }
}
