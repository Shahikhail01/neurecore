-- Migration: 20260726_awl_g3_durable_outbox
-- Purpose: Harden EnterpriseEventOutbox with durable-worker semantics
-- required by Phase 3 (Transactional Outbox and Durable Automation).
--
-- Adds:
--   - Lease columns (workerId, leaseExpiresAt) for crash recovery
--   - Retry scheduling (nextAttemptAt, processingCount, processedAt)
--   - Extended status enum (PROCESSING, PROCESSED)
--   - Claim-supporting composite index
--   - Stable event/job column separation between outbox and processor lease
--
-- Plan references: AI-IMPLEMENTATION-PLAN-v2.md §5.1
--   * Transaction-safe claim via row locks or expiring leases
--   * Lease renewal and stale-lease recovery
--   * Exponential backoff with jitter
--   * Dead-letter transition and controlled replay

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'enterprise_event_outbox'
      AND column_name = 'attempt_count'
  ) THEN
    -- Add new columns only when the legacy schema is detected.
    -- For fresh installs that already include these columns, no-ops are required.
    NULL;
  END IF;
END $$;

-- ─── Status enum extension ──────────────────────────────────────────────────
-- Existing live values: PENDING, DISPATCHED, DEAD_LETTER
-- New values:          PROCESSING (claimed but not yet processed),
--                      PROCESSED  (successfully handled)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnterpriseEventOutboxStatus') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'PROCESSING'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EnterpriseEventOutboxStatus')
    ) THEN
      ALTER TYPE "EnterpriseEventOutboxStatus" ADD VALUE 'PROCESSING';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'PROCESSED'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EnterpriseEventOutboxStatus')
    ) THEN
      ALTER TYPE "EnterpriseEventOutboxStatus" ADD VALUE 'PROCESSED';
    END IF;
  END IF;
END $$;

-- ─── Worker lease + retry scheduling ─────────────────────────────────────────
ALTER TABLE "enterprise_event_outbox"
  ADD COLUMN IF NOT EXISTS "processingWorkerId" TEXT,
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processingCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastErrorClassification" TEXT;

-- Backfill nextAttemptAt for any PENDING rows that pre-date this column.
UPDATE "enterprise_event_outbox"
   SET "nextAttemptAt" = "createdAt"
 WHERE "nextAttemptAt" IS NULL;

ALTER TABLE "enterprise_event_outbox"
  ALTER COLUMN "nextAttemptAt" SET NOT NULL,
  ALTER COLUMN "nextAttemptAt" SET DEFAULT CURRENT_TIMESTAMP;

-- ─── Dead-letter uniqueness ─────────────────────────────────────────────────
-- Ensure upsert-by-originalEventId is safe under replay storms.
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

-- ─── Indexes ─────────────────────────────────────────────────────────────────
-- Claim index: next available event, ordered by nextAttemptAt then createdAt.
CREATE INDEX IF NOT EXISTS "enterprise_event_outbox_claim_idx"
  ON "enterprise_event_outbox" ("status", "nextAttemptAt", "createdAt");

-- Stale-lease recovery index.
CREATE INDEX IF NOT EXISTS "enterprise_event_outbox_lease_expiry_idx"
  ON "enterprise_event_outbox" ("leaseExpiresAt")
  WHERE "status" = 'PROCESSING';

-- Per-tenant backlog aggregation.
CREATE INDEX IF NOT EXISTS "enterprise_event_outbox_tenant_status_idx"
  ON "enterprise_event_outbox" ("tenantId", "status");
