/** A company order-status mapping (admin name + storefront-facing name). */
export interface CompanyStatus {
  statusId: number;
  statusName: string;
  storeFrontStatus: string;
  isActive: boolean;
}

/** A cancellation reason. */
export interface CancellationReason {
  cancellationReasonId: number;
  reasonName: string;
  explanationRequired: boolean;
  isActive: boolean;
}
