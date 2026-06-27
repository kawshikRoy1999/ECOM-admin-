/** A top-level category (GetCategoryAll / GetCatDetail). */
export interface Category {
  categoryId: number;
  companyId: number;
  name: string;
  imageName: string;
  iconImage: string;
  isActive: boolean;
  returnWindowInDays: number;
  nonReturnable: boolean;
  businessUnitId: number | null;
}

/** A sub-category or sub-sub-category (GetAllSubCategory / GetAllSubSubCategory). */
export interface SubCategory {
  subCategoryId: number;
  categoryId: number;
  parentSubCategoryId: number;
  subCategoryName: string;
  sortOrder: number;
  isActive: boolean;
  returnWindowInDays: number;
  nonReturnable: boolean;
}

/** Business unit option for the category form dropdown. */
export interface BusinessUnitOption {
  businessUnitId: number;
  unitName: string;
}

/** A category/sub-category option/attribute (GetCategoryOption / GetSubCategoryOption). */
export interface CategoryOption {
  variantOptionId: number;
  categoryId: number;
  subCategoryId: number;
  optionName: string;
  displayOrder: number;
  isItemLevelAttribute: boolean;
}

/** A value belonging to an option (GetOptionValues → {optionValueId, optionName=value text}). */
export interface OptionValue {
  optionValueId: number;
  value: string;
  displayOrder: number;
}
