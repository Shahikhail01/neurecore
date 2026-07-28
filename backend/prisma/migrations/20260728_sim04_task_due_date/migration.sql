-- ═══════════════════════════════════════════════════════════════════════════
-- 20260728_sim04_task_due_date — SIM-04 G-03 calendar/due-date surface
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The calendar endpoint (/calendar/tasks) needs a per-task due date.
-- `scheduledAt` exists on the model but is reserved for the orchestrator's
-- scheduling logic, and `targetDate` lives on Project/Stage/Goal, not on
-- the leaf task. Adding `dueDate` (and an explicit `dueOverride` for the
-- edge case where an operator wants to push a single task to a different
-- date without editing its underlying schedule) gives the calendar a
-- clean per-task date signal.
--
-- Both columns are nullable so existing rows are unaffected. No index is
-- added here because the calendar endpoint will filter by tenantId +
-- dueDate range; the existing tenantId index covers the leftmost key
-- and the dueDate range scan is small (calendar windows are bounded).
-- If usage grows we can add a composite (tenantId, dueDate) later.

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "dueOverride" TIMESTAMP(3);
