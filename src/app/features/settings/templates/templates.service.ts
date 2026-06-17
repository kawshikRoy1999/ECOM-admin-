import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CompanyTemplate, CustomGroup, FrontendTemplate } from './template.models';

@Injectable({ providedIn: 'root' })
export class TemplatesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  // --- Template List (CompanyManagement) ---
  listCompanyTemplates(): Observable<CompanyTemplate[]> {
    return this.api.post<CompanyTemplate[]>('CompanyManagement/GetCompanyTemplateList', {
      CompanyId: this.auth.companyId(),
    });
  }

  /** Available frontend template masters the company can add. */
  listFrontendTemplates(): Observable<FrontendTemplate[]> {
    return this.api.get<FrontendTemplate[]>('CompanyManagement/GetFrontendTemplate');
  }

  addTemplate(templateId: number, isForB2C = true): Observable<unknown> {
    return this.api.post('CompanyManagement/AddCompanyTemplate', {
      TemplateId: templateId,
      CompanyId: this.auth.companyId(),
      IsForB2C: isForB2C,
    });
  }

  setDefault(template: CompanyTemplate): Observable<unknown> {
    return this.api.post('CompanyManagement/ChangeCompanyTemplateDefault', {
      TemplateId: template.templateId,
      CompanyTemplateId: template.companyTemplateId,
      CompanyId: this.auth.companyId(),
      IsForB2C: template.isForB2C,
    });
  }

  // --- Custom Groups (ProductManagement) ---
  listCustomGroups(): Observable<CustomGroup[]> {
    return this.api.post<CustomGroup[]>('ProductManagement/GetCustomGroupforMaster', {
      CompanyId: this.auth.companyId(),
    });
  }

  saveCustomGroup(
    group: Pick<CustomGroup, 'customGroupId' | 'customGroupName' | 'customGroupImageLink' | 'isActive'>,
  ): Observable<unknown> {
    return this.api.post('ProductManagement/SaveUpdateCustomGroup', {
      CustomGroupId: group.customGroupId,
      CustomGroupName: group.customGroupName,
      CustomGroupImageLink: group.customGroupImageLink,
      CompanyId: this.auth.companyId(),
      IsActive: group.isActive,
    });
  }
}
