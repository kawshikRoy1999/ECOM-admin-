import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { EMPTY_GUID, Role, RoleListResponse, SaveRoleRequest } from './role.models';

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  list(): Observable<RoleListResponse> {
    return this.api.post<RoleListResponse>('UserManagement/GetRoleList', {
      CompanyId: this.auth.companyId(),
    });
  }

  save(role: Pick<Role, 'roleId' | 'roleName' | 'description' | 'isActive'>): Observable<unknown> {
    const body: SaveRoleRequest = {
      RoleId: role.roleId || EMPTY_GUID,
      CompanyId: this.auth.companyId(),
      RoleName: role.roleName,
      Description: role.description,
      IsActive: role.isActive,
      UpdatedByUserId: this.auth.userId(),
    };
    return this.api.post('UserManagement/AddEditRole', body);
  }

  delete(roleId: string): Observable<unknown> {
    return this.api.post('UserManagement/DeleteRole', {
      RoleId: roleId,
      CompanyId: this.auth.companyId(),
      UpdatedByUserId: this.auth.userId(),
    });
  }
}
