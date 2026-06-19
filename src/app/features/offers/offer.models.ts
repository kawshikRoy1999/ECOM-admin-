/** A row in the offer list. */
export interface OfferListItem {
  offerId: number;
  offerName: string;
  bannerImageUrl: string;
  discountPercentage: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isExpired: boolean;
  isGroupOffer: boolean;
  itemCode?: string;
}

/** A targeting criterion (Category / Brand / Variant). */
export interface OfferCriteria {
  type: string; // 'Category' | 'Brand' | 'Variant'
  id: number;
  name: string;
}

/** Offer master returned by AdminGetOfferDetails. */
export interface OfferDetailsMaster {
  offerId: number;
  companyId: number;
  offerName: string;
  discountPercentage: number;
  startDate: string;
  endDate: string;
  bannerImageUrl: string;
  isActive: boolean;
  isGroupOffer: boolean;
}

export interface OfferDetailsCriteria {
  criteriaId: number;
  criteriaType: string;
  criteriaValueId: number;
  criteriaValueName: string;
}

export interface OfferDetails {
  offer: OfferDetailsMaster;
  criteria: OfferDetailsCriteria[];
}

/** Generic id/name option for criteria pickers. */
export interface CriteriaOption {
  id: number;
  name: string;
}

export type RuleType = 'Brand' | 'Category' | 'SubCategory' | 'Variant';

/** A staged targeting rule shown in the "Active Rules" panel. */
export interface ActiveRule {
  type: RuleType;
  id: number;
  name: string;
  imageUrl?: string;
}

/** Flat subcategory/family node from GetSubCategoryByCategoryId. */
export interface SubCategoryNode {
  id: number;
  name: string;
  parentId: number; // 0 => top-level subcategory; else a family under that subcategory
}

/** A product variant search result. */
export interface VariantResult {
  id: number;
  text: string;
  imageUrl: string;
}
