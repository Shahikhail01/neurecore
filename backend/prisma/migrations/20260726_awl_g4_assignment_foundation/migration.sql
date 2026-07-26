-- Migration: 20260726_awl_g4_assignment_foundation
-- Purpose: Phase 4 (Task-to-AI Assignment)
--   - Add Agent.dataClassification for assignment-level scoping
--   - Add AgentClassification enum
--   - Add AssignmentOverrideAudit table for manual override attribution
--   - Add AssignmentReleaseEvent table to surface release/reassign lifecycle
--
-- Plan references: AI-IMPLEMENTATION-PLAN-v2.md §6.1, §6.5

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AgentClassification') THEN
    CREATE TYPE "AgentClassification" AS ENUM ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');
  END IF;
END $$;

ALTER TABLE "agents"
  ADD COLUMN IF NOT EXISTS "dataClassification" "AgentClassification" NOT NULL DEFAULT 'INTERNAL';

CREATE INDEX IF NOT EXISTS "agents_data_classification_idx"
  ON "agents" ("tenantId", "dataClassification", "availability", "archived");
