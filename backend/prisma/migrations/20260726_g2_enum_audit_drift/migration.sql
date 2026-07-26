-- Migration: 20260726_g2_enum_audit_drift
-- Purpose: Reconcile live AWL schema drift discovered during G2 verification.
--
-- The Prisma client generated from schema.prisma currently binds AWL-specific
-- enum type names. The first AWL migration created the database enums without
-- those prefixes. Rename the deployed enum types in place so existing columns
-- continue to reference the renamed type and Prisma writes no longer fail.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExecutionEngine')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AwlExecutionEngine') THEN
    ALTER TYPE "ExecutionEngine" RENAME TO "AwlExecutionEngine";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewStatus')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AwlReviewStatus') THEN
    ALTER TYPE "ReviewStatus" RENAME TO "AwlReviewStatus";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AgentAvailability')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AwlAgentAvailability') THEN
    ALTER TYPE "AgentAvailability" RENAME TO "AwlAgentAvailability";
  END IF;
END $$;

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "correlationId" TEXT,
  ADD COLUMN IF NOT EXISTS "causationId" TEXT;

CREATE INDEX IF NOT EXISTS "audit_logs_correlationId_idx" ON "audit_logs"("correlationId");
