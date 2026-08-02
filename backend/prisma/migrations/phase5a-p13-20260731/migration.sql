-- ─── phase5a-p13 DepartmentTemplate.category enum migration ─────────────
--
-- PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.7.1 (Phase 5.A P13) +
--                      §7.9 Tier B prerequisites.
--
-- Goal: convert DepartmentTemplate.category from free-text String to a
-- controlled enum aligned with the 5 kept Industry Groups. Any existing
-- value not in the enum is mapped to a fallback ('other') so the migration
-- is safe to run on the live DB without losing rows.
--
-- ENUM values mirror the 5 ACTIVE_INDUSTRY_GROUPS from
-- backend/src/modules/industry/tier-industry-matrix.ts:
--   financial-compliance, business-technology, consumer-commerce,
--   public-social, other
--
-- Existing values in the 3 CUT groups (healthcare, industrial-infrastructure,
-- agriculture-food) collapse to 'other' — those rows remain grandfathered
-- but are no longer selectable in the picker per proposal §4.
--
-- Safe rollback: see migration_rollback.sql at the end of this file.

BEGIN;

-- 1. Add the enum type if it doesn't exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department_template_category') THEN
    CREATE TYPE department_template_category AS ENUM (
      'financial-compliance',
      'business-technology',
      'consumer-commerce',
      'public-social',
      'other'
    );
  END IF;
END$$;

-- 2. Add a temporary column to hold the enum value, with mapping for old values.
ALTER TABLE department_templates
  ADD COLUMN IF NOT EXISTS category_enum department_template_category;

UPDATE department_templates
SET category_enum = CASE
  WHEN category IN ('financial-compliance', 'business-technology', 'consumer-commerce', 'public-social', 'other')
    THEN category::department_template_category
  WHEN category IN ('healthcare', 'industrial-infrastructure', 'agriculture-food')
    THEN 'other'::department_template_category
  WHEN category IN ('startup', 'enterprise', 'ecommerce', 'healthcare_clinic', 'nonprofit', 'general')
    THEN 'other'::department_template_category
  ELSE 'other'::department_template_category
END
WHERE category_enum IS NULL;

-- 3. Verify all rows have a non-null category_enum before we drop the old column.
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM department_templates WHERE category_enum IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot drop category column: % rows still have NULL category_enum', null_count;
  END IF;
END$$;

-- 4. Drop the old free-text column and rename the new one.
ALTER TABLE department_templates DROP COLUMN category;
ALTER TABLE department_templates RENAME COLUMN category_enum TO category;
ALTER TABLE department_templates ALTER COLUMN category SET NOT NULL;

-- 5. Add index on the new enum column for filter performance.
CREATE INDEX IF NOT EXISTS idx_department_templates_category ON department_templates (category);

-- 6. Update NestJS Prisma client (handled by `prisma generate` in next deploy).

COMMIT;

-- ─── Rollback ────────────────────────────────────────────────────────────
-- To rollback this migration:
--   BEGIN;
--   ALTER TABLE department_templates ADD COLUMN category_old TEXT;
--   UPDATE department_templates SET category_old = category::text;
--   ALTER TABLE department_templates DROP COLUMN category;
--   ALTER TABLE department_templates RENAME COLUMN category_old TO category;
--   DROP TYPE department_template_category;
--   COMMIT;