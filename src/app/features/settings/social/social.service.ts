import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { SocialLinks } from './social.models';

/** Company social links (CompanyManagement). */
@Injectable({ providedIn: 'root' })
export class SocialService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  get(): Observable<SocialLinks> {
    return this.api.post<SocialLinks>('CompanyManagement/GetAllSocialDetails', {
      CompanyId: this.auth.companyId(),
    });
  }

  save(model: Omit<SocialLinks, 'companyId'>): Observable<unknown> {
    const userId = this.auth.userId();
    const now = new Date().toISOString();
    const isUpdate = (model.companySocialLinkId ?? 0) > 0;
    // CreatedAt is a non-nullable DateTime on the server — must always be valid.
    return this.api.post('CompanyManagement/SaveUpdateSocialLink', {
      CompanySocialLinkId: model.companySocialLinkId,
      CompanyId: this.auth.companyId(),
      IsActive: model.isActive,
      Facebook: model.facebook,
      ShowFacebookOnline: model.showFacebookOnline,
      Instagram: model.instagram,
      ShowInstagramOnline: model.showInstagramOnline,
      Twitter: model.twitter,
      ShowTwitterOnline: model.showTwitterOnline,
      ContactEmail: model.contactEmail,
      ShowContactEmailOnline: model.showContactEmailOnline,
      ContactPhone: model.contactPhone,
      ShowContactPhoneOnline: model.showContactPhoneOnline,
      CreatedByUserId: userId,
      CreatedAt: model.createdAt || now,
      UpdatedByUserID: userId,
      UpdatedAt: isUpdate ? now : null,
    });
  }
}
