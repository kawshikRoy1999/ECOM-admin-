export interface PermissionMenu {
  menuId: string;
  menuName: string;
  isActive: boolean;
}

export interface PermissionAction {
  menuActionId: string;
  actionName: string;
  isActive: boolean;
  menuId: string;
  menuName: string;
}

export interface PermissionDtlResponse {
  permissionMenuList: PermissionMenu[];
  permissionList: PermissionAction[];
}

export interface SavePermissionRequest {
  CompanyId: number;
  RoleId: string;
  MenuActionList: { IsChecked: boolean; MenuActionId: string }[];
}

/** Actions grouped under their menu, for rendering the matrix. */
export interface MenuGroup {
  menuId: string;
  menuName: string;
  actions: PermissionAction[];
}
