-- Phase 2 migration: Compliance + Governance + DSR
-- Source plan: creatio-ai-parity-implementation-plan-v2.md §5.4, §5.14, §5.18
-- Solid rules:
--   * Governance controls are tenant-scoped; platform-wide predefined
--     controls use NULL tenantId.
--   * DSR workflow is append-only audit-friendly.

CREATE TYPE "GovernanceControlSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "GovernanceControlStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DRAFT');
CREATE TYPE "GovernanceControlOrigin" AS ENUM ('PREDEFINED', 'CUSTOM');
CREATE TYPE "GovernanceControlOutcome" AS ENUM ('PASS', 'FAIL', 'ERROR', 'SKIPPED');

CREATE TABLE "governance_controls" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "GovernanceControlSeverity" NOT NULL,
  "status" "GovernanceControlStatus" NOT NULL,
  "origin" "GovernanceControlOrigin" NOT NULL,
  "domain" TEXT NOT NULL,
  "standards" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "rule" JSONB NOT NULL DEFAULT '{}',
  "cadence" TEXT NOT NULL DEFAULT 'ON_DEMAND',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deprecatedAt" TIMESTAMP(3),
  CONSTRAINT "governance_controls_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);
CREATE INDEX "governance_controls_tenantId_domain_idx" ON "governance_controls"("tenantId", "domain");
CREATE INDEX "governance_controls_tenantId_status_idx" ON "governance_controls"("tenantId", "status");
CREATE INDEX "governance_controls_origin_slug_idx" ON "governance_controls"("origin", "slug");

CREATE TABLE "governance_control_evaluations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "controlId" TEXT NOT NULL REFERENCES "governance_controls"("id") ON DELETE CASCADE,
  "outcome" "GovernanceControlOutcome" NOT NULL,
  "score" INTEGER,
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "ranBy" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "durationMs" INTEGER NOT NULL,
  "notes" TEXT
);
CREATE INDEX "governance_control_evaluations_tenantId_controlId_finishedAt_idx"
  ON "governance_control_evaluations"("tenantId", "controlId", "finishedAt");
CREATE INDEX "governance_control_evaluations_tenantId_finishedAt_idx"
  ON "governance_control_evaluations"("tenantId", "finishedAt");
CREATE INDEX "governance_control_evaluations_controlId_finishedAt_idx"
  ON "governance_control_evaluations"("controlId", "finishedAt");

CREATE TYPE "DsrRequestType" AS ENUM ('EXPORT', 'DELETE', 'RESTRICT', 'RECTIFY', 'PORTABILITY');
CREATE TYPE "DsrRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');

CREATE TABLE "dsr_requests" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "type" "DsrRequestType" NOT NULL,
  "status" "DsrRequestStatus" NOT NULL DEFAULT 'OPEN',
  "subjectId" TEXT NOT NULL,
  "subjectKind" TEXT NOT NULL DEFAULT 'user',
  "requesterId" TEXT NOT NULL,
  "reason" TEXT,
  "resolution" JSONB NOT NULL DEFAULT '{}',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3)
);
CREATE INDEX "dsr_requests_tenantId_status_idx" ON "dsr_requests"("tenantId", "status");
CREATE INDEX "dsr_requests_tenantId_type_idx" ON "dsr_requests"("tenantId", "type");
CREATE INDEX "dsr_requests_tenantId_subjectId_idx" ON "dsr_requests"("tenantId", "subjectId");
CREATE INDEX "dsr_requests_tenantId_openedAt_idx" ON "dsr_requests"("tenantId", "openedAt");

CREATE TYPE "DsrAuditAction" AS ENUM ('OPENED', 'STARTED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EVIDENCE_ATTACHED', 'REMEDIATION_TRIGGERED');

CREATE TABLE "dsr_audit_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "dsrId" TEXT NOT NULL REFERENCES "dsr_requests"("id") ON DELETE CASCADE,
  "actorId" TEXT NOT NULL,
  "action" "DsrAuditAction" NOT NULL,
  "previousState" JSONB NOT NULL DEFAULT '{}',
  "newState" JSONB NOT NULL DEFAULT '{}',
  "reason" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "dsr_audit_logs_tenantId_dsrId_occurredAt_idx"
  ON "dsr_audit_logs"("tenantId", "dsrId", "occurredAt");
CREATE INDEX "dsr_audit_logs_tenantId_occurredAt_idx"
  ON "dsr_audit_logs"("tenantId", "occurredAt");

CREATE TYPE "GovernanceEnvironmentKind" AS ENUM ('PRODUCTION', 'STAGING', 'DEVELOPMENT', 'CI', 'LOCAL');

CREATE TABLE "governance_environments" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "kind" "GovernanceEnvironmentKind" NOT NULL,
  "baseUrl" TEXT,
  "secretRef" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "governance_environments_kind_idx" ON "governance_environments"("kind");
