import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  BusinessUnitOption,
  Category,
  CategoryOption,
  OptionValue,
  SubCategory,
} from './category.models';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /**
   * Several category list endpoints return `status:false` even on success
   * (the .NET app ignores status and reads `data` directly). `ApiService.post`
   * throws on status:false, so use the raw envelope and read `data` ourselves.
   */
  private postList<T>(path: string, body: unknown): Observable<T[]> {
    return this.api.postRaw<T[]>(path, body).pipe(map((res) => res?.data ?? []));
  }

  // --- Categories ---
  list(name = 'All'): Observable<Category[]> {
    return this.api
      .post<Category[]>('ProductManagement/GetCategoryAll', {
        CompanyId: this.auth.companyId(),
        Name: name || 'All',
      })
      .pipe(map((rows) => rows ?? []));
  }

  saveCategory(c: Category): Observable<unknown> {
    return this.api.post('ProductManagement/SaveEditCat', {
      UserId: this.auth.userId(),
      CategoryId: c.categoryId,
      CompanyId: this.auth.companyId(),
      CatName: c.name,
      ImagePath: c.imageName,
      IconPath: c.iconImage,
      ReturnWindowInDays: c.returnWindowInDays,
      NonReturnable: c.nonReturnable,
      BusinessUnitId: c.businessUnitId ?? 0,
    });
  }

  /** Toggle a category's visibility (ShowOrHideCatChkBox). */
  toggleCategory(categoryId: number, isActive: boolean): Observable<unknown> {
    return this.api.post('ProductManagement/ShowOrHideCatChkBox', {
      CompanyId: this.auth.companyId(),
      CatId: categoryId,
      IsActive: isActive,
      UserId: this.auth.userId(),
    });
  }

  // --- Sub-categories ---
  subCategories(categoryId: number): Observable<SubCategory[]> {
    return this.postList<SubCategory>('ProductManagement/GetAllSubCategory', {
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      CategoryId: categoryId,
    });
  }

  // --- Sub-sub-categories (children of a sub-category) ---
  subSubCategories(subCategoryId: number): Observable<SubCategory[]> {
    return this.postList<SubCategory>('ProductManagement/GetAllSubSubCategory', {
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      SubCategoryId: subCategoryId,
    });
  }

  /** Add/edit a sub-category or sub-sub-category (shared AddEditSubCategory). */
  saveSubCategory(s: SubCategory): Observable<unknown> {
    return this.api.post('ProductManagement/AddEditSubCategory', {
      CategoryId: s.categoryId,
      SubCategoryId: s.subCategoryId,
      ParentSubCategoryId: s.parentSubCategoryId,
      SubCategoryName: s.subCategoryName,
      IsActive: s.isActive,
      SortOrder: s.sortOrder,
      ReturnWindowInDays: s.returnWindowInDays,
      NonReturnable: s.nonReturnable,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
    });
  }

  /** Delete a sub-category or sub-sub-category (shared DeleteSubCategory). */
  deleteSubCategory(subCategoryId: number): Observable<unknown> {
    return this.api.post('ProductManagement/DeleteSubCategory', {
      CompanyId: this.auth.companyId(),
      SubCategoryId: subCategoryId,
      UserId: this.auth.userId(),
    });
  }

  // --- Category / Sub-category Options (attributes + values) ---
  /** List options for a category (subCategoryId=0) or a sub-category. */
  options(categoryId: number, subCategoryId = 0): Observable<CategoryOption[]> {
    if (subCategoryId > 0) {
      return this.postList<CategoryOption>('ProductManagement/GetSubCategoryOption', {
        CategoryId: categoryId,
        SubCategoryId: subCategoryId,
        CompanyId: this.auth.companyId(),
        UserId: this.auth.userId(),
      });
    }
    return this.postList<CategoryOption>('ProductManagement/GetCategoryOption', {
      CategoryId: categoryId,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
    });
  }

  /** Values for an option (GetOptionValues → [{optionValueId, optionName=value}]). */
  optionValues(optionId: number): Observable<OptionValue[]> {
    return this.postList<Record<string, unknown>>('ProductManagement/GetOptionValues', {
      optionId,
    }).pipe(
      map((rows) =>
        rows.map((v, i) => ({
          optionValueId: Number(v['optionValueId'] ?? 0),
          value: String(v['optionName'] ?? v['value'] ?? ''),
          displayOrder: Number(v['displayOrder'] ?? i + 1),
        })),
      ),
    );
  }

  saveOption(
    opt: CategoryOption,
    values: OptionValue[],
  ): Observable<unknown> {
    return this.api.post('ProductManagement/AddEditCategoryOption', {
      CategoryId: opt.categoryId,
      SubCategoryId: opt.subCategoryId,
      VariantOptionId: opt.variantOptionId,
      OptionName: opt.optionName,
      DisplayOrder: opt.displayOrder,
      isItemLevelAttribute: opt.isItemLevelAttribute,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      OptionValues: values
        .filter((v) => v.value.trim())
        .map((v, i) => ({ OptionValueId: v.optionValueId, Value: v.value, DisplayOrder: i + 1 })),
    });
  }

  deleteOption(optionId: number): Observable<unknown> {
    return this.api.post('ProductManagement/DeleteCategoryOption', {
      CompanyId: this.auth.companyId(),
      CategoryOptionId: optionId,
      UserId: this.auth.userId(),
    });
  }

  /** Persist option display order (DisplayOrderString = "id#order,id#order,…"). */
  saveOptionOrder(
    categoryId: number,
    subCategoryId: number,
    orderedIds: number[],
  ): Observable<unknown> {
    const displayOrderString = orderedIds.map((id, i) => `${id}#${i + 1}`).join(',') + ',';
    return this.api.post('ProductManagement/SaveCategoryOptionDisplayOrder', {
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      DisplayOrderString: displayOrderString,
      CategoryId: categoryId,
      SubCategoryId: subCategoryId,
    });
  }

  // --- Business units (for the category form dropdown) ---
  businessUnits(): Observable<BusinessUnitOption[]> {
    return this.api
      .post<BusinessUnitOption[]>('ProductManagement/GetBusinessUnit', {
        CompanyId: this.auth.companyId(),
      })
      .pipe(map((rows) => (rows ?? []).filter((b) => b.businessUnitId)));
  }
}
