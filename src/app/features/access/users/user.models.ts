import { EMPTY_GUID } from '../roles/role.models';

export { EMPTY_GUID };

export interface AdminUser {
  userId: string;
  companyId: number;
  userName: string;
  email: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  phone?: string | null;
  imagePath?: string | null;
  isActive?: boolean | null;
}

export interface UserRoleOption {
  roleId: string;
  roleName: string;
}

export interface UserListResponse {
  userList: AdminUser[];
  roleList: UserRoleOption[];
}

/** AddEditUser response — returns the (new) user's id. */
export interface SaveUserResponse {
  userId: string | null;
  type?: string;
  msg?: string;
}

/** GetUserDtlByUserId response — includes the roles currently assigned. */
export interface UserDetailResponse {
  userDtl: AdminUser;
  userRoleDtl: { roleId: string; roleName: string; description?: string }[];
}

export interface SaveUserRequest {
  UserId: string;
  CompanyId: number;
  Email: string;
  UserName: string;
  Password: string;
  FirstName: string;
  MiddleName: string;
  LastName: string;
  Phone: string;
  IsActive: boolean;
  CreatedBy: string;
  ModifiedBy: string;
}
