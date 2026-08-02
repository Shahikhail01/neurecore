-- ─── phase5b-t8 Package.parentPackageId migration ─────────────────────────
--
-- PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.8.1 (Phase 5.B T8) +
--                      P4 cross-group Package FK.
--
-- Goal: allow a Package to reference a parent Package (typically from a
-- different industry group). Used by Special-Purpose Organizations to
-- inherit F&C `accounting-operations` agents/departments.
--
-- Safe: column is NULLABLE + FK ON DELETE SET NULL. No existing row is
-- affected. The resolver change lives in the NestJS service (Phase 5.B).
--
-- Safe rollback: see migration_rollback.sql at the end.

BEGIN;

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS "parentPackageId" TEXT;

-- Note: Postgres cannot add a self-referencing FK in the same ALTER without
-- deferred constraint. We do it in two steps:
--   1. Add column (nullable, no FK yet).
--   2. Add FK with ON DELETE SET NULL.

ALTER TABLE packages
  DROP CONSTRAINT IF EXISTS packages_parentPackageId_fkey;

ALTER TABLE packages
  ADD CONSTRAINT packages_parentPackageId_fkey
  FOREIGN KEY ("parentPackageId") REFERENCES packages(id) ON DELETE SET NULL;

-- Index for fast parent lookups during onboarding resolver.
CREATE INDEX IF NOT EXISTS idx_packages_parent_package_id
  ON packages ("parentPackageId");

COMMIT;

-- ─── Rollback ────────────────────────────────────────────────────────────
-- BEGIN;
--   ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_parentPackageId_fkey;
--   DROP INDEX IF EXISTS idx_packages_parent_package_id;
--   ALTER TABLE packages DROP COLUMN IF EXISTS "parentPackageId";
-- COMMIT;