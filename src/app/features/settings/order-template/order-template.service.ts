import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { TemplateDoc, TemplateProvider } from '../invoice-template/template-provider';
import { OrderField, OrderTemplateMaster } from './order-template.models';

/**
 * Order template data source. Implements TemplateProvider so the shared
 * TemplateEditor drives it the same way as the invoice template.
 * All endpoints live under ProductManagement; the only order doc type is "ORDER".
 */
@Injectable({ providedIn: 'root' })
export class OrderTemplateService implements TemplateProvider {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  getFields(): Observable<OrderField[]> {
    return this.api.post<OrderField[]>('ProductManagement/GetOrderFieldConfiguration', {
      CompanyId: this.auth.companyId(),
    });
  }

  toggleField(configurationId: number, isActive: boolean): Observable<unknown> {
    return this.api.post('ProductManagement/AddEditOrderConfigFields', {
      ConfigurationId: configurationId,
      CompanyId: this.auth.companyId(),
      IsActive: isActive,
    });
  }

  getMasters(): Observable<OrderTemplateMaster[]> {
    return this.api.post<OrderTemplateMaster[]>('ProductManagement/GetOrderTemplateMaster', {});
  }

  applyMaster(masterId: number): Observable<unknown> {
    return this.api.post('ProductManagement/SaveOrderTemplateFromMaster', {
      CompanyId: this.auth.companyId(),
      OrderType: 'ORDER',
      OrderTemplateMasterId: masterId,
    });
  }

  // --- TemplateProvider (consumed by TemplateEditor) ---
  getTemplate(type: string): Observable<TemplateDoc> {
    return this.api.post<TemplateDoc>('ProductManagement/GetOrderTemplate', {
      CompanyId: this.auth.companyId(),
      OrderType: type,
    });
  }

  saveTemplate(type: string, templateId: number, html: string): Observable<unknown> {
    return this.api.post('ProductManagement/SaveOrderTemplate', {
      TemplateId: templateId,
      CompanyId: this.auth.companyId(),
      OrderType: type,
      Template: html,
    });
  }
}
