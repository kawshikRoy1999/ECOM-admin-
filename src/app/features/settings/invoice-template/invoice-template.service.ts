import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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
    return this.api.post<TemplateDoc>(endpoint, {
      CompanyId: this.auth.companyId(),
      InvoiceType: docType,
    });
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
}
