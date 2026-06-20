import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Location, LocationBin, LocationDetail } from './location.models';

/** Locations / warehouses (ProductManagement). */
@Injectable({ providedIn: 'root' })
export class LocationsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  list(): Observable<Location[]> {
    return this.api
      .post<Location[] | { locationList?: Location[] }>('ProductManagement/GetLocationList', {
        CompanyId: this.auth.companyId(),
      })
      .pipe(map((d) => (Array.isArray(d) ? d : (d?.locationList ?? []))));
  }

  detail(locationId: number): Observable<LocationDetail> {
    return this.api.post<LocationDetail>('ProductManagement/GetLocationDetailsById', {
      CompanyId: this.auth.companyId(),
      LocationId: locationId,
      UserId: this.auth.userId(),
    });
  }

  save(location: {
    locationId: number;
    locationName: string;
    addressLine1: string;
    addressLine2: string;
    pin: string;
    city: string;
    district: string;
    state: string;
    country: string;
    contactPerson: string;
    contactPersonPhone: string;
    contactPersonEmail: string;
    bins: LocationBin[];
  }): Observable<unknown> {
    return this.api.post('ProductManagement/SaveLocationDetails', {
      LocationId: location.locationId,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      LocationName: location.locationName,
      AddressLine1: location.addressLine1,
      AddressLine2: location.addressLine2,
      Pin: location.pin,
      City: location.city,
      District: location.district,
      State: location.state,
      Country: location.country,
      ContactPerson: location.contactPerson,
      ContactPersonPhone: location.contactPersonPhone,
      ContactPersonEmail: location.contactPersonEmail,
      BinNumbers: location.bins.map((b) => ({
        BinNumberId: b.binNumberId,
        BinNumber: b.binNumber,
        IsDefault: b.isDefault,
      })),
      DeliveryPersonId: [],
    });
  }

  delete(locationId: number): Observable<unknown> {
    return this.api.post('ProductManagement/DeleteLocationDetails', {
      LocationId: locationId,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
    });
  }
}
