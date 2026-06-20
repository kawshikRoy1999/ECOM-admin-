/** Company social links (camelCase response from GetAllSocialDetails). */
export interface SocialLinks {
  companySocialLinkId: number;
  companyId: number;
  isActive: boolean;
  facebook: string;
  showFacebookOnline: boolean;
  instagram: string;
  showInstagramOnline: boolean;
  twitter: string;
  showTwitterOnline: boolean;
  contactEmail: string;
  showContactEmailOnline: boolean;
  contactPhone: string;
  showContactPhoneOnline: boolean;
  createdAt?: string;
}
