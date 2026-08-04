-- Phase 6 migration: Studio visual editor + governance runner + DSR SLA + service polish
-- Source plan: creatio-ai-parity-implementation-plan-v2.md §5.13.6/7/8/10/11/14/15/17/18, §5.14.1/4/5, §5.9.5/6/7, §5.10.2, §5.20.4
-- Solid:
--   * Every new table is tenant-scoped or platform-owned (NULL tenantId).
--   * All audit-shaped tables are append-only at the service layer.

CREATE TYPE "StudioPromptTarget" AS ENUM ('APP', 'PAGE', 'PROCESS', 'DATA_MODEL');
CREATE TYPE "StudioPromptKind" AS ENUM ('PromptToApp', 'PromptToPage', 'PromptToProcess', 'PromptToDataModel');
CREATE TYPE "StudioCodegenKind" AS ENUM ('PROMPT_TO_APP', 'PROMPT_TO_PAGE', 'PROMPT_TO_PROCESS', 'PROMPT_TO_DATA_MODEL');
CREATE TYPE "StudioCodegenStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'REJECTED');
CREATE TYPE "ComponentPublishStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'DEPRECATED');
CREATE TYPE "StudioEnvironmentKind" AS ENUM ('PRODUCTION', 'STAGING', 'DEVELOPMENT', 'CI', 'LOCAL');
CREATE TYPE "GovernanceScheduleKind" AS ENUM ('ONE_OFF', 'DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE "LandingPageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "FieldWorkOrderStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "studio_prompt_templates" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "kind" "StudioPromptKind" NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "outputSchema" JSONB NOT NULL DEFAULT '{}',
  "riskTier" INTEGER NOT NULL DEFAULT 2,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_prompt_templates_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);
CREATE INDEX "studio_prompt_templates_kind_idx" ON "studio_prompt_templates"("kind");

CREATE TABLE "studio_codegen_jobs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "appId" TEXT NOT NULL REFERENCES "studio_apps"("id") ON DELETE CASCADE,
  "kind" "StudioCodegenKind" NOT NULL,
  "prompt" TEXT NOT NULL,
  "output" JSONB NOT NULL DEFAULT '{}',
  "validation" JSONB NOT NULL DEFAULT '{}',
  "status" "StudioCodegenStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3)
);
CREATE INDEX "studio_codegen_jobs_tenantId_appId_createdAt_idx" ON "studio_codegen_jobs"("tenantId", "appId", "createdAt");
CREATE INDEX "studio_codegen_jobs_tenantId_status_idx" ON "studio_codegen_jobs"("tenantId", "status");

CREATE TABLE "component_publish_requests" (
  "id" TEXT PRIMARY KEY,
  "componentId" TEXT NOT NULL REFERENCES "studio_components"("id") ON DELETE CASCADE,
  "tenantId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "status" "ComponentPublishStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "notes" TEXT,
  "decisionNotes" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3)
);
CREATE INDEX "component_publish_requests_status_idx" ON "component_publish_requests"("status");
CREATE INDEX "component_publish_requests_tenantId_status_idx" ON "component_publish_requests"("tenantId", "status");

CREATE TABLE "studio_environments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "kind" "StudioEnvironmentKind" NOT NULL,
  "baseUrl" TEXT,
  "secretRef" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_environments_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);
CREATE INDEX "studio_environments_tenantId_kind_idx" ON "studio_environments"("tenantId", "kind");

CREATE TABLE "deployment_pipelines" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "appId" TEXT NOT NULL REFERENCES "studio_apps"("id") ON DELETE CASCADE,
  "environmentId" TEXT NOT NULL REFERENCES "studio_environments"("id") ON DELETE CASCADE,
  "autoDeploy" BOOLEAN NOT NULL DEFAULT false,
  "gates" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deployment_pipelines_appId_environmentId_key" UNIQUE ("appId", "environmentId")
);
CREATE INDEX "deployment_pipelines_tenantId_idx" ON "deployment_pipelines"("tenantId");

CREATE TABLE "scheduled_governance_runs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "controlId" TEXT NOT NULL REFERENCES "governance_controls"("id") ON DELETE CASCADE,
  "kind" "GovernanceScheduleKind" NOT NULL DEFAULT 'ONE_OFF',
  "cron" TEXT,
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "scheduled_governance_runs_enabled_nextRunAt_idx" ON "scheduled_governance_runs"("enabled", "nextRunAt");
CREATE INDEX "scheduled_governance_runs_tenantId_enabled_idx" ON "scheduled_governance_runs"("tenantId", "enabled");

CREATE TABLE "governance_schedule_executions" (
  "id" TEXT PRIMARY KEY,
  "scheduleId" TEXT NOT NULL REFERENCES "scheduled_governance_runs"("id") ON DELETE CASCADE,
  "tenantId" TEXT,
  "controlId" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "score" INTEGER,
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "durationMs" INTEGER NOT NULL,
  "ranBy" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "errorMessage" TEXT
);
CREATE INDEX "governance_schedule_executions_scheduleId_finishedAt_idx" ON "governance_schedule_executions"("scheduleId", "finishedAt");
CREATE INDEX "governance_schedule_executions_controlId_finishedAt_idx" ON "governance_schedule_executions"("controlId", "finishedAt");

CREATE TABLE "sla_events" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "subjectKind" TEXT NOT NULL,
  "policy" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "escalatedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "sla_events_tenantId_status_idx" ON "sla_events"("tenantId", "status");
CREATE INDEX "sla_events_tenantId_dueAt_idx" ON "sla_events"("tenantId", "dueAt");
CREATE INDEX "sla_events_tenantId_subjectKind_subjectId_idx" ON "sla_events"("tenantId", "subjectKind", "subjectId");

CREATE TABLE "landing_pages" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "content" JSONB NOT NULL DEFAULT '{}',
  "status" "LandingPageStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "landing_pages_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);
CREATE INDEX "landing_pages_tenantId_status_idx" ON "landing_pages"("tenantId", "status");

CREATE TABLE "field_work_orders" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "caseId" TEXT,
  "assigneeId" TEXT,
  "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "scheduledFor" TIMESTAMP(3),
  "durationMin" INTEGER,
  "status" "FieldWorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "field_work_orders_tenantId_status_idx" ON "field_work_orders"("tenantId", "status");
CREATE INDEX "field_work_orders_tenantId_assigneeId_idx" ON "field_work_orders"("tenantId", "assigneeId");

CREATE TABLE "root_cause_analyses" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "triggerId" TEXT NOT NULL,
  "cause" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "caseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "remediation" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "root_cause_analyses_tenantId_createdAt_idx" ON "root_cause_analyses"("tenantId", "createdAt");

CREATE TABLE "studio_dashboards" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "layout" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_dashboards_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);
CREATE INDEX "studio_dashboards_tenantId_idx" ON "studio_dashboards"("tenantId");

CREATE TABLE "user_locale_preferences" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "localeId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_locale_preferences_userId_tenantId_key" UNIQUE ("userId", "tenantId")
);
CREATE INDEX "user_locale_preferences_tenantId_idx" ON "user_locale_preferences"("tenantId");
