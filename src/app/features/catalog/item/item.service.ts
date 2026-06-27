import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  ItemDdlLists,
  ItemDetail,
  ItemListRow,
  NamedOption,
  SubCategoryOption,
  TaxOption,
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
    return this.api
      .post<{ orderlist?: Record<string, unknown>[]; totalRecord?: number; totalPageNumber?: number }>(
        'ProductManagement/GetItemList',
        {
          CompanyId: this.auth.companyId(),
          Name: filters.categoryName ?? '',
          ItemName: filters.itemName ?? '',
          BrandId: filters.brandId ? String(filters.brandId) : '',
          IsActive: filters.isActive ?? false,
          IsAll: filters.isAll ?? true,
          Pagenumber: filters.pageNumber ?? 1,
          RecordPerPage: filters.recordPerPage ?? 20,
        },
      )
      .pipe(
        map((d) => ({
          rows: (d?.orderlist ?? []).map((i) => this.mapListRow(i)),
          totalRecord: Number(d?.totalRecord ?? 0),
          totalPageNumber: Number(d?.totalPageNumber ?? 0),
        })),
      );
  }

  private mapListRow(i: Record<string, unknown>): ItemListRow {
    return {
      id: Number(i['id'] ?? i['itemId'] ?? 0),
      name: String(i['name'] ?? i['itemName'] ?? ''),
      variantName: String(i['variantName'] ?? ''),
      brand: String(i['brand'] ?? ''),
      brandId: Number(i['brandid'] ?? i['brandId'] ?? 0),
      price: Number(i['price'] ?? 0),
      rol: Number(i['rol'] ?? 0),
      quantity: Number(i['quantity'] ?? 0),
      imageUrl: String(i['imageUrl'] ?? i['image'] ?? ''),
      itemCode: String(i['itemCode'] ?? i['itemcode'] ?? ''),
      isActive: i['isActive'] !== false,
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
          itemCount: Number(d?.['itemCount'] ?? 0),
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
            taxName: String(t['taxName'] ?? ''),
            total: Number(t['total'] ?? 0),
          })),
        ),
      );
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
    const pricing = (d['inventoryPricingList'] as Record<string, unknown>[]) ?? [];
    const media = (d['inventoryMediaList'] as Record<string, unknown>[]) ?? [];
    return {
      itemId: Number(d['itemId'] ?? 0),
      brandId: Number(d['brandId'] ?? 0),
      categoryId: Number(d['categoryId'] ?? 0),
      subCategoryId: Number(d['subCategoryId'] ?? 0),
      itemName: String(d['itemName'] ?? ''),
      itemCode: String(d['itemCode'] ?? ''),
      itemDescription: String(d['itemDescription'] ?? ''),
      liveFromDate: String(d['liveFromDate'] ?? '').slice(0, 10),
      liveToDate: String(d['liveToDate'] ?? '').slice(0, 10),
      itemSortOrderInCategory: Number(d['itemSortOrderInCategory'] ?? 0),
      isActive: d['isActive'] !== false,
      isFeatureItem: d['isFeatureItem'] === true,
      isSoldOut: d['isSoldOut'] === true,
      isSerialized: d['isSerialized'] === true,
      taxId: Number(d['taxId'] ?? 0),
      hsn: String(d['hsn'] ?? d['hsN'] ?? ''),
      showAvailableQtyIfBelow: d['showAvailableQtyIfBelow'] != null ? Number(d['showAvailableQtyIfBelow']) : null,
      returnWindowInDays: d['returnWindowInDays'] != null ? Number(d['returnWindowInDays']) : null,
      isReturnWindowDays: d['isReturnWindowDays'] != null ? d['isReturnWindowDays'] === true : null,
      pricing: pricing.map((p) => ({
        itemPricingId: Number(p['itemPricingId'] ?? 0),
        mrp: Number(p['mrp'] ?? 0),
        discount: Number(p['discount'] ?? 0),
        price: Number(p['price'] ?? 0),
        cost: Number(p['cost'] ?? 0),
        startDate: String(p['startDate'] ?? '').slice(0, 10),
        endDate: String(p['endDate'] ?? '').slice(0, 10),
      })),
      media: media.map((m) => ({
        imageId: Number(m['imageId'] ?? 0),
        imageFullPath: String(m['imageFullPath'] ?? ''),
      })),
    };
  }

  /** Create/update an item (AddEditItemNew). */
  save(item: ItemDetail): Observable<unknown> {
    return this.api.post('ProductManagement/AddEditItemNew', {
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      ItemId: item.itemId,
      Username: this.auth.displayName(),
      AddEditItemDtl: {
        BrandId: item.brandId,
        CategoryId: item.categoryId,
        SubCategoryId: item.subCategoryId,
        ItemName: item.itemName,
        ItemCode: item.itemCode,
        ItemDescription: item.itemDescription,
        LiveFromDate: item.liveFromDate,
        LiveToDate: item.liveToDate,
        ItemSortOrderInCategory: item.itemSortOrderInCategory,
        IsActive: item.isActive,
        IsFeatureItem: item.isFeatureItem,
        IsSoldOut: item.isSoldOut,
        IsSerialized: item.isSerialized,
        TaxId: item.taxId,
        HSN: item.hsn,
        showAvailableQtyIfBelow: item.showAvailableQtyIfBelow,
        returnWindowInDays: item.returnWindowInDays,
        isReturnWindowDays: item.isReturnWindowDays,
      },
      AddEditItemPricing: item.pricing.map((p) => ({
        ItemPricingId: p.itemPricingId,
        MRP: p.mrp,
        Discount: p.discount,
        Price: p.price,
        ActualCostPerItem: p.cost,
        StartDate: p.startDate,
        EndDate: p.endDate,
      })),
      AddEditItemVariantOption: [],
    });
  }
}
