import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { InvoiceField, TemplateDoc, TemplateDocType, TemplateMaster } from './invoice-template.models';
import { TemplateProvider } from './template-provider';

@Injectable({ providedIn: 'root' })
export class InvoiceTemplateService implements TemplateProvider {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  // --- Field configuration ---
  getFields(): Observable<InvoiceField[]> {
    return this.api.post<InvoiceField[]>('ProductManagement/GetFieldConfiguration', {
      CompanyId: this.auth.companyId(),
    });
  }

  toggleField(configurationId: number, isActive: boolean): Observable<unknown> {
    return this.api.post('ProductManagement/AddEditInvoiceConfigFields', {
      ConfigurationId: configurationId,
      CompanyId: this.auth.companyId(),
      IsActive: isActive,
    });
  }

  // --- Master template designs ---
  getMasters(): Observable<TemplateMaster[]> {
    return this.api.post<TemplateMaster[]>('ProductManagement/GetTemplateMaster', {});
  }

  applyMaster(docType: TemplateDocType, masterId: number): Observable<unknown> {
    return this.api.post('ProductManagement/SaveInvoiceTemplateFromMaster', {
      CompanyId: this.auth.companyId(),
      InvoiceType: docType,
      InvoiceTemplateMasterId: masterId,
    });
  }

  // --- Per-doc-type template (Invoice / Cancellation / Refund) ---
  getTemplate(docType: TemplateDocType): Observable<TemplateDoc> {
    const endpoint =
      docType === 'CANCELATION'
        ? 'ProductManagement/GetCancelationTemplate'
        : 'ProductManagement/GetInvoiceTemplate';
    return this.api
      .post<TemplateDoc>(endpoint, {
        CompanyId: this.auth.companyId(),
        InvoiceType: docType,
      })
      .pipe(
        catchError((err) => {
          console.warn(`[InvoiceTemplateService] Failed to fetch template for type '${docType}'. Falling back to default layout.`, err);
          return of({
            templateId: 0,
            template: this.getDefaultFallbackTemplate(docType),
            isActive: true,
            invoiceType: docType,
          } as TemplateDoc);
        })
      );
  }

  saveTemplate(docType: TemplateDocType, templateId: number, html: string): Observable<unknown> {
    const endpoint =
      docType === 'CANCELATION'
        ? 'ProductManagement/SaveCancelationTemplate'
        : 'ProductManagement/SaveInvoiceTemplate';
    return this.api.post(endpoint, {
      TemplateId: templateId,
      CompanyId: this.auth.companyId(),
      InvoiceType: docType,
      Template: html,
    });
  }

  private getDefaultFallbackTemplate(docType: TemplateDocType): string {
    const title = docType === 'CANCELATION' ? 'Cancellation Slip' : docType === 'REFUND' ? 'Refund Receipt' : 'Tax Invoice';
    return `
<div style="font-family: Inter, system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; background: #ffffff;">
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 25px; margin-bottom: 30px;">
    <div>
      <h1 style="font-size: 26px; font-weight: 800; color: #4f46e5; margin: 0; tracking: -0.02em;">${title}</h1>
      <p style="font-size: 13px; color: #64748b; margin: 6px 0 0 0; font-weight: 500;">{{CompanyName}}</p>
      <p style="font-size: 12px; color: #94a3b8; margin: 2px 0 0 0;">{{CompanyAddress}}</p>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Document No</div>
      <div style="font-size: 16px; font-weight: 800; color: #1e293b; margin-top: 2px;">#{{InvoiceNumber}}</div>
      <p style="font-size: 12px; color: #64748b; margin: 6px 0 0 0;">Date: <strong>{{InvoiceDate}}</strong></p>
    </div>
  </div>

  <!-- Client Details -->
  <div style="margin-bottom: 35px; background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #f1f5f9;">
    <h3 style="font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px 0;">Customer Information</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr>
        <td style="padding: 3px 0; color: #64748b; width: 120px;">Customer Name:</td>
        <td style="padding: 3px 0; color: #1e293b; font-weight: 600;">{{CustomerName}}</td>
      </tr>
      <tr>
        <td style="padding: 3px 0; color: #64748b;">Email Address:</td>
        <td style="padding: 3px 0; color: #1e293b;">{{CustomerEmail}}</td>
      </tr>
      <tr>
        <td style="padding: 3px 0; color: #64748b;">Phone Number:</td>
        <td style="padding: 3px 0; color: #1e293b;">{{CustomerPhone}}</td>
      </tr>
      <tr>
        <td style="padding: 3px 0; color: #64748b; vertical-align: top;">Billing Address:</td>
        <td style="padding: 3px 0; color: #1e293b; line-height: 1.4;">{{BillingAddress}}</td>
      </tr>
    </table>
  </div>

  <!-- Table Placeholder -->
  <div style="margin-bottom: 35px;">
    {{ItemsTable}}
  </div>

  <!-- Summary totals -->
  <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: flex-end;">
    <table style="width: 280px; font-size: 13px; border-collapse: collapse;">
      <tr>
        <td style="padding: 6px 0; color: #64748b;">Subtotal</td>
        <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1e293b;">{{Subtotal}}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b;">Tax Amount</td>
        <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1e293b;">{{TaxAmount}}</td>
      </tr>
      <tr style="border-top: 2px solid #4f46e5;">
        <td style="padding: 12px 0 0 0; font-size: 16px; font-weight: 800; color: #4f46e5;">Total Amount</td>
        <td style="padding: 12px 0 0 0; text-align: right; font-size: 18px; font-weight: 900; color: #4f46e5;">{{TotalAmount}}</td>
      </tr>
    </table>
  </div>

  <!-- Footer Notice -->
  <div style="margin-top: 60px; border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
    Thank you for your business. For any inquiries, please contact support.
  </div>
</div>
    `.trim();
  }
}
