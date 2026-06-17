import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionAction, PermissionDtlResponse } from './permission.models';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  getForRole(roleId: string): Observable<PermissionDtlResponse> {
    return this.api.post<PermissionDtlResponse>('UserManagement/GetPermissionDtl', {
      CompanyId: this.auth.companyId(),
      RoleId: roleId,
    });
  }

  save(roleId: string, actions: PermissionAction[]): Observable<unknown> {
    return this.api.post('UserManagement/SavePermission', {
      CompanyId: this.auth.companyId(),
      RoleId: roleId,
      MenuActionList: actions.map((a) => ({ IsChecked: a.isActive, MenuActionId: a.menuActionId })),
    });
  }
}
