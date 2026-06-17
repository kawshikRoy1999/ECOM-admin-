import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AdminUser, EMPTY_GUID, SaveUserRequest, UserListResponse } from './user.models';

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
      'userId' | 'email' | 'userName' | 'firstName' | 'middleName' | 'lastName' | 'phone'
    > & { isActive: boolean; password: string },
  ): Observable<unknown> {
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
      IsActive: user.isActive,
      CreatedBy: this.auth.userId(),
      ModifiedBy: this.auth.userId(),
    };
    return this.api.post('UserManagement/AddEditUser', body);
  }

  delete(userId: string): Observable<unknown> {
    return this.api.post('UserManagement/DeleteUser', {
      UserId: userId,
      CompanyId: this.auth.companyId(),
      ModifiedBy: this.auth.userId(),
    });
  }
}
