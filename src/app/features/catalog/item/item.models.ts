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
  variantOptions: ItemVariantOptionSel[];
  isPriceRange?: boolean;
  priceRanges?: ItemPriceRange[];
  customFields?: ItemCustomField[];
}

/** Lists needed to populate the item form (GetALLItemDdlList). */
export interface ItemDdlLists {
  brands: NamedOption[];
  categories: NamedOption[];
  itemCodeFormatName: string;
  itemCodeFormatId: number;
  itemCount: number;
  currency: string;
}

/** A tag (TagModel). */
export interface ItemTag {
  tagId: number;
  tag: string;
  itemId: number;
  displayOrder: number;
}

/** A meta/SEO tag (MetaTagModel). */
export interface ItemMeta {
  metaTagId: number;
  metaTag: string;
  itemId: number;
}

/** An FAQ entry (FAQModel). */
export interface ItemFaq {
  faqId: number;
  faq: string;
  faqAnswer: string;
  itemId: number;
}

/** An available variant option for a category (GetVariantOptionsWithValues). */
export interface AvailableVariantOption {
  variantOptionId: number;
  optionName: string;
  appliedOnVariant: boolean;
  optionValues: { optionValueId: number; optionValueName: string }[];
}

/** The item's selected variant option (InventoryOptionList / AddEditItemVariantOption). */
export interface ItemVariantOptionSel {
  variantOptionId: number;
  variantName: string;
  defaultDisplayOrder: number;
  isApplicable: boolean;
  isFilterable: boolean;
  /**
   * value ids selected for this option. `optionValueId` = category value id (OptionValueId),
   * `variantOptionValueId` = the item's existing value mapping id (0/null for new).
   */
  selectedValues: {
    optionValueId: number;
    variantOptionValueId: number;
    optionValue: string;
    displayOrder: number;
    colorCode: string;
  }[];
}

/** A generated/saved variant of an item (ItemVariant from GetVariant). */
export interface ItemVariantRow {
  itemVariantId: number;
  itemVariantName: string;
  sku: string;
  barcode: string;
  price: number;
  image: string;
}

/** A pricing row for a variant (InventoryItemVariantPricing / AddEditItemVariantPricing). */
export interface VariantPricing {
  itemPricingId: number;
  mrp: number;
  discount: number;
  price: number;
  cost: number;
  startDate: string;
  endDate: string;
  batchCode: string;
}

/** The add/edit variant editor payload (GetAddVariant load / SaveInventoryVariant). */
export interface VariantEdit {
  itemId: number;
  itemVariantId: number;
  itemVariantName: string;
  sku: string;
  barcode: string;
  skuBarcodeImage: string; // base64 barcode preview from the gateway
  returnDays: number;
  returnInfo: string;
  mrp: number;
  discount: number;
  pricing: VariantPricing[];
  variantOptionValueIds: string;
  repoId: number;
  options?: ItemVariantOptionSel[];
}

/** An item from the repository search (GetItemRepositoryData). */
export interface RepoItem {
  id: number;
  itemCode: string;
  itemName: string;
  designCode: string;
  designName: string;
  variantName: string;
}

/** A batch row from syncing a repository item (GetRepositoryBatchByRepoId). */
export interface RepositoryBatch {
  barcode: string;
  price: number;
  quantity: number;
}

/** A similar-item link (SimilarItems). */
export interface SimilarItem {
  similarItemId: number;
  forItemName: string;
  forVariantName: string;
  similarItemName: string;
  similarVariantName: string;
  isActive: boolean;
}

/** Price Range for tiered pricing. */
export interface ItemPriceRange {
  itemPriceChartId: number;
  fromQty: number;
  toQty: number;
  price: number;
  fromDate: string;
  toDate: string;
}

/** Custom Field Option (FieldViewModel). */
export interface CustomFieldOption {
  id: number;
  fieldId: number;
  name: string;
  fieldChecked: string;
  selected?: boolean;
}

/** Custom Field definition (ItemCustomFieldMaster). */
export interface ItemCustomField {
  mappingId: number;
  fieldId: number;
  fieldName: string;
  fieldValue: string;
  fieldType: string;
  fieldTypeId: number;
  isShow: boolean;
  selectedValue: number;
  fields: CustomFieldOption[];
}

/** Stock Transaction log. */
export interface StockTransaction {
  date: string;
  details: string;
}

/** A store location stock status row (StockList). */
export interface StockList {
  storeId: number;
  storeName: string;
  rol: number;
  moq: number;
  totalCurrentStock: number;
  itemROIMOQDetailsId: string | null;
  isSerialized: boolean | null;
  onOrderQty: number;
  available: number;
}

/** Request payload to save ROL/MOQ details. */
export interface RequestSaveRolMoqDetails {
  itemROIMOQDetailsId: string | number;
  itemId: number;
  itemVariantId: number;
  rol: number;
  moq: number;
  storeId: number;
}

/** A stock Bin location row (Bin). */
export interface Bin {
  binId: number;
  companyId?: number;
  name: string;
  isActive: boolean;
  storeId: number;
  isDefault: boolean;
  currentStock: number;
  isModal: boolean;
  itemId: number;
  itemVariantId: number;
  batchCode?: string;
  batchId?: number | null;
}

/** Dropdown Option for Item Variants in Stock Tab. */
export interface ItemVariantInfo {
  id: number;
  name: string;
}
