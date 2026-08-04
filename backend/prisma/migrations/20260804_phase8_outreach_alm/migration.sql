-- Phase 8 migration: Sales outreach orchestrator + ALM environments + mobile omnichannel sessions

CREATE TYPE "ApprovalPolicyKind" AS ENUM ('ALL_STEPS_AUTO', 'STEPS_ABOVE_TIER_3_REQUIRE_APPROVAL', 'ALL_STEPS_REQUIRE_APPROVAL');

CREATE TABLE "approval_policies" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "kind" "ApprovalPolicyKind" NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_policies_tenantId_kind_key" UNIQUE ("tenantId", "kind")
);

CREATE TABLE "sales_outreach_runs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "stepIndex" INTEGER NOT NULL,
  "channelKind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "actionName" TEXT,
  "providerId" TEXT,
  "nextStepAt" TIMESTAMP(3),
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "errorMessage" TEXT
);
CREATE INDEX "sales_outreach_runs_tenantId_campaignId_idx" ON "sales_outreach_runs"("tenantId", "campaignId");
CREATE INDEX "sales_outreach_runs_tenantId_contactId_scheduledFor_idx" ON "sales_outreach_runs"("tenantId", "contactId", "scheduledFor");
CREATE INDEX "sales_outreach_runs_tenantId_status_idx" ON "sales_outreach_runs"("tenantId", "status");

CREATE TABLE "studio_environment_configs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "environmentId" TEXT NOT NULL,
  "pipelineId" TEXT,
  "destructiveAllowed" BOOLEAN NOT NULL DEFAULT false,
  "productionAllowed" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_environment_configs_tenantId_environmentId_key" UNIQUE ("tenantId", "environmentId")
);
CREATE INDEX "studio_environment_configs_tenantId_environmentId_idx" ON "studio_environment_configs"("tenantId", "environmentId");

CREATE TABLE "mobile_omnichannel_sessions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "mobile_omnichannel_sessions_connectionId_key" UNIQUE ("connectionId")
);
CREATE INDEX "mobile_omnichannel_sessions_tenantId_userId_idx" ON "mobile_omnichannel_sessions"("tenantId", "userId");
CREATE INDEX "mobile_omnichannel_sessions_tenantId_lastActiveAt_idx" ON "mobile_omnichannel_sessions"("tenantId", "lastActiveAt");
