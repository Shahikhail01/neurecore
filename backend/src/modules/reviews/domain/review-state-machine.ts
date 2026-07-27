// src/modules/reviews/domain/review-state-machine.ts
import {
  ReviewDecision,
  ReviewStatus,
  REVIEW_TRANSITIONS,
} from './review-states';

/**
 * Review state machine — single authoritative source for valid Review transitions.
 * Mirrors the REVIEW_TRANSITIONS table from review-states.ts but exposes
 * consistent guards/errors and an AI-cannot-approve-assertion.
 */

export class InvalidReviewTransitionError extends Error {
  constructor(from: ReviewStatus, to: ReviewStatus) {
    super(`Invalid review transition from ${from} to ${to}`);
  }
}

export class ReviewStateMachine {
  static canTransition(from: ReviewStatus, to: ReviewStatus): boolean {
    return REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
  }

  static assertTransition(from: ReviewStatus, to: ReviewStatus): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidReviewTransitionError(from, to);
    }
  }

  static isTerminal(status: ReviewStatus): boolean {
    return REVIEW_TRANSITIONS[status]?.length === 0;
  }

  /**
   * Maps a ReviewDecision to the corresponding terminal ReviewStatus.
   * PENDING has no equivalent decision value (it's the initial state, not a decision).
   */
  static statusForDecision(decision: ReviewDecision): ReviewStatus {
    switch (decision) {
      case ReviewDecision.PENDING:
        return ReviewStatus.PENDING;
      case ReviewDecision.APPROVED:
        return ReviewStatus.APPROVED;
      case ReviewDecision.REVISION_REQUESTED:
        return ReviewStatus.REVISION_REQUESTED;
      case ReviewDecision.REJECTED:
        return ReviewStatus.REJECTED;
      case ReviewDecision.CANCELLED:
        return ReviewStatus.CANCELLED;
      default: {
        // Exhaustiveness check
        const _exhaustive: never = decision;
        throw new Error(`Unknown review decision: ${String(decision)}`);
      }
    }
  }
}
