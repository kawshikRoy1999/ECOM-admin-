/** A configurable order field (Field Configuration). */
export interface OrderField {
  configurationId: number;
  companyId: number;
  fields: string;
  legend: string;
  description: string;
  isActive: boolean;
}

/** A ready-made master order template design. */
export interface OrderTemplateMaster {
  orderTemplateMasterId: number;
  imageUrl: string;
  html: string;
  isActive: boolean;
}
