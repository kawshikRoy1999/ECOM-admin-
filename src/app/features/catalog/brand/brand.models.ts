/** A brand (GetBrandsListNew / GetBrandDtlById). */
export interface Brand {
  brandId: number;
  name: string;
  notes: string;
  logoFileName: string;
  bannerFileName: string;
  promoFileName: string;
  isActive: boolean;
}
