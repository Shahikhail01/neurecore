// src/modules/reviews/domain/review-states.ts
export enum ReviewDecision {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  NEEDS_REVISION = 'NEEDS_REVISION',
  ESCALATED = 'ESCALATED',
}

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export const REVIEW_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  [ReviewStatus.PENDING]: [
    ReviewStatus.APPROVED,
    ReviewStatus.REVISION_REQUESTED,
    ReviewStatus.REJECTED,
    ReviewStatus.CANCELLED,
  ],
  [ReviewStatus.APPROVED]: [],
  [ReviewStatus.REVISION_REQUESTED]: [],
  [ReviewStatus.REJECTED]: [],
  [ReviewStatus.CANCELLED]: [],
};
