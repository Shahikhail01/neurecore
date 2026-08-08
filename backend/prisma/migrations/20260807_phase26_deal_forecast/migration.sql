-- Migration: 20260807_phase26_deal_forecast
--
-- Phase 26 of neurecore/memory-bank-arc/harness/IMPLEMENTATION-PLAN-PARITY-COMPLETION.md
-- CR-AI-0703 — Forecast with interval + backtesting on a real Deal model.
--
-- Adds the deal_pipeline_snapshots table that backs the weighted
-- pipeline forecast + backtest harness. The table is immutable —
-- one row per (tenant, period) — and feeds the intervalHalfWidth
-- computation in ForecastProvider.
--
-- The migration is additive — no existing tables altered.

BEGIN;

CREATE TABLE IF NOT EXISTS "deal_pipeline_snapshots" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "period" text NOT NULL,
  "weightedTotal" numeric(18, 2) NOT NULL,
  "openCount" integer NOT NULL DEFAULT 0,
  "byStageJson" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "deal_pipeline_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "deal_pipeline_snapshots_tenantId_period_key"
  ON "deal_pipeline_snapshots"("tenantId","period");
CREATE INDEX IF NOT EXISTS "deal_pipeline_snapshots_tenantId_createdAt_idx"
  ON "deal_pipeline_snapshots"("tenantId","createdAt" DESC);

COMMIT;
