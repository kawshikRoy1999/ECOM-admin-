import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';

/** ServiceName discriminators used by the gateway. */
export type NotificationServiceName = 'EmailTemplate' | 'SMSTemplate' | 'TwillioService';

/** Response keys are normalized to lowercase to survive acronym camelCasing. */
export type NotificationConfig = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  get(serviceName: NotificationServiceName): Observable<NotificationConfig> {
    return this.api
      .post<Record<string, unknown>>('CompanyManagement/GetNotificationServiceService', {
        CompanyId: this.auth.companyId(),
        ServiceName: serviceName,
      })
      .pipe(map((data) => this.normalize(data)));
  }

  /** Save a service config. `fields` are PascalCase (bound case-insensitively). */
  save(serviceName: NotificationServiceName, id: number, fields: Record<string, unknown>): Observable<unknown> {
    return this.api.post('CompanyManagement/SaveNotificationService', {
      Id: id || 0,
      CompanyId: this.auth.companyId(),
      ServiceName: serviceName,
      ...fields,
    });
  }

  /** Lowercase every key so the page can read regardless of acronym casing. */
  private normalize(data: Record<string, unknown> | null): NotificationConfig {
    const out: NotificationConfig = {};
    if (data) {
      for (const [k, v] of Object.entries(data)) out[k.toLowerCase()] = v;
    }
    return out;
  }
}
