-- Migration: 20260807_phase23_agent_runtime
-- Phase 23 of neurecore/memory-bank-arc/harness/IMPLEMENTATION-PLAN-PARITY-COMPLETION.md
-- CR-AI-0501..0506 — Real agent runtime execution.
--
-- Adds:
--   - AgentRunStatus enum
--   - agent_runs          (canonical run row)
--   - agent_run_audit     (append-only mirror per state transition)
--   - agent_run_evidence  (one row per skill invoked during the run)
--
-- The migration is additive — no existing tables are altered.

CREATE TYPE "AgentRunStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CLARIFICATION_REQUIRED',
  'APPROVAL_REQUIRED'
);

CREATE TABLE "agent_runs" (
  "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"                 TEXT NOT NULL,
  "agentId"                  TEXT NOT NULL,
  "intent"                   TEXT NOT NULL,
  "status"                   "AgentRunStatus" NOT NULL DEFAULT 'PENDING',
  "actorUserId"              TEXT NOT NULL,
  "conversationId"           TEXT,
  "finalOutput"              TEXT,
  "clarificationPrompt"      TEXT,
  "clarificationSuggestions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "evidence"                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "agent_runs_tenantId_agentId_createdAt_idx"
  ON "agent_runs" ("tenantId", "agentId", "createdAt" DESC);
CREATE INDEX "agent_runs_tenantId_status_idx"
  ON "agent_runs" ("tenantId", "status");
CREATE INDEX "agent_runs_tenantId_conversationId_idx"
  ON "agent_runs" ("tenantId", "conversationId");

CREATE TABLE "agent_run_audit" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId"       UUID NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "agentId"     TEXT NOT NULL,
  "status"      "AgentRunStatus" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "recordedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_run_audit_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE
);

CREATE INDEX "agent_run_audit_tenantId_recordedAt_idx"
  ON "agent_run_audit" ("tenantId", "recordedAt" DESC);
CREATE INDEX "agent_run_audit_runId_idx"
  ON "agent_run_audit" ("runId");

CREATE TABLE "agent_run_evidence" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId"          UUID NOT NULL,
  "skillKey"       TEXT NOT NULL,
  "confidence"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "citationsCount" INTEGER NOT NULL DEFAULT 0,
  "durationMs"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_run_evidence_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE
);

CREATE INDEX "agent_run_evidence_runId_idx"
  ON "agent_run_evidence" ("runId");
