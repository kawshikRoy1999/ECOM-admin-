import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  AdminUser,
  EMPTY_GUID,
  SaveUserRequest,
  SaveUserResponse,
  UserDetailResponse,
  UserListResponse,
} from './user.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  list(): Observable<UserListResponse> {
    return this.api.post<UserListResponse>('UserManagement/GetUserList', {
      CompanyId: this.auth.companyId(),
    });
  }

  save(
    user: Pick<
      AdminUser,
      | 'userId'
      | 'email'
      | 'userName'
      | 'firstName'
      | 'middleName'
      | 'lastName'
      | 'phone'
      | 'address'
      | 'address2'
      | 'city'
      | 'state'
      | 'country'
      | 'postalCode'
      | 'imagePath'
    > & { isActive: boolean; password: string },
  ): Observable<SaveUserResponse> {
    const body: SaveUserRequest = {
      UserId: user.userId || EMPTY_GUID,
      CompanyId: this.auth.companyId(),
      Email: user.email,
      UserName: user.userName,
      Password: user.password,
      FirstName: user.firstName,
      MiddleName: user.middleName ?? '',
      LastName: user.lastName,
      Phone: user.phone ?? '',
      Address1: user.address ?? '',
      Address2: user.address2 ?? '',
      City: user.city ?? '',
      State: user.state ?? '',
      Country: user.country ?? '',
      Zip: user.postalCode ?? '',
      ImagePath: user.imagePath ?? '',
      IsActive: user.isActive,
      CreatedBy: this.auth.userId(),
      ModifiedBy: this.auth.userId(),
    };
    return this.api.post<SaveUserResponse>('UserManagement/AddEditUser', body);
  }

  /** Load a user's detail incl. currently-assigned roles (for editing). */
  detail(userId: string): Observable<UserDetailResponse> {
    return this.api.post<UserDetailResponse>('UserManagement/GetUserDtlByUserId', {
      CompanyId: this.auth.companyId(),
      UserId: userId,
    });
  }

  /** Assign the given roles to a user (replaces their role set). */
  assignRoles(userId: string, roleIds: string[]): Observable<unknown> {
    return this.api.post('UserManagement/AddEditAssignRole', {
      UserId: userId,
      RoleIdList: roleIds,
      CompanyId: this.auth.companyId(),
      CreatedBy: this.auth.userId(),
      ModifiedBy: this.auth.userId(),
    });
  }

  delete(userId: string): Observable<unknown> {
    return this.api.post('UserManagement/DeleteUser', {
      UserId: userId,
      CompanyId: this.auth.companyId(),
      ModifiedBy: this.auth.userId(),
    });
  }
}
