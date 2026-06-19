import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  CriteriaOption,
  OfferCriteria,
  OfferDetails,
  OfferListItem,
  SubCategoryNode,
  VariantResult,
} from './offer.models';

@Injectable({ providedIn: 'root' })
export class OffersService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  list(): Observable<OfferListItem[]> {
    return this.api.post<OfferListItem[]>('ProductManagement/AdminGetOfferList', {
      CompanyId: this.auth.companyId(),
      PageNumber: 1,
      PageSize: 200,
    });
  }

  details(offerId: number): Observable<OfferDetails> {
    return this.api.post<OfferDetails>('ProductManagement/AdminGetOfferDetails', {
      OfferId: offerId,
      CompanyId: this.auth.companyId(),
    });
  }

  save(offer: {
    offerId: number;
    offerName: string;
    discountPercentage: number;
    startDate: string;
    endDate: string;
    bannerImageUrl: string;
    isActive: boolean;
    isGroupOffer: boolean;
    criteria: OfferCriteria[];
  }): Observable<unknown> {
    return this.api.post('ProductManagement/AdminAddEditOffer', {
      OfferId: offer.offerId,
      CompanyId: this.auth.companyId(),
      OfferName: offer.offerName,
      DiscountPercentage: offer.discountPercentage,
      StartDate: offer.startDate,
      EndDate: offer.endDate,
      BannerImageUrl: offer.bannerImageUrl,
      IsActive: offer.isActive,
      IsGroupOffer: offer.isGroupOffer,
      UserId: this.auth.userId(),
      Criteria: offer.criteria.map((c) => ({ Type: c.type, Id: c.id, Name: c.name })),
    });
  }

  toggle(offerId: number, activate: boolean): Observable<unknown> {
    return this.api.post('ProductManagement/AdminToggleOfferStatus', {
      OfferId: offerId,
      CompanyId: this.auth.companyId(),
      ActionType: activate ? 'Activate' : 'Deactivate',
    });
  }

  // --- Criteria option sources ---
  categoryOptions(): Observable<CriteriaOption[]> {
    return this.api
      .post<unknown[]>('ProductManagement/GetCategoryAll', { CompanyId: this.auth.companyId(), Name: 'All' })
      .pipe(map((rows) => this.toOptions(rows, ['categoryId', 'id'], ['categoryName', 'name'])));
  }

  brandOptions(): Observable<CriteriaOption[]> {
    return this.api
      .post<unknown[]>('ProductManagement/GetBrandsListNew', { CompanyId: this.auth.companyId(), Name: '' })
      .pipe(map((rows) => this.toOptions(rows, ['brandId', 'id'], ['brandName', 'name'])));
  }

  /**
   * Subcategories + families for a category (one flat list). Nodes with
   * parentId === 0 are subcategories; others are families under that parent.
   */
  subcategories(categoryId: number): Observable<SubCategoryNode[]> {
    return this.api
      .post<unknown[]>('ProductManagement/GetSubCategoryByCategoryId', {
        CompanyId: this.auth.companyId(),
        CategoryId: categoryId,
        UserId: this.auth.userId(),
      })
      .pipe(
        map((rows) =>
          (rows ?? []).map((r) => {
            const o = r as Record<string, unknown>;
            return {
              id: Number(o['subCategoryId'] ?? o['id'] ?? 0),
              name: String(o['subCategoryName'] ?? o['name'] ?? ''),
              parentId: Number(o['parentSubCategoryId'] ?? 0),
            };
          }),
        ),
      );
  }

  /** Variant typeahead search (wraps the batch report endpoint). */
  searchVariants(opts: {
    search: string;
    page: number;
    categoryId?: number;
    brandId?: number;
    subCategoryId?: number;
  }): Observable<{ items: VariantResult[]; hasMore: boolean }> {
    const pageSize = 50;
    return this.api
      .post<{ batchReportList?: Record<string, unknown>[]; totalPageNumber?: number }>(
        'ProductManagement/GetBatchReport',
        {
          CompanyId: this.auth.companyId(),
          SearchCriteria: opts.search,
          Pagenumber: opts.page,
          RecordPerPage: pageSize,
          categoryId: String(opts.categoryId ?? 0),
          BrandId: opts.brandId || null,
          SubCategoryId: opts.subCategoryId || null,
        },
      )
      .pipe(
        map((data) => ({
          items: (data?.batchReportList ?? []).map((item) => ({
            id: Number(item['variantId'] ?? 0),
            text: `${item['name'] ?? ''} [${item['itemCode'] ?? ''}] ${item['batchCode'] ?? ''}`.trim(),
            imageUrl: String(item['imageUrl'] ?? ''),
          })),
          hasMore: opts.page < Number(data?.totalPageNumber ?? 0),
        })),
      );
  }

  /** Tolerant id/name extraction since these list shapes vary. */
  private toOptions(rows: unknown[], idKeys: string[], nameKeys: string[]): CriteriaOption[] {
    return (rows ?? []).map((r) => {
      const o = r as Record<string, unknown>;
      const id = idKeys.map((k) => o[k]).find((v) => v != null);
      const name = nameKeys.map((k) => o[k]).find((v) => v != null);
      return { id: Number(id ?? 0), name: String(name ?? '') };
    });
  }
}
