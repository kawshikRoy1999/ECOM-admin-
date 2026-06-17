/** Document types that share the invoice-template editor. */
export type TemplateDocType = 'INVOICE' | 'CANCELATION' | 'REFUND';

/** A configurable invoice field (Field Configuration tab). */
export interface InvoiceField {
  configurationId: number;
  companyId: number;
  fields: string;
  legend: string;
  description: string;
  isActive: boolean;
}

/** A ready-made master template design (Template Design tab). */
export interface TemplateMaster {
  invoiceTemplateMasterId: number;
  imageUrl: string;
  html: string;
  isActive: boolean;
}

/** The saved template document for a given doc type. */
export interface TemplateDoc {
  templateId: number;
  template: string;
  isActive: boolean;
  invoiceType: string;
}
