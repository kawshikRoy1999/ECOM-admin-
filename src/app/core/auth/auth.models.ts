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
}
