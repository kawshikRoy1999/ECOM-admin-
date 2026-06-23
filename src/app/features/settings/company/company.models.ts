/** A business unit (GetBusinessUnit / AddEditBusinessUnit). */
export interface BusinessUnit {
  businessUnitId: number;
  unitName: string;
  unitCode: string;
  isActive: boolean;
  fontColor: string;
  backgroundColor: string;
}

/** A business-type lookup option (LookUps in the .NET model). */
export interface LookUpInfo {
  lookUpValue: string;
  lookUpText: string;
}

/** Company info (GetCompany / EditCompany). Mapped tolerantly in the service. */
export interface CompanyInfo {
  companyId: number;
  name: string;
  shortName: string;
  businessType: string;
  address1: string;
  address2: string;
  pin: string;
  districtCode: string;
  stateCode: string;
  countryCode: string;
  adminPhone: string;
  servicePhone: string;
  adminEmail: string;
  serviceEmail: string;
  secondaryEmail: string;
  gstNumber: string;
  panNumber: string;
  website: string;
  imageFilePath: string;
  logoFileName: string;
  favIconFileName: string;
  footerFileName: string;
  // currency (read-only display)
  currencyCode: string;
  currencySymbol: string;
  // flags
  pinRequired: boolean;
  isActive: boolean;
  otpRequired: boolean;
  otpCOD: boolean;
  otpOnlinePayment: boolean;
  // phone metadata (echoed back on save)
  adminPhoneCode: string;
  servicePhoneCode: string;
  adminPhoneCountryCode: string;
  servicePhoneCountryCode: string;
  // lookups for the (read-only) business-type select
  lookUps: LookUpInfo[];
  selectedLookUpValue: string;
}
