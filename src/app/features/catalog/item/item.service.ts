import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  AvailableVariantOption,
  ItemDdlLists,
  ItemDetail,
  ItemFaq,
  ItemListRow,
  ItemMeta,
  ItemTag,
  ItemVariantOptionSel,
  ItemVariantRow,
  NamedOption,
  VariantEdit,
  SimilarItem,
  SubCategoryOption,
  TaxOption,
  ItemPriceRange,
  ItemCustomField,
  StockTransaction,
  ItemImage,
  RepoItem,
  RepositoryBatch,
  StockList,
  RequestSaveRolMoqDetails,
  Bin,
  ItemVariantInfo,
} from './item.models';

@Injectable({ providedIn: 'root' })
export class ItemService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** Tolerant raw read for endpoints that may return status:false on success. */
  private postList<T>(path: string, body: unknown): Observable<T[]> {
    return this.api.postRaw<T[]>(path, body).pipe(map((res) => res?.data ?? []));
  }

  /**
   * Item list (GetItemList → data.orderlist). Mirrors the .NET status logic:
   * All → isAll=true/isActive=false, Active → isAll=false/isActive=true,
   * Inactive → isAll=false/isActive=false. IsActive is never null.
   */
  list(filters: {
    itemName?: string;
    brandId?: number;
    categoryName?: string;
    isAll?: boolean;
    isActive?: boolean;
    pageNumber?: number;
    recordPerPage?: number;
  }): Observable<{ rows: ItemListRow[]; totalRecord: number; totalPageNumber: number }> {
    // Use the raw envelope: GetItemList may return status:false even on success
    // (matching the other category/product list endpoints), which api.post throws on.
    return this.api
      .postRaw<{ orderlist?: Record<string, unknown>[]; totalRecord?: number; totalPageNumber?: number }>(
        'ProductManagement/GetItemList',
        {
          CompanyId: this.auth.companyId(),
          Name: filters.categoryName ?? '',
          ItemName: filters.itemName ?? '',
          // Gateway treats empty-string BrandId as "brand = none" (returns nothing);
          // null means "all brands" (same convention the offers module uses).
          BrandId: filters.brandId ? String(filters.brandId) : null,
          IsActive: filters.isActive ?? false,
          IsAll: filters.isAll ?? true,
          Pagenumber: filters.pageNumber ?? 1,
          RecordPerPage: filters.recordPerPage ?? 20,
        },
      )
      .pipe(
        map((res) => {
          const d = res?.data ?? {};
          return {
            rows: (d.orderlist ?? []).map((i) => this.mapListRow(i)),
            totalRecord: Number(d.totalRecord ?? 0),
            totalPageNumber: Number(d.totalPageNumber ?? 0),
          };
        }),
      );
  }

  /** Tolerant row mapping — gateway uses mixed casing (Brand, VariantName capitalized). */
  private mapListRow(i: Record<string, unknown>): ItemListRow {
    const pick = (...keys: string[]) => keys.map((k) => i[k]).find((v) => v != null);
    return {
      id: Number(pick('id', 'itemId', 'ItemId') ?? 0),
      name: String(pick('name', 'itemName', 'ItemName') ?? ''),
      variantName: String(pick('variantName', 'VariantName') ?? ''),
      brand: String(pick('brand', 'Brand') ?? ''),
      brandId: Number(pick('brandid', 'brandId', 'Brandid') ?? 0),
      price: Number(pick('price', 'Price') ?? 0),
      rol: Number(pick('rol', 'ROL') ?? 0),
      quantity: Number(pick('quantity', 'Quantity') ?? 0),
      imageUrl: String(pick('imageUrl', 'image', 'ImageUrl', 'Image') ?? ''),
      itemCode: String(pick('itemCode', 'itemcode', 'ItemCode') ?? ''),
      isActive: i['isActive'] !== false && i['IsActive'] !== false,
    };
  }

  /** Brand + category dropdowns + item-code format (GetALLItemDdlList). */
  ddlLists(): Observable<ItemDdlLists> {
    return this.api
      .post<Record<string, unknown>>('ProductManagement/GetALLItemDdlList', {
        CompanyId: this.auth.companyId(),
      })
      .pipe(
        map((d) => ({
          brands: this.toOptions(d?.['brand'] as Record<string, unknown>[]),
          categories: this.toOptions(d?.['category'] as Record<string, unknown>[]),
          itemCodeFormatName: String(d?.['itemCodeFormatName'] ?? ''),
          itemCodeFormatId: Number(d?.['itemCodeFormatId'] ?? 0),
          itemCount: Number(d?.['itemCount'] ?? 0),
          currency: String(d?.['currency'] ?? ''),
        })),
      );
  }

  private toOptions(rows?: Record<string, unknown>[]): NamedOption[] {
    return (rows ?? []).map((r) => ({
      id: Number(r['id'] ?? 0),
      name: String(r['name'] ?? ''),
    }));
  }

  /** Tax slabs (CompanyManagement/GetAllTax → data.allTaxes). */
  taxes(): Observable<TaxOption[]> {
    return this.api
      .post<{ allTaxes?: Record<string, unknown>[] }>('CompanyManagement/GetAllTax', {
        CompanyId: this.auth.companyId(),
      })
      .pipe(
        map((d) =>
          (d?.allTaxes ?? []).map((t) => ({
            taxDetailsId: Number(t['taxDetailsId'] ?? 0),
            taxName: `${t['taxName'] ?? ''} (${t['total'] ?? 0}%)`,
            total: Number(t['total'] ?? 0),
          })),
        ),
      );
  }

  /**
   * Available variant options + values for a category (GetVariantOptionsWithValues).
   * These are defined per-category (see category options); the item selects which apply.
   */
  categoryVariantOptions(categoryId: number): Observable<AvailableVariantOption[]> {
    return this.api
      .postRaw<{ variantOptions?: Record<string, unknown>[] }>(
        'ProductManagement/GetVariantOptionsWithValues',
        { CategoryId: categoryId },
      )
      .pipe(
        map((res) =>
          (res?.data?.variantOptions ?? []).map((o) => ({
            variantOptionId: Number(o['variantOptionId'] ?? 0),
            optionName: String(o['optionName'] ?? ''),
            appliedOnVariant: o['appliedOnVariant'] === true,
            optionValues: ((o['optionValues'] as Record<string, unknown>[]) ?? []).map((v) => ({
              optionValueId: Number(v['optionValueId'] ?? 0),
              optionValueName: String(v['optionValueName'] ?? ''),
            })),
          })),
        ),
      );
  }

  /** The item's actual variants (GetVariant → data.itemVariantList). */
  variants(itemId: number, variantOptionValueIds: string = ''): Observable<ItemVariantRow[]> {
    return this.api
      .postRaw<{ itemVariantList?: Record<string, unknown>[] }>('ProductManagement/GetVariant', {
        CompanyId: this.auth.companyId(),
        companyId: this.auth.companyId(),
        companyid: this.auth.companyId(),
        ItemId: itemId,
        itemId: itemId,
        itemid: itemId,
        VariantOptionValueIds: variantOptionValueIds,
        variantOptionValueIds: variantOptionValueIds,
        variantoptionvalueids: variantOptionValueIds,
      })
      .pipe(
        map((res) =>
          (res?.data?.itemVariantList ?? []).map((v) => ({
            itemVariantId: Number(v['itemVariantId'] ?? v['ItemVariantId'] ?? 0),
            itemVariantName: String(v['itemVariantName'] ?? v['ItemVariantName'] ?? ''),
            sku: String(v['sku'] ?? v['SKU'] ?? ''),
            barcode: String(v['barcode'] ?? v['Barcode'] ?? ''),
            price: Number(v['price'] ?? v['Price'] ?? 0),
            image: String(v['image'] ?? v['Image'] ?? v['imageUrl'] ?? v['ImageUrl'] ?? ''),
          })),
        ),
      );
  }

  /** Load a variant for add/edit (GetAddVariant). ItemVariantId=0 for a new variant (server generates SKU + barcode). */
  getAddVariant(itemId: number, itemVariantId: number): Observable<VariantEdit> {
    return this.api
      .post<Record<string, unknown>>('ProductManagement/GetAddVariant', {
        CompanyId: this.auth.companyId(),
        companyId: this.auth.companyId(),
        companyid: this.auth.companyId(),
        ItemId: itemId,
        itemId: itemId,
        itemid: itemId,
        ItemVariantId: itemVariantId,
        itemVariantId: itemVariantId,
        itemvariantid: itemVariantId,
      })
      .pipe(
        map((d) => {
          const pricing = ((d?.['inventoryItemVariantPricingList'] ?? d?.['InventoryItemVariantPricingList']) as Record<string, unknown>[]) ?? [];
          const options = ((d?.['inventoryOptionList'] ?? d?.['InventoryOptionList']) as Record<string, unknown>[]) ?? [];
          return {
            itemId: Number(d?.['itemId'] ?? itemId),
            itemVariantId: Number(d?.['itemVariantId'] ?? itemVariantId),
            itemVariantName: String(d?.['itemVariantName'] ?? ''),
            sku: String(d?.['sku'] ?? ''),
            barcode: String(d?.['barcode'] ?? ''),
            skuBarcodeImage: String(d?.['skuBarcode'] ?? ''),
            returnDays: Number(d?.['returnDays'] ?? 0),
            returnInfo: String(d?.['returnInfo'] ?? ''),
            mrp: Number(d?.['mrp'] ?? 0),
            discount: Number(d?.['discount'] ?? 0),
            variantOptionValueIds: '',
            repoId: 0,
            pricing: pricing.map((p) => ({
              itemPricingId: Number(p['itemPricingId'] ?? p['ItemPricingId'] ?? 0),
              mrp: Number(p['mrp'] ?? p['MRP'] ?? 0),
              discount: Number(p['discount'] ?? p['Discount'] ?? 0),
              price: Number(p['price'] ?? p['Price'] ?? 0),
              cost: Number(p['cost'] ?? p['Cost'] ?? 0),
              startDate: String(p['startDate'] ?? p['StartDate'] ?? '').slice(0, 10),
              endDate: String(p['endDate'] ?? p['EndDate'] ?? '').slice(0, 10),
              batchCode: String(p['batchCode'] ?? p['BatchCode'] ?? ''),
            })),
            options: options.map((o) => ({
              variantOptionId: Number(o['variantOptionId'] ?? o['VariantOptionId'] ?? 0),
              variantName: String(o['variantName'] ?? o['VariantName'] ?? o['optionName'] ?? o['OptionName'] ?? ''),
              defaultDisplayOrder: Number(o['defaultDisplayOrder'] ?? o['DefaultDisplayOrder'] ?? 0),
              isApplicable: o['isApplicable'] === true || o['IsApplicable'] === true || Number(o['appliedOnVariant'] ?? o['AppliedOnVariant'] ?? 0) !== 0,
              isFilterable: o['isFilterable'] === true || o['IsFilterable'] === true,
              selectedValues: (((o['variantOptionValue'] ?? o['VariantOptionValue']) as Record<string, unknown>[]) ?? []).map((v) => ({
                optionValueId: Number(v['optionValueId'] ?? v['OptionValueId'] ?? 0),
                variantOptionValueId: Number(v['variantOptionValueId'] ?? v['VariantOptionValueId'] ?? 0),
                optionValue: String(v['optionValue'] ?? v['OptionValue'] ?? ''),
                displayOrder: Number(v['displayOrder'] ?? v['DisplayOrder'] ?? 0),
                colorCode: String(v['colorCode'] ?? v['ColorCode'] ?? ''),
              })),
            })),
          };
        }),
      );
  }

  /** Create/update a variant (SaveInventoryVariant). */
  saveVariant(v: VariantEdit): Observable<unknown> {
    const payload = {
      CompanyId: this.auth.companyId(),
      companyId: this.auth.companyId(),
      companyid: this.auth.companyId(),
      UserId: this.auth.userId(),
      userId: this.auth.userId(),
      userid: this.auth.userId(),
      CreatedByUserId: this.auth.userId(),
      createdByUserId: this.auth.userId(),
      createdbyuserid: this.auth.userId(),
      UserName: this.auth.displayName(),
      userName: this.auth.displayName(),
      username: this.auth.displayName(),
      ItemId: v.itemId,
      itemId: v.itemId,
      itemid: v.itemId,
      ItemVariantId: v.itemVariantId,
      itemVariantId: v.itemVariantId,
      itemvariantid: v.itemVariantId,
      ItemVariantName: v.itemVariantName,
      itemVariantName: v.itemVariantName,
      itemvariantname: v.itemVariantName,
      SKU: v.sku,
      sku: v.sku,
      Barcode: v.barcode,
      barcode: v.barcode,
      ReturnDays: v.returnDays,
      returnDays: v.returnDays,
      returndays: v.returnDays,
      ReturnInfo: v.returnInfo,
      returnInfo: v.returnInfo,
      returninfo: v.returnInfo,
      MRP: v.mrp,
      mrp: v.mrp,
      Discount: v.discount,
      discount: v.discount,
      VariantOptionValueIds: v.variantOptionValueIds,
      variantOptionValueIds: v.variantOptionValueIds,
      variantoptionvalueids: v.variantOptionValueIds,
      RepoId: v.repoId || null,
      repoId: v.repoId || null,
      repoid: v.repoId || null,
      InventoryItemVariantPricingList: v.pricing.map((p) => ({
        ItemVariantPriceId: p.itemPricingId,
        itemVariantPriceId: p.itemPricingId,
        itemvariantpriceid: p.itemPricingId,
        MRP: p.mrp,
        mrp: p.mrp,
        Discount: p.discount,
        discount: p.discount,
        Price: p.price,
        price: p.price,
        Cost: p.cost,
        cost: p.cost,
        ActualCostPerItem: p.cost,
        actualCostPerItem: p.cost,
        actualcostperitem: p.cost,
        StartDate: p.startDate,
        startDate: p.startDate,
        startdate: p.startDate,
        EndDate: p.endDate,
        endDate: p.endDate,
        enddate: p.endDate,
        BatchCode: p.batchCode,
        batchCode: p.batchCode,
        batchcode: p.batchCode,
      })),
      inventoryItemVariantPricingList: v.pricing.map((p) => ({
        ItemVariantPriceId: p.itemPricingId,
        itemVariantPriceId: p.itemPricingId,
        itemvariantpriceid: p.itemPricingId,
        MRP: p.mrp,
        mrp: p.mrp,
        Discount: p.discount,
        discount: p.discount,
        Price: p.price,
        price: p.price,
        Cost: p.cost,
        cost: p.cost,
        ActualCostPerItem: p.cost,
        actualCostPerItem: p.cost,
        actualcostperitem: p.cost,
        StartDate: p.startDate,
        startDate: p.startDate,
        startdate: p.startDate,
        EndDate: p.endDate,
        endDate: p.endDate,
        enddate: p.endDate,
        BatchCode: p.batchCode,
        batchCode: p.batchCode,
        batchcode: p.batchCode,
      })),
      inventoryitemvariantpricinglist: v.pricing.map((p) => ({
        ItemVariantPriceId: p.itemPricingId,
        itemVariantPriceId: p.itemPricingId,
        itemvariantpriceid: p.itemPricingId,
        MRP: p.mrp,
        mrp: p.mrp,
        Discount: p.discount,
        discount: p.discount,
        Price: p.price,
        price: p.price,
        Cost: p.cost,
        cost: p.cost,
        ActualCostPerItem: p.cost,
        actualCostPerItem: p.cost,
        actualcostperitem: p.cost,
        StartDate: p.startDate,
        startDate: p.startDate,
        startdate: p.startDate,
        EndDate: p.endDate,
        endDate: p.endDate,
        enddate: p.endDate,
        BatchCode: p.batchCode,
        batchCode: p.batchCode,
        batchcode: p.batchCode,
      })),
    };
    return this.api.post('ProductManagement/SaveInventoryVariant', payload);
  }

  /** Delete a variant (DeleteVariant). */
  deleteVariant(itemVariantId: number, itemId: number): Observable<unknown> {
    return this.api.post('ProductManagement/DeleteVariant', {
      CompanyId: this.auth.companyId(),
      ItemVariantId: itemVariantId,
      ItemId: itemId,
      UserId: this.auth.userId(),
    });
  }

  /** Sub-categories for a category (GetSubCategoryByCategoryId). */
  subCategories(categoryId: number): Observable<SubCategoryOption[]> {
    return this.postList<Record<string, unknown>>('ProductManagement/GetSubCategoryByCategoryId', {
      CompId: this.auth.companyId(),
      CompanyId: this.auth.companyId(),
      CategoryId: categoryId,
    }).pipe(
      map((rows) =>
        rows.map((s) => ({
          id: Number(s['id'] ?? s['subCategoryId'] ?? 0),
          name: String(s['name'] ?? s['subCategoryName'] ?? ''),
          parentSubCategoryId: s['parentSubCategoryId'] != null ? Number(s['parentSubCategoryId']) : null,
        })),
      ),
    );
  }

  /** Get custom fields master list. ItemId=0 for a new item. */
  customFieldList(itemId: number): Observable<ItemCustomField[]> {
    return this.api
      .postRaw<Record<string, unknown>[]>('ProductManagement/MasterItemCustomFieldList', {
        CompanyId: this.auth.companyId(),
        ItemId: itemId,
      })
      .pipe(
        map((res) => this.mapCustomFields(res?.data ?? []))
      );
  }

  /** Get stock transaction history log. */
  stockTransactions(itemId: number): Observable<StockTransaction[]> {
    const today = new Date().toISOString().slice(0, 10);
    const body = {
      CompanyId: this.auth.companyId(),
      companyId: this.auth.companyId(),
      companyid: this.auth.companyId(),
      ItemId: itemId,
      itemId: itemId,
      itemid: itemId,
      ItemVariantId: 0,
      itemVariantId: 0,
      itemvariantid: 0,
      fromDate: '1970-01-01',
      toDate: today,
    };
    return this.api
      .postRaw<Record<string, any>>('ProductManagement/GetInventoryStatusLog', body)
      .pipe(
        map((res) => {
          const data = res?.data || {};
          const itemLogs = (data['responseGetInventoryStatusLogByItem'] || []) as any[];
          const variantLogs = (data['responseGetInventoryStatusLogByItemandVariant'] || []) as any[];
          const allLogs = [...itemLogs, ...variantLogs];
          return allLogs.map((s) => ({
            date: String(s.createdAT ?? s.createdDate ?? s.date ?? ''),
            details: String(s.comment ?? s.comments ?? ''),
          }));
        })
      );
  }

  /** Load an item for editing (GetEditItemNew → InventoryItemView). */
  getItem(itemId: number): Observable<ItemDetail> {
    return this.api
      .post<Record<string, unknown>>('ProductManagement/GetEditItemNew', {
        CompId: this.auth.companyId(),
        ItemId: itemId,
      })
      .pipe(map((d) => this.mapItemDetail(d ?? {})));
  }

  private mapItemDetail(d: Record<string, unknown>): ItemDetail {
    const pricing = ((d['inventoryPricingList'] ?? d['InventoryPricingList']) as Record<string, unknown>[]) ?? [];
    const media = ((d['inventoryMediaList'] ?? d['InventoryMediaList']) as Record<string, unknown>[]) ?? [];
    const options = ((d['inventoryOptionList'] ?? d['InventoryOptionList']) as Record<string, unknown>[]) ?? [];
    return {
      itemId: Number(d['itemId'] ?? d['ItemId'] ?? 0),
      brandId: Number(d['brandId'] ?? d['BrandId'] ?? 0),
      categoryId: Number(d['categoryId'] ?? d['CategoryId'] ?? 0),
      subCategoryId: Number(d['subCategoryId'] ?? d['SubCategoryId'] ?? 0),
      itemName: String(d['itemName'] ?? d['ItemName'] ?? ''),
      itemCode: String(d['itemCode'] ?? d['ItemCode'] ?? ''),
      itemDescription: String(d['itemDescription'] ?? d['ItemDescription'] ?? ''),
      liveFromDate: String(d['liveFromDate'] ?? d['LiveFromDate'] ?? '').slice(0, 10),
      liveToDate: String(d['liveToDate'] ?? d['LiveToDate'] ?? '').slice(0, 10),
      itemSortOrderInCategory: Number(d['itemSortOrderInCategory'] ?? d['ItemSortOrderInCategory'] ?? 0),
      isActive: d['isActive'] !== false && d['IsActive'] !== false,
      isFeatureItem: d['isFeatureItem'] === true || d['IsFeatureItem'] === true,
      isSoldOut: d['isSoldOut'] === true || d['IsSoldOut'] === true,
      isSerialized: d['isSerialized'] === true || d['IsSerialized'] === true,
      taxId: Number(d['taxId'] ?? d['TaxId'] ?? 0),
      hsn: String(d['hsn'] ?? d['hsN'] ?? d['HSN'] ?? ''),
      showAvailableQtyIfBelow: (d['showAvailableQtyIfBelow'] ?? d['ShowAvailableQtyIfBelow']) != null ? Number(d['showAvailableQtyIfBelow'] ?? d['ShowAvailableQtyIfBelow']) : null,
      returnWindowInDays: (d['returnWindowInDays'] ?? d['ReturnWindowInDays']) != null ? Number(d['returnWindowInDays'] ?? d['ReturnWindowInDays']) : null,
      isReturnWindowDays: (d['isReturnWindowDays'] ?? d['IsReturnWindowDays']) != null ? (d['isReturnWindowDays'] ?? d['IsReturnWindowDays']) === true : null,
      pricing: pricing.map((p) => ({
        itemPricingId: Number(p['itemPricingId'] ?? p['ItemPricingId'] ?? 0),
        mrp: Number(p['mrp'] ?? p['MRP'] ?? 0),
        discount: Number(p['discount'] ?? p['Discount'] ?? 0),
        price: Number(p['price'] ?? p['Price'] ?? 0),
        cost: Number(p['cost'] ?? p['Cost'] ?? 0),
        startDate: String(p['startDate'] ?? p['StartDate'] ?? '').slice(0, 10),
        endDate: String(p['endDate'] ?? p['EndDate'] ?? '').slice(0, 10),
      })),
      media: media.map((m) => ({
        imageId: Number(m['imageId'] ?? m['ImageId'] ?? 0),
        imageFullPath: String(m['imageFullPath'] ?? m['ImageFullPath'] ?? ''),
      })),
      variantOptions: options.map((o) => ({
        variantOptionId: Number(o['variantOptionId'] ?? o['VariantOptionId'] ?? 0),
        variantName: String(o['variantName'] ?? o['VariantName'] ?? o['optionName'] ?? o['OptionName'] ?? ''),
        defaultDisplayOrder: Number(o['defaultDisplayOrder'] ?? o['DefaultDisplayOrder'] ?? 0),
        isApplicable: o['isApplicable'] === true || o['IsApplicable'] === true,
        isFilterable: o['isFilterable'] === true || o['IsFilterable'] === true,
        selectedValues: (((o['variantOptionValue'] ?? o['VariantOptionValue']) as Record<string, unknown>[]) ?? []).map((v) => ({
          optionValueId: Number(v['optionValueId'] ?? v['OptionValueId'] ?? 0),
          variantOptionValueId: Number(v['variantOptionValueId'] ?? v['VariantOptionValueId'] ?? 0),
          optionValue: String(v['optionValue'] ?? v['OptionValue'] ?? ''),
          displayOrder: Number(v['displayOrder'] ?? v['DisplayOrder'] ?? 0),
          colorCode: String(v['colorCode'] ?? v['ColorCode'] ?? ''),
        })),
      })),
      isPriceRange: d['isPriceRange'] === true || d['IsPriceRange'] === true,
      priceRanges: (((d['addEditPriceRange'] ?? d['AddEditPriceRange']) as Record<string, unknown>[]) ?? []).map((p) => ({
        itemPriceChartId: Number(p['itemPriceChartId'] ?? p['ItemPriceChartId'] ?? 0),
        fromQty: Number(p['fromQty'] ?? p['FromQty'] ?? 0),
        toQty: Number(p['toQty'] ?? p['ToQty'] ?? 0),
        price: Number(p['price'] ?? p['Price'] ?? 0),
        fromDate: String(p['priceStartDt'] ?? p['PriceStartDt'] ?? p['fromDate'] ?? p['FromDate'] ?? '').slice(0, 10),
        toDate: String(p['priceEndDt'] ?? p['PriceEndDt'] ?? p['toDate'] ?? p['ToDate'] ?? '').slice(0, 10),
      })),
      customFields: this.mapCustomFields(((d['customFields'] ?? d['CustomFields']) as Record<string, unknown>[]) ?? []),
    };
  }

  private mapCustomFields(rows?: Record<string, unknown>[]): ItemCustomField[] {
    return (rows ?? []).map((c) => {
      const fields = ((c['fields'] as Record<string, unknown>[]) ?? []).map((f) => ({
        id: Number(f['id'] ?? 0),
        fieldId: Number(f['fieldId'] ?? 0),
        name: String(f['name'] ?? ''),
        fieldChecked: String(f['fieldChecked'] ?? ''),
        selected: String(f['fieldChecked'] ?? '') === 'checked',
      }));
      return {
        mappingId: Number(c['mappingId'] ?? 0),
        fieldId: Number(c['fieldId'] ?? 0),
        fieldName: String(c['fieldName'] ?? ''),
        fieldValue: String(c['fieldValue'] ?? ''),
        fieldType: String(c['fieldType'] ?? ''),
        fieldTypeId: Number(c['fieldTypeId'] ?? 0),
        isShow: c['isShow'] === true,
        selectedValue: Number(c['selectedValue'] ?? 0),
        fields,
      };
    });
  }

  // ============ Tags ============
  tags(itemId: number): Observable<ItemTag[]> {
    return this.postList<Record<string, unknown>>('ProductManagement/GetAllTagDetails', {
      ItemId: itemId,
      ItemVariant: 0,
      CompanyId: this.auth.companyId(),
    }).pipe(
      map((rows) =>
        rows.map((t) => ({
          tagId: Number(t['tagId'] ?? 0),
          tag: String(t['tag'] ?? ''),
          itemId: Number(t['itemId'] ?? itemId),
          displayOrder: Number(t['displayOrder'] ?? 0),
        })),
      ),
    );
  }

  saveTag(itemId: number, tagId: number, tag: string): Observable<unknown> {
    return this.api.post('ProductManagement/SaveUpdateTag', {
      TagId: tagId,
      CompanyId: this.auth.companyId(),
      Tag: tag,
      ItemId: itemId,
      IsActive: true,
      DisplayOrder: 0,
      ItemVariant: 0,
      TagCreatedBy: this.auth.userId(),
      TagUpdatedBy: this.auth.userId(),
    });
  }

  deleteTag(tagId: number): Observable<unknown> {
    return this.api.post('ProductManagement/DeleteTag', {
      TagId: tagId,
      CompanyId: this.auth.companyId(),
      TagUpdatedBy: this.auth.userId(),
    });
  }

  // ============ Meta / SEO ============
  metas(itemId: number): Observable<ItemMeta[]> {
    return this.postList<Record<string, unknown>>('ProductManagement/GetAllMetaVariantDetails', {
      ItemId: itemId,
      ItemVariant: 0,
      CompanyId: this.auth.companyId(),
    }).pipe(
      map((rows) =>
        rows.map((m) => ({
          metaTagId: Number(m['metaTagId'] ?? 0),
          metaTag: String(m['metaTag'] ?? ''),
          itemId: Number(m['itemId'] ?? itemId),
        })),
      ),
    );
  }

  saveMeta(itemId: number, metaTagId: number, metaTag: string): Observable<unknown> {
    return this.api.post('ProductManagement/SaveUpdateMeta', {
      MetaTagId: metaTagId,
      CompanyId: this.auth.companyId(),
      MetaTag: metaTag,
      ItemId: itemId,
      IsActive: true,
      ItemVariant: 0,
      MetaTagPostedBy: this.auth.userId(),
      MetaTagUpdatedBy: this.auth.userId(),
    });
  }

  deleteMeta(metaTagId: number): Observable<unknown> {
    return this.api.post('ProductManagement/DeleteMeta', {
      MetaId: metaTagId,
      CompanyId: this.auth.companyId(),
      MetaPostedBy: this.auth.userId(),
    });
  }

  // ============ FAQ ============
  faqs(itemId: number): Observable<ItemFaq[]> {
    return this.postList<Record<string, unknown>>('ProductManagement/GetAllFaqVariantDetails', {
      ItemId: itemId,
      ItemVariant: 0,
      CompanyId: this.auth.companyId(),
    }).pipe(
      map((rows) =>
        rows.map((f) => ({
          faqId: Number(f['faqId'] ?? 0),
          faq: String(f['faq'] ?? ''),
          faqAnswer: String(f['faqAnswer'] ?? ''),
          itemId: Number(f['itemId'] ?? itemId),
        })),
      ),
    );
  }

  saveFaq(itemId: number, faqId: number, faq: string, faqAnswer: string): Observable<unknown> {
    return this.api.post('ProductManagement/SaveUpdateFAQ', {
      FaqId: faqId,
      CompanyId: this.auth.companyId(),
      Faq: faq,
      FaqAnswer: faqAnswer,
      ItemId: itemId,
      IsActive: true,
      ItemVariant: 0,
      FaqPostedBy: this.auth.userId(),
      FaqUpdatedBy: this.auth.userId(),
      AnswerPostedBy: this.auth.userId(),
      AnswerUpdatedBy: this.auth.userId(),
    });
  }

  deleteFaq(faqId: number): Observable<unknown> {
    return this.api.post('ProductManagement/DeleteFAQ', {
      FaqId: faqId,
      CompanyId: this.auth.companyId(),
      FaqPostedBy: this.auth.userId(),
    });
  }

  // ============ Similar Items ============
  similarItems(itemId: number): Observable<SimilarItem[]> {
    return this.postList<Record<string, unknown>>('ProductManagement/GetSimilarItemsById', {
      CompanyId: this.auth.companyId(),
      ItemId: itemId,
    }).pipe(
      map((rows) =>
        rows.map((s) => ({
          similarItemId: Number(s['similarItemId'] ?? 0),
          forItemName: String(s['forItemName'] ?? ''),
          forVariantName: String(s['forVariantName'] ?? ''),
          similarItemName: String(s['similarItemName'] ?? ''),
          similarVariantName: String(s['similarVariantName'] ?? ''),
          isActive: s['isActive'] !== false,
        })),
      ),
    );
  }

  /** Items list for the similar-item picker (GetItemListByCompanyId). */
  itemOptions(): Observable<NamedOption[]> {
    return this.postList<Record<string, unknown>>('ProductManagement/GetItemListByCompanyId', {
      CompanyId: this.auth.companyId(),
    }).pipe(
      map((rows) =>
        rows.map((i) => ({
          id: Number(i['itemId'] ?? i['id'] ?? 0),
          name: String(i['itemName'] ?? i['name'] ?? ''),
        })),
      ),
    );
  }

  /** Variants of an item for the similar-item picker (GetVariantListByItemId). */
  variantOptions(itemId: number): Observable<NamedOption[]> {
    return this.postList<Record<string, unknown>>('ProductManagement/GetVariantListByItemId', {
      CompanyId: this.auth.companyId(),
      ItemId: itemId,
    }).pipe(
      map((rows) =>
        rows.map((v) => ({
          id: Number(v['itemVariantId'] ?? v['id'] ?? 0),
          name: String(v['itemVariantName'] ?? v['name'] ?? ''),
        })),
      ),
    );
  }

  saveSimilar(forItemId: number, itemId: number, variantId: number): Observable<unknown> {
    return this.api.post('ProductManagement/SaveSimilarItem', {
      CompanyId: this.auth.companyId(),
      ForItemId: forItemId,
      ForVarientId: 0,
      ItemId: itemId,
      VarientId: variantId,
      UserId: this.auth.userId(),
    });
  }

  toggleSimilar(similarItemId: number, isActive: boolean): Observable<unknown> {
    return this.api.post('ProductManagement/UpdateStatusSimilarItem', {
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      SimilarItemId: similarItemId,
      IsActive: isActive,
    });
  }

  deleteSimilar(similarItemId: number): Observable<unknown> {
    return this.api.post('ProductManagement/DeleTeSimilarItem', {
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      SimilarItemId: similarItemId,
    });
  }

  /**
   * Create/update an item. Gateway endpoint is AddEditItem (the .NET MVC action is
   * named AddEditItemNew). Returns the raw envelope so the caller can surface the
   * gateway's message on status:false instead of throwing a generic error.
   */
  save(item: ItemDetail): Observable<{ status: boolean; message: string; data: unknown }> {
    // Construct Custom Fields payload list matching the C# backend.
    const customFieldsPayload: { MappingId: number; FieldId: number; FieldValue: string; IsShow: boolean }[] = [];
    (item.customFields ?? []).forEach((c) => {
      if (c.fieldTypeId === 3 || c.fieldTypeId === 4) {
        // For Radio & Checkbox: push one entry per selected option value.
        c.fields.forEach((f) => {
          if (f.selected || f.fieldChecked === 'checked' || (c.fieldTypeId === 4 && c.fieldValue === f.name)) {
            customFieldsPayload.push({
              MappingId: c.mappingId,
              FieldId: c.fieldId,
              FieldValue: f.name,
              IsShow: c.isShow,
            });
          }
        });
      } else {
        // For Text / Dropdown / HTML
        customFieldsPayload.push({
          MappingId: c.mappingId,
          FieldId: c.fieldId,
          FieldValue: c.fieldValue,
          IsShow: c.isShow,
        });
      }
    });

    const formatToDdMmYyyy = (dateStr: string | undefined | null): string => {
      if (!dateStr) return '';
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    };

    const body = {
      CompanyId: this.auth.companyId(),
      companyId: this.auth.companyId(),
      companyid: this.auth.companyId(),
      UserId: this.auth.userId(),
      userId: this.auth.userId(),
      userid: this.auth.userId(),
      ItemId: item.itemId,
      itemId: item.itemId,
      itemid: item.itemId,
      Username: this.auth.displayName(),
      username: this.auth.displayName(),
      AddEditItemDtl: {
        ItemId: item.itemId,
        itemId: item.itemId,
        brandId: item.brandId,
        BrandId: item.brandId,
        CategoryId: item.categoryId,
        categoryId: item.categoryId,
        SubCategoryId: item.subCategoryId,
        subCategoryId: item.subCategoryId,
        ItemName: item.itemName?.trim(),
        itemName: item.itemName?.trim(),
        ItemCode: item.itemCode?.trim(),
        itemCode: item.itemCode?.trim(),
        ItemDescription: item.itemDescription,
        itemDescription: item.itemDescription,
        Currency: '',
        currency: '',
        LiveFromDate: formatToDdMmYyyy(item.liveFromDate || new Date().toISOString().slice(0, 10)),
        liveFromDate: formatToDdMmYyyy(item.liveFromDate || new Date().toISOString().slice(0, 10)),
        LiveToDate: formatToDdMmYyyy(item.liveToDate || new Date().toISOString().slice(0, 10)),
        liveToDate: formatToDdMmYyyy(item.liveToDate || new Date().toISOString().slice(0, 10)),
        ItemSortOrderInCategory: item.itemSortOrderInCategory,
        itemSortOrderInCategory: item.itemSortOrderInCategory,
        IsActive: item.isActive,
        isActive: item.isActive,
        IsFeatureItem: item.isFeatureItem,
        isFeatureItem: item.isFeatureItem,
        IsSoldOut: item.isSoldOut,
        isSoldOut: item.isSoldOut,
        IsSerialized: item.isSerialized,
        isSerialized: item.isSerialized,
        TaxId: item.taxId,
        taxId: item.taxId,
        HSN: item.hsn,
        hsn: item.hsn,
        showAvailableQtyIfBelow: item.showAvailableQtyIfBelow,
        returnWindowInDays: item.returnWindowInDays,
        isReturnWindowDays: item.isReturnWindowDays,
      },
      addEditItemDtl: {
        ItemId: item.itemId,
        itemId: item.itemId,
        BrandId: item.brandId,
        brandId: item.brandId,
        CategoryId: item.categoryId,
        categoryId: item.categoryId,
        SubCategoryId: item.subCategoryId,
        subCategoryId: item.subCategoryId,
        ItemName: item.itemName?.trim(),
        itemName: item.itemName?.trim(),
        ItemCode: item.itemCode?.trim(),
        itemCode: item.itemCode?.trim(),
        ItemDescription: item.itemDescription,
        itemDescription: item.itemDescription,
        Currency: '',
        currency: '',
        LiveFromDate: formatToDdMmYyyy(item.liveFromDate || new Date().toISOString().slice(0, 10)),
        liveFromDate: formatToDdMmYyyy(item.liveFromDate || new Date().toISOString().slice(0, 10)),
        LiveToDate: formatToDdMmYyyy(item.liveToDate || new Date().toISOString().slice(0, 10)),
        liveToDate: formatToDdMmYyyy(item.liveToDate || new Date().toISOString().slice(0, 10)),
        ItemSortOrderInCategory: item.itemSortOrderInCategory,
        itemSortOrderInCategory: item.itemSortOrderInCategory,
        IsActive: item.isActive,
        isActive: item.isActive,
        IsFeatureItem: item.isFeatureItem,
        isFeatureItem: item.isFeatureItem,
        IsSoldOut: item.isSoldOut,
        isSoldOut: item.isSoldOut,
        IsSerialized: item.isSerialized,
        isSerialized: item.isSerialized,
        TaxId: item.taxId,
        taxId: item.taxId,
        HSN: item.hsn,
        hsn: item.hsn,
        showAvailableQtyIfBelow: item.showAvailableQtyIfBelow,
        returnWindowInDays: item.returnWindowInDays,
        isReturnWindowDays: item.isReturnWindowDays,
      },
      addedititemdtl: {
        itemid: item.itemId,
        brandid: item.brandId,
        categoryid: item.categoryId,
        subcategoryid: item.subCategoryId,
        itemname: item.itemName?.trim(),
        itemcode: item.itemCode?.trim(),
        itemdescription: item.itemDescription,
        currency: '',
        livefromdate: formatToDdMmYyyy(item.liveFromDate || new Date().toISOString().slice(0, 10)),
        livetodate: formatToDdMmYyyy(item.liveToDate || new Date().toISOString().slice(0, 10)),
        itemsortorderincategory: item.itemSortOrderInCategory,
        isactive: item.isActive,
        isfeatureitem: item.isFeatureItem,
        issoldout: item.isSoldOut,
        isserialized: item.isSerialized,
        taxid: item.taxId,
        hsn: item.hsn,
        showavailableqtyifbelow: item.showAvailableQtyIfBelow,
        returnwindowindays: item.returnWindowInDays,
        isreturnwindowdays: item.isReturnWindowDays,
      },
      AddEditItemPricing: item.pricing.map((p) => ({
        ItemPricingId: p.itemPricingId,
        itemPricingId: p.itemPricingId,
        MRP: p.mrp,
        mrp: p.mrp,
        Discount: p.discount,
        discount: p.discount,
        Price: p.price,
        price: p.price,
        ActualCostPerItem: p.cost,
        actualCostPerItem: p.cost,
        StartDate: p.startDate,
        startDate: p.startDate,
        EndDate: p.endDate,
        endDate: p.endDate,
      })),
      addEditItemPricing: item.pricing.map((p) => ({
        ItemPricingId: p.itemPricingId,
        itemPricingId: p.itemPricingId,
        MRP: p.mrp,
        mrp: p.mrp,
        Discount: p.discount,
        discount: p.discount,
        Price: p.price,
        price: p.price,
        ActualCostPerItem: p.cost,
        actualCostPerItem: p.cost,
        StartDate: p.startDate,
        startDate: p.startDate,
        EndDate: p.endDate,
        endDate: p.endDate,
      })),
      AddEditItemVariantOption: (item.variantOptions ?? [])
        .filter((o) => o.isApplicable && o.selectedValues.length)
        .map((o) => ({
          VariantOptionId: o.variantOptionId,
          variantOptionId: o.variantOptionId,
          VariantName: o.variantName,
          variantName: o.variantName,
          DefaultDisplayOrder: o.defaultDisplayOrder,
          defaultDisplayOrder: o.defaultDisplayOrder,
          IsApplicable: o.isApplicable,
          isApplicable: o.isApplicable,
          IsFilterable: o.isFilterable,
          isFilterable: o.isFilterable,
          VariantOptionValue: o.selectedValues.map((v, i) => ({
            VariantOptionValueId: v.variantOptionValueId || 0,
            variantOptionValueId: v.variantOptionValueId || 0,
            OptionValueId: v.optionValueId || 0,
            optionValueId: v.optionValueId || 0,
            OptionValue: v.optionValue,
            optionValue: v.optionValue,
            DisplayOrder: v.displayOrder || i + 1,
            displayOrder: v.displayOrder || i + 1,
            ColorCode: v.colorCode || '',
            colorCode: v.colorCode || '',
          })),
        })),
      addEditItemVariantOption: (item.variantOptions ?? [])
        .filter((o) => o.isApplicable && o.selectedValues.length)
        .map((o) => ({
          VariantOptionId: o.variantOptionId,
          variantOptionId: o.variantOptionId,
          VariantName: o.variantName,
          variantName: o.variantName,
          DefaultDisplayOrder: o.defaultDisplayOrder,
          defaultDisplayOrder: o.defaultDisplayOrder,
          IsApplicable: o.isApplicable,
          isApplicable: o.isApplicable,
          IsFilterable: o.isFilterable,
          isFilterable: o.isFilterable,
          VariantOptionValue: o.selectedValues.map((v, i) => ({
            VariantOptionValueId: v.variantOptionValueId || 0,
            variantOptionValueId: v.variantOptionValueId || 0,
            OptionValueId: v.optionValueId || 0,
            optionValueId: v.optionValueId || 0,
            OptionValue: v.optionValue,
            optionValue: v.optionValue,
            DisplayOrder: v.displayOrder || i + 1,
            displayOrder: v.displayOrder || i + 1,
            ColorCode: v.colorCode || '',
            colorCode: v.colorCode || '',
          })),
        })),
      IsPriceRange: item.isPriceRange || false,
      isPriceRange: item.isPriceRange || false,
      AddEditPriceRange: (item.priceRanges ?? []).map((pr) => ({
        ItemPriceChartId: pr.itemPriceChartId,
        itemPriceChartId: pr.itemPriceChartId,
        FromQty: pr.fromQty,
        fromQty: pr.fromQty,
        ToQty: pr.toQty,
        toQty: pr.toQty,
        Price: pr.price,
        price: pr.price,
        FromDate: pr.fromDate,
        fromDate: pr.fromDate,
        ToDate: pr.toDate,
        toDate: pr.toDate,
      })),
      addEditPriceRange: (item.priceRanges ?? []).map((pr) => ({
        ItemPriceChartId: pr.itemPriceChartId,
        itemPriceChartId: pr.itemPriceChartId,
        FromQty: pr.fromQty,
        fromQty: pr.fromQty,
        ToQty: pr.toQty,
        toQty: pr.toQty,
        Price: pr.price,
        price: pr.price,
        FromDate: pr.fromDate,
        fromDate: pr.fromDate,
        ToDate: pr.toDate,
        toDate: pr.toDate,
      })),
      ItemCustomFileds: customFieldsPayload,
      itemCustomFileds: customFieldsPayload,
    };
    // DIAGNOSTIC: confirm the exact ItemId/CompanyId on the wire
    console.log('[AddEditItem] WIRE body — ItemId:', body.ItemId, 'CompanyId:', body.CompanyId, 'UserId:', body.UserId, body);
    return this.api.postRaw('ProductManagement/AddEditItem', body, true /* skipAuth — the .NET app calls AddEditItem token-less */);
  }

  addImage(request: {
    AlterText: string;
    Name: string;
    Medium: string;
    Thumbnail: string;
    Description: string;
    FilePath: string;
    Title: string;
    EntityType: string;
    EntitySubType: string;
    Height: number;
    Width: number;
    CompanyId: number;
    IsActive: boolean;
    ExternalEntityId: number;
    IsAllocated: boolean;
  }): Observable<{ data?: { imageId: number } }> {
    return this.api.post<{ data?: { imageId: number } }>('ProductManagement/AddImage', request);
  }

  deleteImage(imageId: number): Observable<unknown> {
    return this.api.post('ProductManagement/DeleteImage', {
      ImageId: imageId,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
    });
  }

  /** Search repository items (GetItemRepositoryData). */
  searchRepository(search: string): Observable<RepoItem[]> {
    return this.api
      .postRaw<Record<string, unknown>[]>('ProductManagement/GetItemRepositoryData', {
        Search: search,
        search: search,
      })
      .pipe(
        map((res) =>
          (res?.data ?? []).map((r: Record<string, unknown>) => ({
            id: Number(r['id'] ?? 0),
            itemCode: String(r['item_Code'] ?? r['itemCode'] ?? r['Item_Code'] ?? ''),
            itemName: String(r['item_Name'] ?? r['itemName'] ?? r['Item_Name'] ?? ''),
            designCode: String(r['design_Code'] ?? r['designCode'] ?? r['Design_Code'] ?? ''),
            designName: String(r['design_Name'] ?? r['designName'] ?? r['Design_Name'] ?? ''),
            variantName: String(r['variant_Name'] ?? r['variantName'] ?? r['Variant_Name'] ?? ''),
          })),
        ),
      );
  }

  /** Get repository batch rows by repo id (GetRepositoryBatchByRepoId). */
  getRepositoryBatch(repoId: number): Observable<RepositoryBatch[]> {
    return this.api
      .postRaw<Record<string, unknown>[]>('ProductManagement/GetRepositoryBatchByRepoId', {
        RepoId: repoId,
        repoId: repoId,
      })
      .pipe(
        map((res) =>
          (res?.data ?? []).map((b: Record<string, unknown>) => ({
            barcode: String(b['barcode'] ?? b['Barcode'] ?? ''),
            price: Number(b['price'] ?? b['Price'] ?? 0),
            quantity: Number(b['quantity'] ?? b['Quantity'] ?? 0),
          })),
        ),
      );
  }

  /** Get list of store locations stock (GetStoreListByItemVariantId & GetItemROIMOQDetails). */
  getStoreList(itemId: number, variantId: number, isSerialized: boolean): Observable<StockList[]> {
    const payload = {
      ItemId: itemId,
      itemId: itemId,
      ItemVariantId: variantId,
      itemVariantId: variantId,
      CompanyId: this.auth.companyId(),
      companyId: this.auth.companyId(),
      IsSerialized: isSerialized,
      isSerialized: isSerialized,
      CreatedBy: this.auth.userId(),
      createdBy: this.auth.userId(),
    };
    return this.api
      .postRaw<Record<string, unknown>[]>('ProductManagement/GetStoreListByItemVariantId', payload)
      .pipe(
        map((res) => {
          const list = (res?.data ?? []).map((s: Record<string, unknown>) => ({
            storeId: Number(s['storeId'] ?? s['StoreId'] ?? 0),
            storeName: String(s['storeName'] ?? s['StoreName'] ?? ''),
            rol: Number(s['rol'] ?? s['ROL'] ?? 0),
            moq: Number(s['moq'] ?? s['MOQ'] ?? 0),
            totalCurrentStock: Number(s['totalCurrentStock'] ?? s['TotalCurrentStock'] ?? 0),
            itemROIMOQDetailsId: s['itemROIMOQDetailsId'] ? String(s['itemROIMOQDetailsId']) : null,
            isSerialized: s['isSerialized'] === true,
            onOrderQty: Number(s['onOrderQty'] ?? s['OnOrderQty'] ?? 0),
            available: Number(s['available'] ?? s['Available'] ?? 0),
          }));
          return list;
        }),
      );
  }

  /** Save ROL/MOQ details for a warehouse/store (SaveItemROIMOQDetails). */
  saveRolMoq(details: RequestSaveRolMoqDetails): Observable<unknown> {
    const payload = {
      ItemROIMOQDetailsId: details.itemROIMOQDetailsId || null,
      itemROIMOQDetailsId: details.itemROIMOQDetailsId || null,
      ItemId: details.itemId,
      itemId: details.itemId,
      ItemVariantId: details.itemVariantId,
      itemVariantId: details.itemVariantId,
      ROL: Number(details.rol),
      rol: Number(details.rol),
      MOQ: Number(details.moq),
      moq: Number(details.moq),
      StoreId: Number(details.storeId),
      storeId: Number(details.storeId),
      CompanyId: this.auth.companyId(),
      companyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      userId: this.auth.userId(),
      CreatedByUserName: this.auth.displayName(),
      createdByUserName: this.auth.displayName(),
    };
    return this.api.post('ProductManagement/SaveItemROIMOQDetails', payload);
  }

  /** Get ROL/MOQ list details (GetItemROIMOQDetails) directly. */
  getRolMoqList(itemId: number, variantId: number): Observable<any[]> {
    return this.api.postRaw<any[]>('ProductManagement/GetItemROIMOQDetails', {
      ItemId: itemId,
      itemId: itemId,
      ItemVariantId: variantId,
      itemVariantId: variantId,
      CompanyId: this.auth.companyId(),
      companyId: this.auth.companyId(),
    }).pipe(map(res => res?.data ?? []));
  }

  /** Get bin list for warehouse and variant (GetBinListByStoreIdComapnyId). */
  getBinList(storeId: number, itemId: number, variantId: number, isModal: boolean): Observable<Bin[]> {
    return this.api
      .postRaw<Record<string, unknown>[]>('ProductManagement/GetBinListByStoreIdComapnyId', {
        StoreId: storeId,
        storeId: storeId,
        ItemId: itemId,
        itemId: itemId,
        ItemVariantId: variantId,
        itemVariantId: variantId,
        IsModal: isModal,
        isModal: isModal,
        CompanyId: this.auth.companyId(),
        companyId: this.auth.companyId(),
      })
      .pipe(
        map((res) =>
          (res?.data ?? []).map((b: Record<string, unknown>) => ({
            binId: Number(b['binId'] ?? b['BinId'] ?? 0),
            name: String(b['name'] ?? b['Name'] ?? ''),
            isActive: b['isActive'] === true,
            storeId: Number(b['storeId'] ?? b['StoreId'] ?? storeId),
            isDefault: b['isDefault'] === true,
            currentStock: Number(b['currentStock'] ?? b['CurrentStock'] ?? 0),
            isModal: b['isModal'] === true,
            itemId: Number(b['itemId'] ?? b['ItemId'] ?? itemId),
            itemVariantId: Number(b['itemVariantId'] ?? b['ItemVariantId'] ?? variantId),
            batchCode: b['batchCode'] ? String(b['batchCode']) : undefined,
            batchId: b['batchId'] ? Number(b['batchId']) : null,
          })),
        ),
      );
  }

  /** Adjust quantity in Bins (SaveUpdateBin). */
  saveUpdateBin(binList: Bin[]): Observable<unknown> {
    const listPayload = binList.map((b) => ({
      BinId: b.binId,
      binId: b.binId,
      Name: b.name,
      name: b.name,
      CurrentStock: Number(b.currentStock),
      currentStock: Number(b.currentStock),
      ItemId: b.itemId,
      itemId: b.itemId,
      ItemVariantId: b.itemVariantId,
      itemVariantId: b.itemVariantId,
      StoreId: b.storeId,
      storeId: b.storeId,
      BatchCode: b.batchCode || null,
      batchCode: b.batchCode || null,
      BatchId: b.batchId || null,
      batchId: b.batchId || null,
      CompanyId: this.auth.companyId(),
      companyId: this.auth.companyId(),
      CreatedBy: this.auth.userId(),
      createdBy: this.auth.userId(),
      UserName: this.auth.displayName(),
      userName: this.auth.displayName(),
    }));
    return this.api.post('ProductManagement/SaveUpdateBin', listPayload);
  }

  /** Save mapping between variant and item images (SaveItemImageVariant). */
  saveVariantImages(itemId: number, variantId: number, imageIds: number[]): Observable<unknown> {
    return this.api.post('ProductManagement/SaveItemImageVariant', {
      ItemId: itemId,
      itemId: itemId,
      ItemVariantId: variantId,
      itemVariantId: variantId,
      ImageIds: imageIds,
      imageIds: imageIds,
      CompanyId: this.auth.companyId(),
      companyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      userId: this.auth.userId(),
    });
  }

  /** Get batch code dropdown list for Stock tab (GetVariantBatchCodeList). */
  getVariantBatchCodeList(itemId: number, variantId: number): Observable<any[]> {
    return this.api.postRaw<any[]>('ProductManagement/GetVariantBatchCodeList', {
      ItemId: itemId,
      itemId: itemId,
      ItemVariantId: variantId,
      itemVariantId: variantId,
      CompanyId: this.auth.companyId(),
      companyId: this.auth.companyId(),
    }).pipe(map(res => res?.data ?? []));
  }

  /** Get list of image ids assigned to a variant (GetVariantImageDtl). */
  getVariantImageDtl(itemId: number, variantId: number): Observable<number[]> {
    return this.api
      .postRaw<number[]>('ProductManagement/GetVariantImageDtl', {
        ItemId: itemId,
        itemId: itemId,
        ItemVariantId: [variantId],
        itemVariantId: [variantId],
        CompanyId: this.auth.companyId(),
        companyId: this.auth.companyId(),
      })
      .pipe(map((res) => (res?.data ?? []).map(Number)));
  }

  /** Get list of all images uploaded for the item (GetItemWiseImageList). */
  getItemWiseImageList(itemId: number): Observable<ItemImage[]> {
    return this.api
      .postRaw<Record<string, unknown>[]>('ProductManagement/GetItemWiseImageList', {
        ItemId: itemId,
        itemId: itemId,
        CompanyId: this.auth.companyId(),
        companyId: this.auth.companyId(),
        ItemVariantId: [],
        itemVariantId: [],
      })
      .pipe(
        map((res) =>
          (res?.data ?? []).map((m: Record<string, unknown>) => ({
            imageId: Number(m['imageId'] ?? m['ImageId'] ?? 0),
            imageFullPath: String(m['imageFullPath'] ?? m['ImageFullPath'] ?? ''),
          }))
        )
      );
  }
}
