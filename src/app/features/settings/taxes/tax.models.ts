/** The (up to 5) named tax components for the company, e.g. CGST / SGST. */
export interface TaxName {
  taxNameId: number;
  tax1Name: string;
  tax2Name: string;
  tax3Name: string;
  tax4Name: string;
  tax5Name: string;
  companyId: number;
}

/** A tax slab combining the named components into percentages. */
export interface TaxDetail {
  taxDetailsId: number;
  taxName: string;
  tax1Percentage: number;
  tax2Percentage: number;
  tax3Percentage: number;
  tax4Percentage: number;
  tax5Percentage: number;
  isDefault: boolean;
  companyId: number;
}

export const EMPTY_TAX_NAME: TaxName = {
  taxNameId: 0,
  tax1Name: '',
  tax2Name: '',
  tax3Name: '',
  tax4Name: '',
  tax5Name: '',
  companyId: 0,
};
