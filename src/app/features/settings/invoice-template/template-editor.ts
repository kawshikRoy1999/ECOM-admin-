import { Component, computed, effect, inject, input, signal, ElementRef, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Modal } from '../../../shared/ui/modal/modal';

import { ToastService } from '../../../shared/ui/toast/toast.service';
import { TEMPLATE_PROVIDER, TemplatePlaceholder } from './template-provider';

const DEFAULT_PLACEHOLDERS: TemplatePlaceholder[] = [
  { name: 'Invoice Number', tag: 'InvoiceNumber' },
  { name: 'Invoice Date', tag: 'InvoiceDate' },
  { name: 'Due Date', tag: 'DueDate' },
  { name: 'Customer Name', tag: 'CustomerName' },
  { name: 'Customer Email', tag: 'CustomerEmail' },
  { name: 'Customer Phone', tag: 'CustomerPhone' },
  { name: 'Billing Address', tag: 'BillingAddress' },
  { name: 'Shipping Address', tag: 'ShippingAddress' },
  { name: 'Subtotal', tag: 'Subtotal' },
  { name: 'Tax Amount', tag: 'TaxAmount' },
  { name: 'Total Amount', tag: 'TotalAmount' },
  { name: 'Company Name', tag: 'CompanyName' },
  { name: 'Company Address', tag: 'CompanyAddress' },
  { name: 'Items Table', tag: 'ItemsTable' },
];

/**
 * Reusable HTML template editor. Loads/saves the template for [docType] via the
 * injected TEMPLATE_PROVIDER, so it drives invoice, order or any future template.
 * Edits visually (WYSIWYG) or as HTML source.
 */
@Component({
  selector: 'app-template-editor',
  imports: [FormsModule, Modal],
  templateUrl: './template-editor.html',
})
export class TemplateEditor {
  private readonly service = inject(TEMPLATE_PROVIDER);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly docType = input.required<string>();
  readonly placeholders = input<TemplatePlaceholder[]>(DEFAULT_PLACEHOLDERS);

  readonly html = signal('');
  readonly templateId = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly previewOpen = signal(false);
  readonly editorMode = signal<'visual' | 'code'>('visual');

  private _editorEl?: ElementRef<HTMLDivElement>;

  @ViewChild('editorEl') set editorEl(el: ElementRef<HTMLDivElement> | undefined) {
    this._editorEl = el;
    if (el) {
      el.nativeElement.innerHTML = this.html();
    }
  }

  get editorEl(): ElementRef<HTMLDivElement> | undefined {
    return this._editorEl;
  }

  readonly preview = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.html() || '<p style="color:#94a3b8">Nothing to preview yet.</p>'),
  );

  private loadedFor = '';

  constructor() {
    // Load the saved template once for the bound doc type.
    effect(() => {
      const dt = this.docType();
      if (dt && this.loadedFor !== dt) {
        this.loadedFor = dt;
        this.loading.set(true);
        this.service.getTemplate(dt).subscribe({
          next: (doc) => {
            this.html.set(doc?.template ?? '');
            this.templateId.set(doc?.templateId ?? 0);
            this.loading.set(false);
            // Write content into WYSIWYG editor
            setTimeout(() => this.writeToEditor(), 0);
          },
          error: () => this.loading.set(false),
        });
      }
    });
  }

  writeToEditor(): void {
    if (this.editorEl) {
      this.editorEl.nativeElement.innerHTML = this.html();
    }
  }

  setMode(mode: 'visual' | 'code'): void {
    if (mode === 'visual' && this.editorMode() === 'code') {
      this.editorMode.set(mode);
      setTimeout(() => this.writeToEditor(), 0);
    } else {
      this.editorMode.set(mode);
    }
  }

  syncFromEditor(): void {
    if (this.editorEl) {
      this.html.set(this.editorEl.nativeElement.innerHTML);
    }
  }

  execCmd(command: string, value: string = ''): void {
    document.execCommand(command, false, value);
    this.syncFromEditor();
  }

  insertVar(tag: string): void {
    const sel = window.getSelection();
    if (!sel) return;

    let range: Range;

    // Check if selection exists, otherwise create range
    if (sel.rangeCount > 0) {
      range = sel.getRangeAt(0);
    } else {
      if (!this.editorEl) return;
      this.editorEl.nativeElement.focus();
      range = document.createRange();
      range.selectNodeContents(this.editorEl.nativeElement);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // Check if cursor is actually inside editor, if not, focus inside
    let parent = range.commonAncestorContainer as HTMLElement;
    let isInside = false;
    while (parent) {
      if (parent === this.editorEl?.nativeElement) {
        isInside = true;
        break;
      }
      parent = parent.parentNode as HTMLElement;
    }

    if (!isInside && this.editorEl) {
      this.editorEl.nativeElement.focus();
      const newSel = window.getSelection();
      if (newSel && newSel.rangeCount > 0) {
        range = newSel.getRangeAt(0);
      } else {
        return;
      }
    }

    const token = `{{${tag}}}`;
    const textNode = document.createTextNode(token);
    range.deleteContents();
    range.insertNode(textNode);

    // Set cursor position after the variable token
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    sel.removeAllRanges();
    sel.addRange(range);

    this.syncFromEditor();
  }

  save(): void {
    this.saving.set(true);
    this.service.saveTemplate(this.docType(), this.templateId(), this.html()).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Template saved.');
      },
      error: () => this.saving.set(false),
    });
  }
}
