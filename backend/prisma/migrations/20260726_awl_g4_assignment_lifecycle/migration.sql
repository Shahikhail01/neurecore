-- Migration: 20260726_awl_g4_assignment_lifecycle
-- Purpose: Phase 4 (Task-to-AI Assignment)
--   - Add TaskAssignment.releasedAt/releasedByActorId/releaseReason
--     for the release/reassign lifecycle (plan §6.2).
--   - Add TaskAssignment.expiresAt for assignment-time-bounded work
--     (matches the plan's "Define ... assignment expiry, release,
--     reassignment" requirement).
--   - Add sweep index used by AssignmentService.releaseExpired().

ALTER TABLE "task_assignments"
  ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "releasedByActorId" TEXT,
  ADD COLUMN IF NOT EXISTS "releaseReason" TEXT,
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "task_assignments_release_sweep_idx"
  ON "task_assignments" ("status", "expiresAt");
