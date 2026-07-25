-- 20260724_project_type_slug/migration.sql
-- Phase 9 remediation (industry verification round 2): PROJTYPE-001.
-- Adds a stable slug column to ProjectType so the tier-industry matrix
-- can match project types to industry anchor slugs
-- (audit-engagement, tax-filing, bookkeeping-cycle, payroll-cycle,
-- compliance-review). The display `name` remains user-facing.
ALTER TABLE "project_types"
  ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Backfill slugs for existing system rows by deriving a kebab-case
-- identifier from the name. Tenant-cloned rows keep the same slug as
-- the system template they were cloned from (best-effort; re-running
-- the seed will canonicalise them).
UPDATE "project_types"
SET "slug" = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE "slug" IS NULL;

-- Strip trailing/leading dashes produced by regex_replace.
UPDATE "project_types"
SET "slug" = trim(both '-' from "slug")
WHERE "slug" IS NOT NULL;

-- Replace empty slugs (pure punctuation names) with a deterministic
-- surrogate so the unique index can be created safely.
UPDATE "project_types"
SET "slug" = 'project-type-' || "id"
WHERE "slug" IS NULL OR "slug" = '';

-- Partial unique index: a slug only needs to be unique within a tenant
-- (system rows have tenantId = NULL; per-tenant clones can collide
-- across tenants without conflict).
CREATE UNIQUE INDEX IF NOT EXISTS "project_types_tenantId_slug_key"
  ON "project_types" ("tenantId", "slug");