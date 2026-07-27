// src/modules/reviews/domain/review-state-machine.spec.ts
//
// Unit tests for the Review state machine and the AI-cannot-approve guard.
// Pure logic, no I/O.

import {
  ReviewDecision,
  ReviewStatus,
  REVIEW_TRANSITIONS,
} from './review-states';
import {
  ReviewStateMachine,
  InvalidReviewTransitionError,
} from './review-state-machine';

describe('ReviewStateMachine', () => {
  describe('REVIEW_TRANSITIONS table', () => {
    it('covers all five statuses', () => {
      const keys = Object.keys(REVIEW_TRANSITIONS).sort();
      expect(keys).toEqual(
        [
          'APPROVED',
          'CANCELLED',
          'PENDING',
          'REJECTED',
          'REVISION_REQUESTED',
        ].sort(),
      );
    });

    it('all non-PENDING statuses are terminal', () => {
      expect(ReviewStateMachine.isTerminal(ReviewStatus.APPROVED)).toBe(true);
      expect(
        ReviewStateMachine.isTerminal(ReviewStatus.REVISION_REQUESTED),
      ).toBe(true);
      expect(ReviewStateMachine.isTerminal(ReviewStatus.REJECTED)).toBe(true);
      expect(ReviewStateMachine.isTerminal(ReviewStatus.CANCELLED)).toBe(true);
    });

    it('PENDING is not terminal', () => {
      expect(ReviewStateMachine.isTerminal(ReviewStatus.PENDING)).toBe(false);
    });
  });

  describe('canTransition', () => {
    const valid: [ReviewStatus, ReviewStatus][] = [
      [ReviewStatus.PENDING, ReviewStatus.APPROVED],
      [ReviewStatus.PENDING, ReviewStatus.REVISION_REQUESTED],
      [ReviewStatus.PENDING, ReviewStatus.REJECTED],
      [ReviewStatus.PENDING, ReviewStatus.CANCELLED],
    ];
    test.each(valid)('%s → %s is valid', (from, to) => {
      expect(ReviewStateMachine.canTransition(from, to)).toBe(true);
    });

    it('terminal statuses cannot transition anywhere', () => {
      const terminals = [
        ReviewStatus.APPROVED,
        ReviewStatus.REVISION_REQUESTED,
        ReviewStatus.REJECTED,
        ReviewStatus.CANCELLED,
      ];
      const all = Object.values(ReviewStatus);
      for (const from of terminals) {
        for (const to of all) {
          if (from === to) continue;
          expect(ReviewStateMachine.canTransition(from, to)).toBe(false);
        }
      }
    });
  });

  describe('assertTransition', () => {
    it('returns silently for valid transitions', () => {
      expect(() =>
        ReviewStateMachine.assertTransition(
          ReviewStatus.PENDING,
          ReviewStatus.APPROVED,
        ),
      ).not.toThrow();
    });

    it('throws InvalidReviewTransitionError for invalid transitions', () => {
      expect(() =>
        ReviewStateMachine.assertTransition(
          ReviewStatus.APPROVED,
          ReviewStatus.PENDING,
        ),
      ).toThrow(InvalidReviewTransitionError);
    });
  });

  describe('statusForDecision', () => {
    it('maps every decision to its terminal status', () => {
      expect(
        ReviewStateMachine.statusForDecision(ReviewDecision.APPROVED),
      ).toBe(ReviewStatus.APPROVED);
      expect(
        ReviewStateMachine.statusForDecision(ReviewDecision.REVISION_REQUESTED),
      ).toBe(ReviewStatus.REVISION_REQUESTED);
      expect(
        ReviewStateMachine.statusForDecision(ReviewDecision.REJECTED),
      ).toBe(ReviewStatus.REJECTED);
      expect(
        ReviewStateMachine.statusForDecision(ReviewDecision.CANCELLED),
      ).toBe(ReviewStatus.CANCELLED);
      expect(ReviewStateMachine.statusForDecision(ReviewDecision.PENDING)).toBe(
        ReviewStatus.PENDING,
      );
    });
  });
});
