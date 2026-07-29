-- ═══════════════════════════════════════════════════════════════════════════
-- 20260728_task_status_enum_extension — Align DB enum with Prisma schema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The Prisma schema (schema.prisma:61) declares TaskStatus with 15 values:
--   DRAFT, READY, PENDING, ASSIGNED, QUEUED, RUNNING, IN_PROGRESS,
--   NEEDS_INPUT, NEEDS_REVIEW, APPROVED, COMPLETED, BLOCKED, FAILED,
--   FAILED_RETRYABLE, FAILED_FINAL, CANCELLED
--
-- But the live DB only has 6 values:
--   PENDING, QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
--
-- The Orchestrator's submit-for-review attempts task.update({status: 'NEEDS_REVIEW'})
-- which the DB rejects with code 22P02 (invalid enum value), and the catch
-- falls through to task.update({status: 'NEEDS_INPUT'}). Every autonomous
-- execution therefore lands in NEEDS_INPUT instead of NEEDS_REVIEW, the
-- human review inbox never populates, and the AI take-over chain appears
-- "broken" even though the application code is correct.
--
-- This migration brings the DB enum in sync with the Prisma schema. New
-- values are appended in the canonical order so any existing rows
-- (PENDING/QUEUED/RUNNING/COMPLETED/FAILED/CANCELLED) keep their ordinal
-- positions intact.
--
-- Idempotent: ALTER TYPE ... ADD VALUE IF NOT EXISTS is no-op on repeat.
-- Safe: adding enum values does not require a table rewrite in PG ≥ 9.1.

ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'DRAFT'             BEFORE 'PENDING';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'READY'             BEFORE 'PENDING';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED'          AFTER 'QUEUED';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS'      AFTER 'RUNNING';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'NEEDS_INPUT'       AFTER 'IN_PROGRESS';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW'      AFTER 'NEEDS_INPUT';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'APPROVED'          AFTER 'NEEDS_REVIEW';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'BLOCKED'           AFTER 'APPROVED';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'FAILED_RETRYABLE'  AFTER 'FAILED';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'FAILED_FINAL'      AFTER 'FAILED_RETRYABLE';