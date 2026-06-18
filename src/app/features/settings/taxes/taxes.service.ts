import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { TaxDetail, TaxName } from './tax.models';

/** Tax configuration (CompanyManagement). Responses are camelCase. */
@Injectable({ providedIn: 'root' })
export class TaxesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  getNames(): Observable<TaxName> {
    return this.api.post<TaxName>('CompanyManagement/GetTaxName', {
      CompanyId: this.auth.companyId(),
    });
  }

  updateNames(names: Omit<TaxName, 'taxNameId' | 'companyId'>): Observable<unknown> {
    return this.api.post('CompanyManagement/UpdateTaxName', {
      ...names,
      CompanyId: this.auth.companyId(),
    });
  }

  getDetails(): Observable<TaxDetail[]> {
    return this.api.post<TaxDetail[]>('CompanyManagement/GetTaxDetails', {
      CompanyId: this.auth.companyId(),
    });
  }

  saveDetail(detail: Omit<TaxDetail, 'companyId'>): Observable<unknown> {
    return this.api.post('CompanyManagement/SaveTaxDetails', {
      ...detail,
      CompanyId: this.auth.companyId(),
    });
  }

  getInclusive(): Observable<boolean> {
    return this.api.post<boolean>('CompanyManagement/IsProductInclusiveOfTax', {
      CompanyId: this.auth.companyId(),
    });
  }

  setInclusive(inclusive: boolean): Observable<unknown> {
    return this.api.post('CompanyManagement/EditProductInclusiveOfTax', {
      CompanyId: this.auth.companyId(),
      IsAllProductInclusiveOfTax: inclusive,
    });
  }
}
