/** A company order-status mapping (admin name + storefront-facing name + order step). */
export interface CompanyStatus {
  statusId: number;
  statusName: string;
  storeFrontStatus: string;
  isActive: boolean;
  /** Mapped order-workflow step (CompanyOrderProcessId); null/0 = unmapped. */
  companyOrderProcessId: number | null;
  companyOrderProcessName?: string;
}

/** An order-workflow step (GetCompanyOrderProcessList / SaveCompanyOrderProcess). */
export interface CompanyOrderProcess {
  companyOrderProcessId: number;
  name: string;
  imageUrl: string;
  isActive: boolean;
}

/** A cancellation reason. */
export interface CancellationReason {
  cancellationReasonId: number;
  reasonName: string;
  explanationRequired: boolean;
  isActive: boolean;
}
