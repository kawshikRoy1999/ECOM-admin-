import { Component, inject, signal } from '@angular/core';

import { Tabs, TabItem } from '../../../shared/ui/tabs/tabs';
import { Modal } from '../../../shared/ui/modal/modal';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { TemplateEditor } from './template-editor';
import { InvoiceTemplateService } from './invoice-template.service';
import { InvoiceField, TemplateDocType, TemplateMaster } from './invoice-template.models';

@Component({
  selector: 'app-invoice-template-page',
  imports: [TemplateEditor, Modal],
  templateUrl: './invoice-template.page.html',
})
export class InvoiceTemplatePage {
  private readonly service = inject(InvoiceTemplateService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly galleryOpen = signal(false);
  readonly active = signal<TemplateDocType>('INVOICE');

  // Field configuration
  readonly fields = signal<InvoiceField[]>([]);
  readonly fieldsLoading = signal(false);

  // Template design masters
  readonly masters = signal<TemplateMaster[]>([]);
  readonly mastersLoading = signal(false);
  readonly applyTo = signal<TemplateDocType>('INVOICE');

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

  toggleField(field: InvoiceField, checked: boolean): void {
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

  async applyMaster(master: TemplateMaster): Promise<void> {
    const ok = await this.confirm.ask(
      `Apply this design to the ${this.applyTo()} template? It will replace the current one.`,
      { confirmLabel: 'Apply' },
    );
    if (!ok) return;
    this.service.applyMaster(this.applyTo(), master.invoiceTemplateMasterId).subscribe({
      next: () => {
        this.toast.success('Design applied successfully.');
        this.galleryOpen.set(false);
        const current = this.active();
        if (current === this.applyTo()) {
          this.active.set(current === 'INVOICE' ? 'CANCELATION' : 'INVOICE');
          setTimeout(() => this.active.set(current), 50);
        }
      },
    });
  }
}
