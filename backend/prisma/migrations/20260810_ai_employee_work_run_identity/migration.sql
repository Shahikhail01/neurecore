-- Thin AI Employee Core — Phase 2
-- Additive only: existing WorkRun rows remain valid because identity and
-- idempotency columns are nullable. triggerType has a backward-safe default.

ALTER TABLE "work_runs"
  ADD COLUMN "employeeId" TEXT,
  ADD COLUMN "requestedByActorId" TEXT,
  ADD COLUMN "taskId" TEXT,
  ADD COLUMN "triggerType" TEXT NOT NULL DEFAULT 'USER',
  ADD COLUMN "triggerSourceId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "parentRunId" TEXT;

CREATE UNIQUE INDEX "work_runs_tenantId_idempotencyKey_key"
  ON "work_runs"("tenantId", "idempotencyKey");

CREATE INDEX "work_runs_tenantId_employeeId_createdAt_idx"
  ON "work_runs"("tenantId", "employeeId", "createdAt" DESC);

CREATE INDEX "work_runs_tenantId_taskId_idx"
  ON "work_runs"("tenantId", "taskId");

ALTER TABLE "work_runs"
  ADD CONSTRAINT "work_runs_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Agent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Rollback policy:
-- Prefer code rollback while retaining these harmless nullable columns.
-- If physical rollback is required after proving no new rows depend on them:
--   ALTER TABLE "work_runs" DROP CONSTRAINT "work_runs_employeeId_fkey";
--   DROP INDEX "work_runs_tenantId_taskId_idx";
--   DROP INDEX "work_runs_tenantId_employeeId_createdAt_idx";
--   DROP INDEX "work_runs_tenantId_idempotencyKey_key";
--   ALTER TABLE "work_runs" DROP COLUMN "parentRunId", DROP COLUMN
--     "idempotencyKey", DROP COLUMN "triggerSourceId", DROP COLUMN
--     "triggerType", DROP COLUMN "taskId", DROP COLUMN
--     "requestedByActorId", DROP COLUMN "employeeId";
