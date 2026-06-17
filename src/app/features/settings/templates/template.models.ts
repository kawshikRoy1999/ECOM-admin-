/** A frontend template the company has added (Template List). */
export interface CompanyTemplate {
  companyTemplateId: number;
  companyId: number;
  templateId: number;
  templateName: string;
  isDefault: boolean;
  url: string;
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  isActive: boolean | null;
  type: string;
  isForB2C: boolean;
  templateView?: string;
  imagePath?: string;
}

/** A ready-made frontend template master the company can add. */
export interface FrontendTemplate {
  templateId: number;
  templateName: string;
  templateView: string;
  viewName: string;
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  isActive: boolean;
  imagePath: string;
}

/** Custom group master. */
export interface CustomGroup {
  customGroupId: number;
  customGroupName: string;
  customGroupImageLink: string;
  companyId: number;
  isActive: boolean;
}
