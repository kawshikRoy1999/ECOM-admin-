import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardPeriod, DashboardSummary } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http   = inject(HttpClient);
  private readonly auth   = inject(AuthService);
  private readonly base   = environment.apiUrl.replace(/\/$/, '');

  /**
   * GET /api/Productmanagement/GetDashboardSummary
   * Response is the DashboardSummary object directly (not wrapped in ApiResponse.data).
   */
  getSummary(period: DashboardPeriod, fromDate = '', toDate = ''): Observable<DashboardSummary> {
    let params = new HttpParams()
      .set('companyId', String(this.auth.companyId()))
      .set('period',    period);

    if (period === 'custom') {
      params = params.set('FromDate', fromDate).set('ToDate', toDate);
    }

    return this.http.get<DashboardSummary>(
      `${this.base}/Productmanagement/GetDashboardSummary`,
      { params },
    );
  }
}
