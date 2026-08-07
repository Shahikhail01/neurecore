-- Migration: 20260807_add_analytics_model_is_public
--
-- Phase 19 of neurecore/memory-bank-arc/harness/IMPLEMENTATION-PLAN-PHASE-19-21.md
--
-- Adds the `isPublic` boolean column to AnalyticsModel so the model
-- lifecycle (CR-AI-1001) can flag platform-level fallback models.
-- Forward-only by design; drops require operator approval in a follow-up.

BEGIN;

ALTER TABLE "analytics_models"
  ADD COLUMN IF NOT EXISTS "isPublic" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "analytics_models_isPublic_idx"
  ON "analytics_models"("isPublic");

COMMIT;
