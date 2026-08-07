-- Migration: 20260806_add_chat_export_audit_chain
--
-- Phase 15 + 18 of neurecore/memory-bank-arc/harness/IMPLEMENTATION-PLAN-PHASE-15-18.md
--
-- Two additive tables:
--
--   1. chat_exports               (CR-AI-0003 export/delete/redact + audit)
--   2. audit_evidence_chains      (CR-AI-1303 audit + evidence + observability)
--
-- Both are forward-only. Drops require operator approval in a
-- follow-up migration.

BEGIN;

CREATE TABLE IF NOT EXISTS "chat_exports" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "actorId" text NOT NULL,
  "conversationId" text NOT NULL,
  "format" text NOT NULL,
  "redact" boolean NOT NULL DEFAULT false,
  "byteSize" integer NOT NULL DEFAULT 0,
  "storagePath" text NOT NULL DEFAULT '',
  "expiresAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "chat_exports_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "chat_exports_tenantId_conversationId_createdAt_idx"
  ON "chat_exports"("tenantId","conversationId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "chat_exports_expiresAt_idx"
  ON "chat_exports"("expiresAt");

CREATE TABLE IF NOT EXISTS "audit_evidence_chains" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "correlationId" text NOT NULL,
  "actorId" text NOT NULL,
  "skillsJson" jsonb NOT NULL DEFAULT '[]',
  "readsJson" jsonb NOT NULL DEFAULT '[]',
  "writesJson" jsonb NOT NULL DEFAULT '[]',
  "closedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "audit_evidence_chains_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "audit_evidence_chains_tenantId_correlationId_key"
  ON "audit_evidence_chains"("tenantId","correlationId");
CREATE INDEX IF NOT EXISTS "audit_evidence_chains_tenantId_createdAt_idx"
  ON "audit_evidence_chains"("tenantId","createdAt" DESC);

COMMIT;
