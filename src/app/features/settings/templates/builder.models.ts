/** Full storefront template detail (GetCompanyTemplate). */
export interface TemplateDetail {
  companyTemplateId: number;
  companyId: number;
  templateId: number;
  templateName: string;
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  isActive: boolean;
  isForB2C: boolean;
  isEditable: boolean | null;
  onlyForMobile: boolean | null;
  imagePath: string;
  fontFamilyId: number | null;
  responseCompanyTemplateSections: TemplateSection[];
  responseTemplateFontFamilyMaster?: FontFamily[];
}

export interface FontFamily {
  fontFamilyId: number;
  fontName: string;
}

/** SectionFor discriminator → which content a section holds. */
export const SECTION_FOR_ITEMS = 1;
export const SECTION_FOR_VARIANTS = 2;
export const SECTION_FOR_CUSTOM_GROUPS = 4;

export interface TemplateSection {
  companyTemplateSectionId: number;
  companyTemplateId: number;
  sectionType: number;
  sectionName: string;
  sectionBackgrounColor: string; // note: .NET typo preserved on the wire
  isActive: boolean | null;
  primaryText: string;
  secondaryText: string;
  tertiaryText: string;
  displayOrder: number;
  sectionFor: number;
  sectionTypeName: string;
  sectionTypeSuggestion: string;
  responseSectionItemAndImage?: SectionItemAndImage;
}

export interface SectionItemAndImage {
  sectionItems?: SectionItem[];
  sectionImages?: SectionImage[];
  sectionFor: number;
}

export interface SectionItem {
  companyTemplateSectionItemMappingId: number;
  itemId: number;
  variantId: number;
  name: string;
  imagePath: string;
  price: number;
  mrp: number;
  salePrice: number;
  displayOrder: number;
  isActive: boolean | null;
}

export interface SectionImage {
  companyTemplateSectionImageMappingId: number;
  imagePath: string;
  displayOrder: number;
  isActive: boolean;
}

/** A product/variant search result for adding to a section. */
export interface SectionProductResult {
  itemId: number;
  variantId: number;
  name: string;
  imageUrl: string;
}

/** One image belonging to an item (for per-item image selection). */
export interface ItemImage {
  imageId: number;
  path: string;
  isPrimary: boolean;
}

/** Master lists for the create-section form. */
export interface SectionMetadata {
  sectionForList: { templateSectionForId: number; templateSectionForName: string }[];
  templateSectionTypemaster: {
    templateSectionType: number;
    templateSectionName: string;
    helpLink: string;
  }[];
}
