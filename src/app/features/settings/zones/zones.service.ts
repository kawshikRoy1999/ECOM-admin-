import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Zone, ZoneRow, ZipPattern, groupZones } from './zone.models';

/** Delivery zones (CompanyManagement). Flat rows are grouped into zones. */
@Injectable({ providedIn: 'root' })
export class ZonesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  list(): Observable<Zone[]> {
    return this.api
      .post<ZoneRow[]>('CompanyManagement/GetZoneDetails', { CompanyId: this.auth.companyId() })
      .pipe(map((rows) => groupZones(rows ?? [])));
  }

  saveZone(zone: { zoneId: number; zoneName: string; country: string; patterns: ZipPattern[] }): Observable<unknown> {
    return this.api.post('CompanyManagement/SaveZoneDetails', {
      ZoneId: zone.zoneId,
      ZoneName: zone.zoneName,
      Country: zone.country,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      ZipDetails: zone.patterns.map((p) => ({
        ZonePatternId: p.zonePatternId,
        ZipPattern: p.zipPattern,
      })),
    });
  }

  deletePattern(zoneId: number, zonePatternId: number): Observable<unknown> {
    return this.api.post('CompanyManagement/DeleteZonePattern', {
      ZoneId: zoneId,
      ZonePatternId: zonePatternId,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
    });
  }

  deleteZone(zoneId: number): Observable<unknown> {
    return this.api.post('CompanyManagement/DeleteZoneById', {
      ZoneId: zoneId,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
    });
  }
}
