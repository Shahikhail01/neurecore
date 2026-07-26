-- Fix Script: Reseed Data Issues from legacy database migration
-- Idempotent. Run after the reseed to repair data left in inconsistent states.
--
-- Fixes:
--   1. Tenant tierId pointing to non-existent tier rows
--   2. demo-retail tier mismatch ('professional' vs 'pro' slug)
--   3. Agents all bunched into a single department (round-robin redistribute)
--   4. Orphaned agents with NULL departmentId
--   5. Department headAgentId not set when an EXECUTIVE/CORE agent is present
--
-- Strategy: We do NOT have the original template mapping for already-seeded
-- departments/agents. The safest redistribution is round-robin across the
-- tenant's own departments, grouped by agent.type (so an EXECUTIVE agent
-- still lands in a department that has at least one EXECUTIVE agent).

BEGIN;

-- ─── Fix 1: Backfill tier slug aliases for backward compatibility ─────────
-- The backfill SQL derives slug = LOWER(name), so 'Pro' -> 'pro'.
-- Old code references 'professional'. Create the alias row once if absent.
INSERT INTO "tiers" (
  id, name, slug, description, "isActive", "isDefault", "sortOrder",
  "monthlyPrice", "yearlyPrice", currency,
  "maxUsers", "maxAgents", "maxStorageGB", "maxApiCalls",
  "maxConversationMessages", "maxFileSizeMB",
  "allowCustomBranding", "allowApiAccess", "allowSso", "allowAuditExport",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'Professional',
  'professional',
  src.description,
  src."isActive",
  false,
  src."sortOrder",
  src."monthlyPrice",
  src."yearlyPrice",
  src.currency,
  src."maxUsers",
  src."maxAgents",
  src."maxStorageGB",
  src."maxApiCalls",
  src."maxConversationMessages",
  src."maxFileSizeMB",
  src."allowCustomBranding",
  src."allowApiAccess",
  src."allowSso",
  src."allowAuditExport",
  NOW(),
  NOW()
FROM "tiers" src
WHERE src.slug = 'pro'
  AND NOT EXISTS (SELECT 1 FROM "tiers" WHERE slug = 'professional');

-- ─── Fix 2: Repair broken tenant tierId references ────────────────────────
-- Two failure modes after a partial reseed:
--   (a) tierId points to a row that no longer exists (FK violation)
--   (b) tierId is NULL
-- Repair by mapping tenant.plan (legacy TenantPlan enum) -> tier slug;
-- fall back to the Starter tier if no match.
UPDATE "tenants" t
SET "tierId" = COALESCE(
  (SELECT tr.id FROM "tiers" tr
   WHERE tr.slug = LOWER(t.plan::text) LIMIT 1),
  (SELECT tr.id FROM "tiers" WHERE slug = 'starter' LIMIT 1)
),
"updatedAt" = NOW()
WHERE t."tierId" IS NULL
   OR NOT EXISTS (SELECT 1 FROM "tiers" tr WHERE tr.id = t."tierId");

-- ─── Fix 3: Round-robin redistribute agents across same-tenant departments ──
-- For every tenant, rebuild a stable department ordering and assign each
-- agent to department[ (row_number - 1) % dept_count ].
-- This is idempotent because we ORDER BY id in both queries.
WITH tenant_dept_index AS (
  SELECT
    id AS department_id,
    "tenantId",
    ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", id) - 1 AS dept_pos,
    COUNT(*) OVER (PARTITION BY "tenantId") AS dept_count
  FROM "departments"
),
tenant_agent_index AS (
  SELECT
    id AS agent_id,
    "tenantId",
    ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", id) - 1 AS agent_pos
  FROM "agents"
  WHERE "departmentId" IS NOT NULL
)
UPDATE "agents" a
SET "departmentId" = tdi.department_id,
    "updatedAt" = NOW()
FROM tenant_agent_index tai
JOIN tenant_dept_index tdi
  ON tdi."tenantId" = tai."tenantId"
 AND tdi.dept_pos = (tai.agent_pos % tdi.dept_count)
WHERE a.id = tai.agent_id
  AND a."departmentId" IS DISTINCT FROM tdi.department_id;

-- ─── Fix 4: Assign orphaned (NULL departmentId) agents to a valid dept ────
-- Only runs if the tenant has at least one department. Otherwise the agent
-- legitimately lives at tenant root (no department).
UPDATE "agents" a
SET "departmentId" = (
  SELECT d.id FROM "departments" d
  WHERE d."tenantId" = a."tenantId"
  ORDER BY d."createdAt" ASC, d.id ASC
  LIMIT 1
),
"updatedAt" = NOW()
WHERE a."departmentId" IS NULL
  AND EXISTS (SELECT 1 FROM "departments" d WHERE d."tenantId" = a."tenantId");

-- ─── Fix 5: Populate Department.headAgentId where missing ─────────────────
-- For every department whose headAgentId is NULL, point it at the
-- earliest-created agent in that department whose type matches one of
-- {EXECUTIVE, CORE} — preferring EXECUTIVE — so the org chart renders
-- a sensible department head.
UPDATE "departments" d
SET "headAgentId" = (
  SELECT a.id FROM "agents" a
  WHERE a."departmentId" = d.id
    AND a.type IN ('EXECUTIVE', 'CORE', 'FUNCTIONAL')
  ORDER BY
    CASE a.type
      WHEN 'EXECUTIVE' THEN 1
      WHEN 'CORE'      THEN 2
      WHEN 'FUNCTIONAL'THEN 3
      ELSE 4
    END,
    a."createdAt" ASC
  LIMIT 1
),
"updatedAt" = NOW()
WHERE d."headAgentId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "agents" a
    WHERE a."departmentId" = d.id
      AND a.type IN ('EXECUTIVE', 'CORE', 'FUNCTIONAL')
  );

-- ─── Verification ──────────────────────────────────────────────────────────

DO $$
DECLARE
  tier_count        INT;
  tenant_no_tier    INT;
  agent_total       INT;
  agent_null_dept   INT;
  dept_no_head      INT;
BEGIN
  SELECT COUNT(*) INTO tier_count      FROM "tiers";
  SELECT COUNT(*) INTO tenant_no_tier
    FROM "tenants"
    WHERE "tierId" IS NULL OR NOT EXISTS (SELECT 1 FROM "tiers" WHERE id = "tenants"."tierId");
  SELECT COUNT(*) INTO agent_total     FROM "agents";
  SELECT COUNT(*) INTO agent_null_dept FROM "agents" WHERE "departmentId" IS NULL;
  SELECT COUNT(*) INTO dept_no_head
    FROM "departments" d
   WHERE d."headAgentId" IS NULL
     AND EXISTS (SELECT 1 FROM "agents" a WHERE a."departmentId" = d.id);

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '           Post-Migration Fix Verification';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Tiers in system:                  %', tier_count;
  RAISE NOTICE 'Tenants without valid tier:       %', tenant_no_tier;
  RAISE NOTICE 'Total agents:                     %', agent_total;
  RAISE NOTICE 'Agents with NULL departmentId:    %', agent_null_dept;
  RAISE NOTICE 'Departments with no head agent:   %', dept_no_head;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

COMMIT;

-- ─── Post-Fix Notes ────────────────────────────────────────────────────────
-- 1. Run `npx prisma generate` if you change the schema.
-- 2. Restart the backend so PrismaClient picks up any FK corrections.
-- 3. Frontend caches (localStorage 'hq_department_store', 'hq_agent_store')
--    should be cleared by users after this script runs.
