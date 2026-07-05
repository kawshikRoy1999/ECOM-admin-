/**
 * Auth contract for the EcomShop gateway.
 *   POST UserManagement/authenticate
 *   body:     { UserName, Password, CompanyId? }
 *   response: Response<UserToken>  (envelope unwrapped to SessionUser)
 */

export interface LoginRequest {
  UserName: string;
  Password: string;
  CompanyId?: number;
}

/** CompanyManagement/GetCompany response subset used to enrich the session. */
export interface CompanyDtl {
  imageFilePath: string;
  logoFileName: string;
  businessType: string;
}

/** A menu the user's role is permitted to see (UserManagement/MenuActions). */
export interface PermittedMenu {
  menuId: string;
  parentMenuId: string;
  menuName: string;
  url: string;
  isDefault: boolean;
}

/** A per-menu action the user's role can perform (View/Add/Edit/Delete). */
export interface PermittedAction {
  menuId: string;
  menuActionId: string;
  actionName: string;
}

/** UserManagement/MenuActions response. */
export interface MenuActionsResponse {
  permittedMenus: PermittedMenu[];
  permittedActions: PermittedAction[];
}

/** One entry of the full company menu master (UserManagement/GetMenuList). */
export interface MenuMasterItem {
  menuName: string;
  url: string;
}

/** Subset of the .NET UserToken (serialized camelCase) we keep as the session. */
export interface SessionUser {
  id: string;
  userName: string;
  companyId: number;
  firstName: string;
  lastName: string;
  middleName?: string;
  token: string;
  imageFilePath?: string;
  logo?: string;
  businessType?: string;
  isActive?: boolean;
  currencyMasterId?: number;
  currencyCode?: string;
  currencySymbol?: string;
  countryCode?: string;
  isSuperAdmin?: boolean;
  /** Role-based menu/action permissions (from UserManagement/MenuActions). */
  permittedMenus?: PermittedMenu[];
  permittedActions?: PermittedAction[];
  /** Full company menu master — used to tell "denied" from "not in DB" (fail-open). */
  menuMaster?: MenuMasterItem[];
}
