-- ═══════════════════════════════════════════════════════════════════════════
-- 20260728_align_review_decision_enum_step2
-- ═══════════════════════════════════════════════════════════════════════════
-- Part 2 of the review-enum alignment. See 20260728_align_review_decision_enum.
-- The column has a default of 'PENDING' which prevents direct enum cast;
-- drop the default, change the type, then re-add the default. AwlReviewDecision
-- is unused after this so we drop it.

BEGIN;

ALTER TABLE "reviews" ALTER COLUMN "decision" DROP DEFAULT;
ALTER TABLE "reviews"
  ALTER COLUMN "decision" TYPE "ReviewDecision"
  USING "decision"::text::"ReviewDecision";
ALTER TABLE "reviews" ALTER COLUMN "decision" SET DEFAULT 'PENDING';

DROP TYPE IF EXISTS "AwlReviewDecision";

COMMIT;