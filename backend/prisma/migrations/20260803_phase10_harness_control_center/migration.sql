CREATE TYPE "HarnessRunEnvironment" AS ENUM ('LOCAL', 'CI', 'STAGING', 'PRODUCTION_PROBE', 'PRODUCTION');
CREATE TYPE "HarnessRunState" AS ENUM ('REQUESTED', 'APPROVED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED');
CREATE TYPE "HarnessChangeKind" AS ENUM ('SCENARIO', 'PROMPT', 'RUBRIC', 'DATASET', 'POLICY');
CREATE TYPE "HarnessChangeState" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DEPRECATED');
CREATE TYPE "HarnessWaiverState" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'EXPIRED', 'REVOKED');
CREATE TYPE "HarnessCertificateState" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

CREATE TABLE "harness_run_policies" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "environment" "HarnessRunEnvironment" NOT NULL,
  "destructiveAllowed" BOOLEAN NOT NULL DEFAULT false,
  "productionAllowed" BOOLEAN NOT NULL DEFAULT false,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "maxBudgetUsd" DECIMAL(12,2) NOT NULL,
  "maxConcurrency" INTEGER NOT NULL DEFAULT 1,
  "allowedCapabilityIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "deprecatedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "harness_runs" (
  "id" TEXT PRIMARY KEY,
  "capabilityId" TEXT NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "tenantId" TEXT,
  "environment" "HarnessRunEnvironment" NOT NULL,
  "state" "HarnessRunState" NOT NULL DEFAULT 'REQUESTED',
  "runPolicyId" TEXT NOT NULL REFERENCES "harness_run_policies"("id") RESTRICT,
  "requestedBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "replayOfRunId" TEXT,
  "destructive" BOOLEAN NOT NULL DEFAULT false,
  "budgetUsd" DECIMAL(12,2) NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "outcome" TEXT,
  "checksum" TEXT,
  "provenance" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "harness_evidence" (
  "id" TEXT PRIMARY KEY,
  "runId" TEXT NOT NULL REFERENCES "harness_runs"("id") RESTRICT,
  "tenantId" TEXT,
  "mediaType" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "storageRef" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "previousHash" TEXT,
  "redacted" BOOLEAN NOT NULL DEFAULT true,
  "retentionClass" TEXT NOT NULL,
  "provenance" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "harness_change_versions" (
  "id" TEXT PRIMARY KEY,
  "kind" "HarnessChangeKind" NOT NULL,
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "state" "HarnessChangeState" NOT NULL DEFAULT 'DRAFT',
  "ownerId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "deprecatedAt" TIMESTAMP(3),
  "reviewDate" TIMESTAMP(3) NOT NULL,
  "content" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "rollbackData" JSONB,
  "evaluationRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("kind", "key", "version")
);

CREATE TABLE "harness_waivers" (
  "id" TEXT PRIMARY KEY,
  "capabilityId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "compensatingControl" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "issueLink" TEXT NOT NULL,
  "state" "HarnessWaiverState" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "revokeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "harness_certificates" (
  "id" TEXT PRIMARY KEY,
  "capabilityId" TEXT NOT NULL,
  "environment" "HarnessRunEnvironment" NOT NULL,
  "state" "HarnessCertificateState" NOT NULL DEFAULT 'ACTIVE',
  "verdict" TEXT NOT NULL,
  "evidenceHash" TEXT NOT NULL,
  "limitations" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "issuedBy" TEXT NOT NULL,
  "reviewedBy" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "revokeReason" TEXT
);

CREATE TABLE "harness_audit_events" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "tenantId" TEXT,
  "result" TEXT NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}',
  "previousHash" TEXT,
  "eventHash" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "harness_run_policies_environment_deprecatedAt_idx" ON "harness_run_policies"("environment", "deprecatedAt");
CREATE INDEX "harness_runs_capabilityId_createdAt_idx" ON "harness_runs"("capabilityId", "createdAt");
CREATE INDEX "harness_runs_tenantId_createdAt_idx" ON "harness_runs"("tenantId", "createdAt");
CREATE INDEX "harness_runs_state_environment_idx" ON "harness_runs"("state", "environment");
CREATE INDEX "harness_evidence_runId_createdAt_idx" ON "harness_evidence"("runId", "createdAt");
CREATE INDEX "harness_evidence_tenantId_idx" ON "harness_evidence"("tenantId");
CREATE INDEX "harness_change_versions_kind_state_idx" ON "harness_change_versions"("kind", "state");
CREATE INDEX "harness_waivers_capabilityId_state_idx" ON "harness_waivers"("capabilityId", "state");
CREATE INDEX "harness_waivers_expiresAt_idx" ON "harness_waivers"("expiresAt");
CREATE INDEX "harness_certificates_capabilityId_environment_state_idx" ON "harness_certificates"("capabilityId", "environment", "state");
CREATE INDEX "harness_audit_events_resourceType_resourceId_createdAt_idx" ON "harness_audit_events"("resourceType", "resourceId", "createdAt");
CREATE INDEX "harness_audit_events_actorId_createdAt_idx" ON "harness_audit_events"("actorId", "createdAt");
CREATE INDEX "harness_audit_events_tenantId_idx" ON "harness_audit_events"("tenantId");

CREATE OR REPLACE FUNCTION reject_harness_immutable_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'immutable harness record cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER harness_evidence_immutable BEFORE UPDATE OR DELETE ON "harness_evidence" FOR EACH ROW EXECUTE FUNCTION reject_harness_immutable_mutation();
CREATE TRIGGER harness_audit_immutable BEFORE UPDATE OR DELETE ON "harness_audit_events" FOR EACH ROW EXECUTE FUNCTION reject_harness_immutable_mutation();

CREATE TABLE "harness_replay_bundles" (
  "id" TEXT PRIMARY KEY,
  "sourceRunId" TEXT NOT NULL,
  "environment" "HarnessRunEnvironment" NOT NULL,
  "externalSideEffects" BOOLEAN NOT NULL DEFAULT false,
  "schemaVersion" TEXT NOT NULL,
  "manifest" JSONB NOT NULL,
  "checksum" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "harness_replay_executions" (
  "id" TEXT PRIMARY KEY,
  "bundleId" TEXT NOT NULL REFERENCES "harness_replay_bundles"("id") RESTRICT,
  "actorId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "sideEffectFirewallProof" JSONB NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3)
);

CREATE INDEX "harness_replay_bundles_sourceRunId_idx" ON "harness_replay_bundles"("sourceRunId");
CREATE INDEX "harness_replay_executions_bundleId_startedAt_idx" ON "harness_replay_executions"("bundleId", "startedAt");
