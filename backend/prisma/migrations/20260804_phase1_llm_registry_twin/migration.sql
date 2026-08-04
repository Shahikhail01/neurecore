-- Phase 1 migration: LLM Provider Registry + AI Twin
-- Source plan: creatio-ai-parity-implementation-plan-v2.md §5.17.4-5, §5.3
-- Solid rules:
--   * Tenant scoping is mandatory (no wildcard tenant bypass).
--   * Secret references only — never plaintext API keys.
--   * Append-only audit tables for binding changes and twin actions.

CREATE TYPE "LlmProviderStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DRAINING');
CREATE TYPE "LlmProviderKind" AS ENUM (
  'OPENAI_COMPATIBLE',
  'ANTHROPIC',
  'GOOGLE',
  'COHERE',
  'INTERNAL_MOCK'
);

CREATE TABLE "llm_providers" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "kind" "LlmProviderKind" NOT NULL,
  "status" "LlmProviderStatus" NOT NULL DEFAULT 'ACTIVE',
  "baseUrl" TEXT NOT NULL,
  "secretRef" TEXT NOT NULL,
  "orgId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "requestsPerMinuteCap" INTEGER,
  "maxConcurrent" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "llm_providers_status_idx" ON "llm_providers"("status");
CREATE INDEX "llm_providers_kind_idx" ON "llm_providers"("kind");

CREATE TABLE "llm_provider_models" (
  "id" TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES "llm_providers"("id") ON DELETE CASCADE,
  "modelId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "capabilities" JSONB NOT NULL DEFAULT '{}',
  "contextWindow" INTEGER NOT NULL DEFAULT 8192,
  "costInputPer1k" DECIMAL(12, 8),
  "costOutputPer1k" DECIMAL(12, 8),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "llm_provider_models_providerId_modelId_key" UNIQUE ("providerId", "modelId")
);
CREATE INDEX "llm_provider_models_providerId_idx" ON "llm_provider_models"("providerId");

CREATE TABLE "tenant_llm_bindings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "providerId" TEXT NOT NULL REFERENCES "llm_providers"("id") ON DELETE RESTRICT,
  "modelId" TEXT NOT NULL REFERENCES "llm_provider_models"("id") ON DELETE RESTRICT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "status" "LlmProviderStatus" NOT NULL DEFAULT 'ACTIVE',
  "requestsPerMinuteCap" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdByActorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastRotatedAt" TIMESTAMP(3),
  CONSTRAINT "tenant_llm_bindings_tenantId_providerId_modelId_priority_key"
    UNIQUE ("tenantId", "providerId", "modelId", "priority")
);
CREATE INDEX "tenant_llm_bindings_tenantId_status_idx" ON "tenant_llm_bindings"("tenantId", "status");
CREATE INDEX "tenant_llm_bindings_tenantId_priority_idx" ON "tenant_llm_bindings"("tenantId", "priority");
CREATE INDEX "tenant_llm_bindings_providerId_idx" ON "tenant_llm_bindings"("providerId");

CREATE TABLE "llm_binding_audits" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "bindingId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previousHash" TEXT,
  "currentHash" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX "llm_binding_audits_tenantId_bindingId_occurredAt_idx"
  ON "llm_binding_audits"("tenantId", "bindingId", "occurredAt");
CREATE INDEX "llm_binding_audits_tenantId_occurredAt_idx"
  ON "llm_binding_audits"("tenantId", "occurredAt");

CREATE TYPE "TwinLifecycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

CREATE TABLE "ai_twins" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "ownerUserId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "status" "TwinLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  "wizardStep" INTEGER NOT NULL DEFAULT 1,
  "step1Goal" JSONB,
  "step2Iteration" JSONB,
  "step3Test" JSONB,
  "step4Deploy" JSONB,
  "agentTemplateId" TEXT,
  "agentTemplateVersionId" TEXT,
  "allowedReadScopes" JSONB NOT NULL DEFAULT '[]',
  "allowedWriteScopes" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ai_twins_tenantId_ownerUserId_slug_key" UNIQUE ("tenantId", "ownerUserId", "slug")
);
CREATE INDEX "ai_twins_tenantId_ownerUserId_idx" ON "ai_twins"("tenantId", "ownerUserId");
CREATE INDEX "ai_twins_tenantId_status_idx" ON "ai_twins"("tenantId", "status");

CREATE TABLE "ai_twin_audit_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "twinId" TEXT NOT NULL REFERENCES "ai_twins"("id") ON DELETE CASCADE,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "envelope" JSONB NOT NULL DEFAULT '{}',
  "reason" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ai_twin_audit_logs_tenantId_twinId_occurredAt_idx"
  ON "ai_twin_audit_logs"("tenantId", "twinId", "occurredAt");
CREATE INDEX "ai_twin_audit_logs_tenantId_actorUserId_occurredAt_idx"
  ON "ai_twin_audit_logs"("tenantId", "actorUserId", "occurredAt");
CREATE INDEX "ai_twin_audit_logs_tenantId_action_idx"
  ON "ai_twin_audit_logs"("tenantId", "action");
