import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { BatchFilters, BatchReportPage, NamedOption } from './batch-report.models';

@Injectable({ providedIn: 'root' })
export class BatchReportService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** All categories (GetAllCategories → data.categories [{id,name}]). */
  categories(): Observable<NamedOption[]> {
    return this.api
      .post<{ categories?: Record<string, unknown>[] }>('ProductManagement/GetAllCategories', {
        CompanyId: this.auth.companyId(),
      })
      .pipe(
        map((d) =>
          (d?.categories ?? []).map((c) => ({
            id: Number(c['id'] ?? c['categoryId'] ?? 0),
            name: String(c['name'] ?? c['categoryName'] ?? ''),
          })),
        ),
      );
  }

  /** Items in a category — fetched by category NAME (GetItemList → data.orderlist). */
  itemsByCategory(categoryName: string): Observable<NamedOption[]> {
    return this.api
      .post<{ orderlist?: Record<string, unknown>[] }>('ProductManagement/GetItemList', {
        CompanyId: this.auth.companyId(),
        Name: categoryName,
        Pagenumber: 1,
        RecordPerPage: 1000,
      })
      .pipe(
        map((d) =>
          (d?.orderlist ?? []).map((i) => ({
            id: Number(i['id'] ?? i['itemId'] ?? 0),
            name: String(i['name'] ?? i['itemName'] ?? ''),
          })),
        ),
      );
  }

  /** Variants of an item (GetVariantListByItemId → [{itemVariantId,itemVariantName}]). */
  variantsByItem(itemId: number): Observable<NamedOption[]> {
    return this.api
      .post<Record<string, unknown>[]>('ProductManagement/GetVariantListByItemId', {
        CompanyId: this.auth.companyId(),
        ItemId: itemId,
      })
      .pipe(
        map((rows) =>
          (rows ?? []).map((v) => ({
            id: Number(v['itemVariantId'] ?? v['id'] ?? 0),
            name: String(v['itemVariantName'] ?? v['name'] ?? ''),
          })),
        ),
      );
  }

  /** The paginated batch (stock) report (GetBatchReport). */
  report(f: BatchFilters): Observable<BatchReportPage> {
    return this.api
      .post<BatchReportPage>('ProductManagement/GetBatchReport', {
        CompanyId: this.auth.companyId(),
        ItemId: f.itemId,
        ItemVariantId: f.itemVariantId,
        categoryId: String(f.categoryId || 0),
        SearchCriteria: f.searchCriteria,
        Pagenumber: f.pageNumber,
        RecordPerPage: f.recordPerPage,
      })
      .pipe(
        map((d) => ({
          totalRecord: d?.totalRecord ?? 0,
          recordFrom: d?.recordFrom ?? 0,
          recordTo: d?.recordTo ?? 0,
          totalPageNumber: d?.totalPageNumber ?? 0,
          batchReportList: d?.batchReportList ?? [],
        })),
      );
  }
}
