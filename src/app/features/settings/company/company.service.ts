import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { BusinessUnit, CompanyInfo, LookUpInfo } from './company.models';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** Load the company profile (CompanyManagement/GetCompany). */
  get(): Observable<CompanyInfo> {
    return this.api
      .post<Record<string, unknown>>('CompanyManagement/GetCompany', {
        CompanyId: this.auth.companyId(),
      })
      .pipe(map((d) => this.mapCompany(d ?? {})));
  }

  /** Save the company profile (CompanyManagement/EditCompany). */
  save(c: CompanyInfo): Observable<unknown> {
    return this.api.post('CompanyManagement/EditCompany', {
      CompanyId: c.companyId,
      Name: c.name,
      ShortName: c.shortName,
      Address1: c.address1,
      Address2: c.address2,
      PIN: c.pin,
      DistrictCode: c.districtCode,
      StateCode: c.stateCode,
      CountryCode: c.countryCode,
      AdminPhone: c.adminPhone,
      ServicePhone: c.servicePhone,
      AdminEmail: c.adminEmail,
      ServiceEmail: c.serviceEmail,
      SecondaryEmail: c.secondaryEmail,
      GSTNumber: c.gstNumber,
      PanNumber: c.panNumber,
      BusinessType: c.businessType,
      CurrencyCode: c.currencyCode,
      ImageFilePath: c.imageFilePath,
      LogoFileName: c.logoFileName,
      FavIconFileName: c.favIconFileName,
      FooterFileName: c.footerFileName,
      Website: c.website,
      PINRequired: c.pinRequired,
      IsActive: c.isActive,
      Otpbasedauthenticationrequire: c.otpRequired,
      OtpbasedCOD: c.otpCOD,
      OtpbasedOnlinePayment: c.otpOnlinePayment,
      AdminPhoneCode: c.adminPhoneCode,
      ServicePhoneCode: c.servicePhoneCode,
      AdminPhoneCountryCode: c.adminPhoneCountryCode,
      ServicePhoneCountryCode: c.servicePhoneCountryCode,
      CreatedBy: this.auth.userId(),
    });
  }

  // --- Business Unit Configuration ---
  listBusinessUnits(): Observable<BusinessUnit[]> {
    return this.api
      .post<BusinessUnit[]>('ProductManagement/GetBusinessUnit', {
        CompanyId: this.auth.companyId(),
      })
      .pipe(map((rows) => rows ?? []));
  }

  saveBusinessUnit(u: BusinessUnit): Observable<unknown> {
    return this.api.post('ProductManagement/AddEditBusinessUnit', {
      BusinessUnitId: u.businessUnitId,
      CompanyId: this.auth.companyId(),
      UnitName: u.unitName,
      UnitCode: u.unitCode,
      UserName: this.auth.displayName(),
      FontColor: u.fontColor,
      BackgroundColor: u.backgroundColor,
    });
  }

  /** Toggle a business unit's active state (DeactivateBusinessUnit). */
  toggleBusinessUnit(businessUnitId: number): Observable<unknown> {
    return this.api.post('ProductManagement/DeactivateBusinessUnit', {
      BusinessUnitId: businessUnitId,
      UserName: this.auth.displayName(),
    });
  }

  /**
   * Tolerant mapping — gateway camelCasing of acronyms (GST, PIN, OTP) is
   * unpredictable, so probe several key variants per field.
   */
  private mapCompany(d: Record<string, unknown>): CompanyInfo {
    const pick = (...keys: string[]): unknown =>
      keys.map((k) => d[k]).find((v) => v !== undefined && v !== null);
    const str = (...keys: string[]) => String(pick(...keys) ?? '');
    const bool = (...keys: string[]) => pick(...keys) === true;

    const lookUps = ((pick('lookUps', 'LookUps') as Record<string, unknown>[]) ?? []).map((l) => ({
      lookUpValue: String(l['lookUpValue'] ?? l['LookUpValue'] ?? ''),
      lookUpText: String(l['lookUpText'] ?? l['LookUpText'] ?? ''),
    })) as LookUpInfo[];
    const selLookUp = pick('selectedLookUp', 'SelectedLookUp') as Record<string, unknown> | undefined;

    // Currency is a nested object on GetCompany ({currencyMasterId,countryCode,
    // currencyCode,currencySymbol}); only some of these also appear top-level.
    const cur = (pick('currency', 'Currency') as Record<string, unknown>) ?? {};
    const curStr = (...keys: string[]) =>
      String(keys.map((k) => cur[k]).find((v) => v != null) ?? '');

    return {
      companyId: Number(pick('companyId', 'CompanyId') ?? this.auth.companyId()),
      name: str('name', 'Name'),
      shortName: str('shortName', 'ShortName'),
      businessType: str('businessType', 'BusinessType'),
      address1: str('address1', 'Address1'),
      address2: str('address2', 'Address2'),
      pin: str('pin', 'pIN', 'PIN'),
      districtCode: str('districtCode', 'DistrictCode'),
      stateCode: str('stateCode', 'StateCode'),
      countryCode: str('countryCode', 'CountryCode') || curStr('countryCode', 'CountryCode'),
      adminPhone: str('adminPhone', 'AdminPhone'),
      servicePhone: str('servicePhone', 'ServicePhone'),
      adminEmail: str('adminEmail', 'AdminEmail'),
      serviceEmail: str('serviceEmail', 'ServiceEmail'),
      secondaryEmail: str('secondaryEmail', 'SecondaryEmail'),
      gstNumber: str('gstNumber', 'gSTNumber', 'GSTNumber'),
      panNumber: str('panNumber', 'PanNumber'),
      website: str('website', 'Website'),
      imageFilePath: str('imageFilePath', 'ImageFilePath'),
      logoFileName: str('logoFileName', 'LogoFileName'),
      favIconFileName: str('favIconFileName', 'FavIconFileName'),
      footerFileName: str('footerFileName', 'FooterFileName'),
      currencyCode: str('currencyCode', 'CurrencyCode') || curStr('currencyCode', 'CurrencyCode'),
      currencySymbol: str('currencySymbol', 'CurrencySymbol') || curStr('currencySymbol', 'CurrencySymbol'),
      pinRequired: bool('pinRequired', 'pINRequired', 'PINRequired'),
      isActive: bool('isActive', 'IsActive'),
      otpRequired: bool('otpbasedauthenticationrequire', 'Otpbasedauthenticationrequire'),
      otpCOD: bool('otpbasedCOD', 'OtpbasedCOD'),
      otpOnlinePayment: bool('otpbasedOnlinePayment', 'OtpbasedOnlinePayment'),
      adminPhoneCode: str('adminPhoneCode', 'AdminPhoneCode'),
      servicePhoneCode: str('servicePhoneCode', 'ServicePhoneCode'),
      adminPhoneCountryCode: str('adminPhoneCountryCode', 'AdminPhoneCountryCode'),
      servicePhoneCountryCode: str('servicePhoneCountryCode', 'ServicePhoneCountryCode'),
      lookUps,
      selectedLookUpValue: String(selLookUp?.['lookUpValue'] ?? selLookUp?.['LookUpValue'] ?? ''),
    };
  }
}
