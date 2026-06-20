import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Banner } from './banner.models';

/** Banner management (ProductManagement). Image is uploaded first, path saved here. */
@Injectable({ providedIn: 'root' })
export class BannersService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  list(): Observable<Banner[]> {
    return this.api
      .post<Banner[] | { bannerList?: Banner[] }>('ProductManagement/GetBannerList', {
        CompanyId: this.auth.companyId(),
      })
      .pipe(map((d) => (Array.isArray(d) ? d : (d?.bannerList ?? []))));
  }

  save(banner: Pick<Banner, 'bannerId' | 'bannerName' | 'description' | 'imagePath'>): Observable<unknown> {
    return this.api.post('ProductManagement/SaveBannerDetails', {
      BannerId: banner.bannerId,
      BannerName: banner.bannerName,
      Description: banner.description,
      ImagePath: banner.imagePath,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
    });
  }

  delete(bannerId: number): Observable<unknown> {
    return this.api.post('ProductManagement/DeleteBannerDetails', {
      BannerId: bannerId,
      CompanyId: this.auth.companyId(),
    });
  }
}
