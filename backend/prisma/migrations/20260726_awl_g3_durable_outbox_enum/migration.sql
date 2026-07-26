-- Migration: 20260726_awl_g3_durable_outbox_enum
-- Purpose: Phase 3 (Transactional Outbox and Durable Automation)
-- Add PROCESSING and PROCESSED values to EnterpriseEventOutboxStatus.
--
-- Postgres requires the new enum value to be COMMITTED before any new
-- statement can use it. Prisma wraps each migration in a transaction,
-- so this migration is intentionally limited to enum extension; the
-- table changes follow in the second migration.

ALTER TYPE "EnterpriseEventOutboxStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "EnterpriseEventOutboxStatus" ADD VALUE IF NOT EXISTS 'PROCESSED';
