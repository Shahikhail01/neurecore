-- Migration: 20260808_phase30_cost_ceiling
--
-- Phase 30 of neurecore/memory-bank-arc/harness/IMPLEMENTATION-PLAN-PARITY-COMPLETION.md
-- CR-AI-1305 — Resilience + per-tenant cost ceiling.
--
-- Adds the tenant_cost_ceilings table that backs CostCeilingService.
-- The ceiling is the HARD stop that denies an LLM call; the existing
-- budget_policies table keeps its soft alert/throttle semantics.
--
-- The migration is additive — no existing table is altered.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CostCeilingDimension') THEN
    CREATE TYPE "CostCeilingDimension" AS ENUM (
      'MONTHLY_SPEND_CENTS',
      'DAILY_SPEND_CENTS',
      'MONTHLY_TOKENS',
      'REQUESTS_PER_MINUTE'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "tenant_cost_ceilings" (
  "id"              text PRIMARY KEY,
  "tenantId"        text NOT NULL,
  "dimension"       "CostCeilingDimension" NOT NULL,
  "limitValue"      integer NOT NULL,
  "enabled"         boolean NOT NULL DEFAULT true,
  "updatedByUserId" text,
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  "updatedAt"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_cost_ceilings_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "tenant_cost_ceilings_limitValue_nonnegative" CHECK ("limitValue" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_cost_ceilings_tenantId_dimension_key"
  ON "tenant_cost_ceilings"("tenantId","dimension");
CREATE INDEX IF NOT EXISTS "tenant_cost_ceilings_tenantId_enabled_idx"
  ON "tenant_cost_ceilings"("tenantId","enabled");

COMMIT;
