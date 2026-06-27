/** Review/rating moderation status. */
export const REVIEW_PENDING = 0;
export const REVIEW_APPROVED = 1;
export const REVIEW_REJECTED = 2;

/** A customer product review awaiting moderation (CustomerRatingResponse). */
export interface CustomerRating {
  ratingId: number;
  itemCode: string;
  name: string;
  review: string;
  reviewStatus: number; // 0 pending, 1 approved, 2 rejected
  rating: number;
  customerName: string;
  createdDate: string;
}

/** id/name option for the category filter. */
export interface NamedOption {
  id: number;
  name: string;
}
