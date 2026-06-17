export interface Role {
  roleId: string; // Guid; empty guid for new
  companyId: number;
  roleName: string;
  description: string | null;
  isActive: boolean;
}

export interface RoleListResponse {
  roleList: Role[];
}

export interface SaveRoleRequest {
  RoleId: string;
  CompanyId: number;
  RoleName: string;
  Description: string | null;
  IsActive: boolean;
  UpdatedByUserId: string;
}

export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';
