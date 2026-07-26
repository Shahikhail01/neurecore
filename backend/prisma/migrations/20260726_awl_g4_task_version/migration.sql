-- Migration: 20260726_awl_g4_task_version
-- Purpose: Phase 4 (Task-to-AI Assignment)
--   - Add Task.version for optimistic concurrency on assignment,
--     release, and reassignment transactions.
--   - Add TaskAssignmentOverrideAudit table for manual override
--     attribution (reviewer identity, rationale, generation, etc.).
--
-- Plan references: AI-IMPLEMENTATION-PLAN-v2.md §6.2
--   "Use optimistic concurrency or row locking to prevent two
--    workers from consuming the same capacity."

ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "task_assignment_override_audits" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "assignmentGeneration" INTEGER NOT NULL,
  "previousAgentId" TEXT,
  "rationale" TEXT NOT NULL,
  "overrideByActorId" TEXT NOT NULL,
  "overrideByActorType" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_assignment_override_audits_tenantId_fk"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "task_assignment_override_audits_tenant_task_idx"
  ON "task_assignment_override_audits" ("tenantId", "taskId", "overrideByActorId");

-- Backfill version for any tasks already present. The default of 1 above
-- covers the common case; this is defensive in case the schema is
-- re-applied after the column was added during a hot-resync.
UPDATE "tasks" SET "version" = 1 WHERE "version" IS NULL;
