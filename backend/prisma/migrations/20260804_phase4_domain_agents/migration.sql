-- Phase 4 migration: Domain Agent Registry
-- Source plan: creatio-ai-parity-implementation-plan-v2.md §5.6, §5.7, §5.8, §5.15
-- Solid:
--   * AgentDefinition is the single canonical owner of OOB agent metadata.
--   * TenantAgentDefinition enables tenant-level overrides without
--     mutating the platform-owned AgentDefinition row.
--   * AgentExecution is append-only; audit trail for every run.

CREATE TYPE "DomainAgentKind" AS ENUM (
  'SALES_ACCOUNT_RESEARCH',
  'SALES_QUOTE_GENERATION',
  'SALES_MEETING_PREPARATION',
  'SALES_MS_TEAMS',
  'SALES_MS_OUTLOOK',
  'SALES_FORECAST',
  'SALES_TERRITORY_MANAGEMENT',
  'SALES_NEXT_BEST_STEP',
  'SALES_ORDER_FULFILLMENT',
  'SALES_CRM_DATA_UPDATE',
  'MARKETING_CONTENT',
  'MARKETING_EMAIL_GENERATION',
  'MARKETING_CAMPAIGN',
  'MARKETING_LEAD_SCORING',
  'MARKETING_LEAD_DISTRIBUTION',
  'SERVICE_CASE_RESOLUTION',
  'SERVICE_KNOWLEDGE_BASE',
  'SERVICE_CASE_CLASSIFICATION',
  'SERVICE_PLAYBOOK',
  'SERVICE_NEXT_BEST_ACTION',
  'WORKFLOW_CONTENT_PREPARATION',
  'WORKFLOW_CONTENT_LOCALIZATION',
  'WORKFLOW_MEETING_MANAGEMENT',
  'WORKFLOW_ACTIVITY_SUMMARY',
  'WORKFLOW_COMMUNICATION_TEMPLATE',
  'UNIVERSAL_GENERIC'
);

CREATE TABLE "agent_definitions" (
  "id" TEXT PRIMARY KEY,
  "kind" "DomainAgentKind" NOT NULL UNIQUE,
  "slug" TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "shortName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "reads" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "writes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "riskTier" INTEGER NOT NULL DEFAULT 2,
  "planSection" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1.0.0',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "agent_definitions_domain_idx" ON "agent_definitions"("domain");
CREATE INDEX "agent_definitions_enabled_idx" ON "agent_definitions"("enabled");

CREATE TABLE "tenant_agent_definitions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "agentDefinitionId" TEXT NOT NULL REFERENCES "agent_definitions"("id") ON DELETE CASCADE,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "riskTierOverride" INTEGER,
  "departmentId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_agent_definitions_tenantId_agentDefinitionId_key" UNIQUE ("tenantId", "agentDefinitionId")
);
CREATE INDEX "tenant_agent_definitions_tenantId_enabled_idx" ON "tenant_agent_definitions"("tenantId", "enabled");

CREATE TABLE "agent_executions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "agentDefinitionId" TEXT NOT NULL REFERENCES "agent_definitions"("id") ON DELETE RESTRICT,
  "actorId" TEXT NOT NULL,
  "actorKind" TEXT NOT NULL DEFAULT 'user',
  "triggerSource" TEXT NOT NULL DEFAULT 'manual',
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "inputs" JSONB NOT NULL DEFAULT '{}',
  "outputs" JSONB NOT NULL DEFAULT '{}',
  "decisionTrace" JSONB NOT NULL DEFAULT '{}',
  "errorMessage" TEXT,
  "durationMs" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3)
);
CREATE INDEX "agent_executions_tenantId_agentDefinitionId_startedAt_idx" ON "agent_executions"("tenantId", "agentDefinitionId", "startedAt");
CREATE INDEX "agent_executions_tenantId_status_idx" ON "agent_executions"("tenantId", "status");
CREATE INDEX "agent_executions_tenantId_startedAt_idx" ON "agent_executions"("tenantId", "startedAt");
