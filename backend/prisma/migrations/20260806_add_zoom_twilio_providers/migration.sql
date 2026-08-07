-- Migration: 20260806_add_zoom_twilio_providers
-- R4 of neurecore/memory-bank-arc/harness/IMPLEMENTATION-PLAN-BACKLOG-R1-R4.md
--
-- Adds ZOOM and TWILIO to the IntegrationProvider enum. Postgres 16
-- disallows ALTER TYPE ... ADD VALUE inside a transaction block, so this
-- migration is marked non-transactional via prisma's `--create-only`
-- + manual `migration.sql`.
--
-- Forward-only by design (Postgres cannot DROP VALUES from enums).
-- The application falls back to "provider not configured" if the
-- enum value is missing on rollback — handled by the auth-client
-- runtime checks (`requireConfig` throws NOT_CONNECTED).

ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'ZOOM';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'TWILIO';
