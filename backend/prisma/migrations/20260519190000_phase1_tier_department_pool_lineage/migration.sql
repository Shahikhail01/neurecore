-- Phase 1: Add department tier pool and tenant instance lineage fields
-- Additive only migration. No destructive changes.

-- ─── tier_department_pools ────────────────────────────────────────────────

CREATE TABLE "tier_department_pools" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tierId" TEXT NOT NULL,
  "departmentTemplateId" TEXT NOT NULL,
  "slot" INTEGER NOT NULL DEFAULT 1,
  "slotType" TEXT NOT NULL DEFAULT 'CHOICE',
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "isDefaultSelected" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tier_department_pools_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tier_department_pools_tierId_departmentTemplateId_key"
    UNIQUE ("tierId", "departmentTemplateId")
);

ALTER TABLE "tier_department_pools"
  ADD CONSTRAINT "tier_department_pools_tierId_fkey"
  FOREIGN KEY ("tierId") REFERENCES "tiers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tier_department_pools"
  ADD CONSTRAINT "tier_department_pools_departmentTemplateId_fkey"
  FOREIGN KEY ("departmentTemplateId") REFERENCES "department_templates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "tier_department_pools_tierId_idx"
  ON "tier_department_pools"("tierId");

CREATE INDEX "tier_department_pools_departmentTemplateId_idx"
  ON "tier_department_pools"("departmentTemplateId");

-- ─── departments lineage columns ──────────────────────────────────────────

ALTER TABLE "departments"
  ADD COLUMN "templateId" TEXT,
  ADD COLUMN "tierDepartmentPoolId" TEXT,
  ADD COLUMN "deployedFromTierId" TEXT,
  ADD COLUMN "isFixed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isSelected" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "departments"
  ADD CONSTRAINT "departments_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "department_templates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "departments"
  ADD CONSTRAINT "departments_tierDepartmentPoolId_fkey"
  FOREIGN KEY ("tierDepartmentPoolId") REFERENCES "tier_department_pools"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "departments"
  ADD CONSTRAINT "departments_deployedFromTierId_fkey"
  FOREIGN KEY ("deployedFromTierId") REFERENCES "tiers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "departments_templateId_idx" ON "departments"("templateId");
CREATE INDEX "departments_tierDepartmentPoolId_idx" ON "departments"("tierDepartmentPoolId");
CREATE INDEX "departments_deployedFromTierId_idx" ON "departments"("deployedFromTierId");

-- ─── agents lineage columns ───────────────────────────────────────────────

ALTER TABLE "agents"
  ADD COLUMN "deployedFromTierId" TEXT;

ALTER TABLE "agents"
  ADD CONSTRAINT "agents_deployedFromTierId_fkey"
  FOREIGN KEY ("deployedFromTierId") REFERENCES "tiers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "agents_deployedFromTierId_idx" ON "agents"("deployedFromTierId");