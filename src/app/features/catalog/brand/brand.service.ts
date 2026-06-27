import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Brand } from './brand.models';

@Injectable({ providedIn: 'root' })
export class BrandService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  list(name = ''): Observable<Brand[]> {
    return this.api
      .post<Brand[]>('ProductManagement/GetBrandsListNew', {
        CompanyId: this.auth.companyId(),
        Name: name,
      })
      .pipe(map((rows) => rows ?? []));
  }

  detail(brandId: number): Observable<Brand> {
    return this.api.post<Brand>('ProductManagement/GetBrandDtlById', {
      CompanyId: this.auth.companyId(),
      BrandId: brandId,
    });
  }

  /** Add/edit a brand (SaveBrandsImage — name/notes + 3 image paths). */
  save(b: Brand): Observable<unknown> {
    return this.api.post('ProductManagement/SaveBrandsImage', {
      BrandId: b.brandId,
      Name: b.name,
      Notes: b.notes,
      LogoPath: b.logoFileName,
      BannerPath: b.bannerFileName,
      PromoPath: b.promoFileName,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
    });
  }

  /** Toggle a brand's visibility (ShowOrHideCheckBok). */
  toggle(brandId: number, isActive: boolean): Observable<unknown> {
    return this.api.post('ProductManagement/ShowOrHideCheckBok', {
      CompanyId: this.auth.companyId(),
      BrandId: brandId,
      IsActive: isActive,
    });
  }
}
