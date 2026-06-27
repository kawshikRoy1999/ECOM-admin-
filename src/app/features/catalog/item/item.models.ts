/** A row in the item list (GetItemList → orderlist / ItemListReturn). */
export interface ItemListRow {
  id: number;
  name: string;
  variantName: string;
  brand: string;
  brandId: number;
  price: number;
  rol: number;
  quantity: number;
  imageUrl: string;
  itemCode: string;
  isActive: boolean;
}

/** id/name option for dropdowns. */
export interface NamedOption {
  id: number;
  name: string;
}

/** Tax slab option (GetAllTax → allTaxes). */
export interface TaxOption {
  taxDetailsId: number;
  taxName: string;
  total: number;
}

/** Sub-category option (GetSubCategoryByCategoryId). */
export interface SubCategoryOption {
  id: number;
  name: string;
  parentSubCategoryId: number | null;
}

/** A pricing row (InventoryPricing / AddEditItemPricing). */
export interface ItemPricing {
  itemPricingId: number;
  mrp: number;
  discount: number;
  price: number;
  cost: number;
  startDate: string;
  endDate: string;
}

/** An item image (GetItemWiseImageList). */
export interface ItemImage {
  imageId: number;
  imageFullPath: string;
}

/** Full item detail for the editor (GetEditItemNew → InventoryItemView). */
export interface ItemDetail {
  itemId: number;
  brandId: number;
  categoryId: number;
  subCategoryId: number;
  itemName: string;
  itemCode: string;
  itemDescription: string;
  liveFromDate: string;
  liveToDate: string;
  itemSortOrderInCategory: number;
  isActive: boolean;
  isFeatureItem: boolean;
  isSoldOut: boolean;
  isSerialized: boolean;
  taxId: number;
  hsn: string;
  showAvailableQtyIfBelow: number | null;
  returnWindowInDays: number | null;
  isReturnWindowDays: boolean | null;
  pricing: ItemPricing[];
  media: ItemImage[];
}

/** Lists needed to populate the item form (GetALLItemDdlList). */
export interface ItemDdlLists {
  brands: NamedOption[];
  categories: NamedOption[];
  itemCodeFormatName: string;
  itemCount: number;
}
