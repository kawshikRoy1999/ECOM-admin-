import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CancellationReason, CompanyStatus } from './status.models';

/** Order status names + cancellation reasons (ProductManagement). */
@Injectable({ providedIn: 'root' })
export class StatusesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  // --- Status names ---
  getStatuses(): Observable<CompanyStatus[]> {
    return this.api.post<CompanyStatus[]>('ProductManagement/GetStatusMaster', {
      CompanyId: this.auth.companyId(),
    });
  }

  saveStatus(s: CompanyStatus): Observable<unknown> {
    return this.api.post('ProductManagement/SaveCompanyStatusDetails', {
      UserId: this.auth.userId(),
      CompanyId: this.auth.companyId(),
      StatusId: s.statusId,
      StatusName: s.statusName,
      StoreFrontStatus: s.storeFrontStatus,
    });
  }

  // --- Cancellation reasons ---
  getCancellations(): Observable<CancellationReason[]> {
    return this.api.post<CancellationReason[]>('ProductManagement/GetCancellationMaster', {
      CompanyId: this.auth.companyId(),
    });
  }

  saveCancellation(c: CancellationReason): Observable<unknown> {
    return this.api.post('ProductManagement/SaveCancellationDetails', {
      UserId: this.auth.userId(),
      CompanyId: this.auth.companyId(),
      CancellationReasonId: c.cancellationReasonId,
      ReasonName: c.reasonName,
      ExplanationRequired: c.explanationRequired,
      IsActive: c.isActive,
    });
  }

  deleteCancellation(cancellationReasonId: number): Observable<unknown> {
    return this.api.post('ProductManagement/DeleteCancellationDetails', {
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      CancellationReasonId: cancellationReasonId,
    });
  }
}
