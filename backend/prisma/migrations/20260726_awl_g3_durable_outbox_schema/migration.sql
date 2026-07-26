-- Migration: 20260726_awl_g3_durable_outbox_schema
-- Purpose: Phase 3 (Transactional Outbox and Durable Automation)
-- Add lease + backoff columns to the outbox, dead-letter uniqueness,
-- and the claim indexes that the durable worker relies on.
--
-- Plan references: AI-IMPLEMENTATION-PLAN-v2.md §5.1
--   * Transaction-safe claim via row locks or expiring leases
--   * Lease renewal and stale-lease recovery
--   * Exponential backoff with jitter
--   * Dead-letter transition and controlled replay
--
-- The companion migration 20260726_awl_g3_durable_outbox_enum extends
-- EnterpriseEventOutboxStatus; this migration must run AFTER that
-- migration has been committed so the new enum values are usable.

ALTER TABLE "enterprise_event_outbox"
  ADD COLUMN IF NOT EXISTS "processingWorkerId" TEXT,
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processingCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastErrorClassification" TEXT;

UPDATE "enterprise_event_outbox"
   SET "nextAttemptAt" = "createdAt"
 WHERE "nextAttemptAt" IS NULL;

ALTER TABLE "enterprise_event_outbox"
  ALTER COLUMN "nextAttemptAt" SET NOT NULL,
  ALTER COLUMN "nextAttemptAt" SET DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'enterprise_event_dead_letter_originalEventId_key'
  ) THEN
    ALTER TABLE "enterprise_event_dead_letter"
      ADD CONSTRAINT "enterprise_event_dead_letter_originalEventId_key"
      UNIQUE ("originalEventId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "enterprise_event_outbox_claim_idx"
  ON "enterprise_event_outbox" ("status", "nextAttemptAt", "createdAt");

CREATE INDEX IF NOT EXISTS "enterprise_event_outbox_lease_expiry_idx"
  ON "enterprise_event_outbox" ("leaseExpiresAt")
  WHERE "status" = 'PROCESSING';

CREATE INDEX IF NOT EXISTS "enterprise_event_outbox_tenant_status_idx"
  ON "enterprise_event_outbox" ("tenantId", "status");
