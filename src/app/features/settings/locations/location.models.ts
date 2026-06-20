/** A storage bin within a location. */
export interface LocationBin {
  binNumberId: number;
  binNumber: string;
  isDefault: boolean;
}

/** Location list row (GetLocationList). */
export interface Location {
  locationId: number;
  locationName: string;
  addressLine1: string;
  addressLine2: string;
  country: string;
  state: string;
  city: string;
  pin: string;
  contactPerson: string;
  contactPersonPhone: string;
  contactPersonEmail: string;
}

/** Location detail (GetLocationDetailsById) — adds district + bins. */
export interface LocationDetail extends Location {
  dist?: string;
  district?: string;
  binDetails?: { binId: number; binName: string; isDefault: boolean }[];
}
