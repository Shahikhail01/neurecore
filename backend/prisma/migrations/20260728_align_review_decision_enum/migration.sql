-- ═══════════════════════════════════════════════════════════════════════════
-- 20260728_align_review_decision_enum
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fix the schema/DB drift where:
--   reviews.decision → AwlReviewDecision (DB) vs ReviewDecision (Prisma)
-- The Prisma client only knows about ReviewDecision, so any INSERT
-- to reviews fails with `column "decision" is of type AwlReviewDecision
-- but expression is of type ReviewDecision`.
--
-- Strategy:
--   1. Add PENDING + REVISION_REQUESTED + CANCELLED to the Prisma-side
--      ReviewDecision enum so it matches AwlReviewDecision.
--   2. Drop AwlReviewDecision (CASCADE) and re-point reviews.decision at
--      the unified ReviewDecision enum.

-- Step 1: extend the Prisma-side enum. ALTER TYPE … ADD VALUE cannot
-- run in a transaction block, so this is split out at the top.
ALTER TYPE "ReviewDecision" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ReviewDecision" ADD VALUE IF NOT EXISTS 'REVISION_REQUESTED';
ALTER TYPE "ReviewDecision" ADD VALUE IF NOT EXISTS 'CANCELLED';