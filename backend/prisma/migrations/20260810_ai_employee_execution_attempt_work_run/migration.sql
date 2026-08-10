-- Thin AI Employee Core — Phase 8.4
-- Additive only: links an ExecutionAttempt to the canonical Employee WorkRun
-- that performed its business execution. workRunId is nullable so existing
-- attempt rows remain valid. No table/column drops, no destructive casts.

ALTER TABLE "execution_attempts"
  ADD COLUMN "workRunId" TEXT;

CREATE INDEX "execution_attempts_tenantId_workRunId_idx"
  ON "execution_attempts"("tenantId", "workRunId");

-- Rollback policy:
-- Prefer code rollback while retaining this harmless nullable column.
-- If physical rollback is required after proving no new rows depend on it:
--   DROP INDEX "execution_attempts_tenantId_workRunId_idx";
--   ALTER TABLE "execution_attempts" DROP COLUMN "workRunId";
