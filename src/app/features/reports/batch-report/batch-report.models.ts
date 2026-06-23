/** A row in the item-wise batch (stock) report. */
export interface BatchRow {
  batchId: number;
  batchCode: string;
  itemId: number;
  variantId: number | null;
  name: string;
  itemCode: string;
  imageUrl: string;
  mrp: number;
  price: number;
  physicalQty: number | null;
  reservedQty: number | null;
}

/** Paginated batch-report response (BatchReportResponseWithPagination). */
export interface BatchReportPage {
  totalRecord: number;
  recordFrom: number;
  recordTo: number;
  totalPageNumber: number;
  batchReportList: BatchRow[];
}

/** Generic id/name option for the filter dropdowns. */
export interface NamedOption {
  id: number;
  name: string;
}

/** Filter state for the batch report. */
export interface BatchFilters {
  categoryId: number;
  categoryName: string;
  itemId: number;
  itemVariantId: number;
  searchCriteria: string;
  pageNumber: number;
  recordPerPage: number;
}
