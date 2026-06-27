import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CustomerRating, NamedOption } from './review.models';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** Categories for the filter (GetAllCategories → data.categories [{id,name}]). */
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

  /**
   * Customer reviews filtered by category + status. The gateway returns
   * `status:false` even on success ("No data found."), so read the raw envelope.
   * @param reviewStatus null = all, 0 pending, 1 approved, 2 rejected.
   */
  ratings(categoryId: number | null, reviewStatus: number | null): Observable<CustomerRating[]> {
    return this.api
      .postRaw<CustomerRating[]>('ProductManagement/GetCustomerRatings', {
        CompanyId: this.auth.companyId(),
        CategoryId: categoryId,
        ReviewStatus: reviewStatus,
      })
      .pipe(map((res) => res?.data ?? []));
  }

  /** Approve (1) or reject (2) a single review. */
  updateStatus(ratingId: number, reviewStatus: number): Observable<unknown> {
    return this.api.post('ProductManagement/UpdateCustomerRatingStatus', {
      RatingId: ratingId,
      ReviewStatus: reviewStatus,
    });
  }
}
