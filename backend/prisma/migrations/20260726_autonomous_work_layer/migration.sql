-- Migration: 20260726_autonomous_work_layer
-- Purpose: Add missing models and fields required for the autonomous work layer reconstruction
-- Phases: 1-10 of NC-AWL-IMP-1 v1.1

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE "InitiationStatus" AS ENUM (
  'DRAFT', 'DISCOVERING', 'READY_FOR_CONFIRMATION', 'APPROVED',
  'MATERIALIZING', 'COMPLETED', 'NEEDS_INPUT',
  'FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED'
);

CREATE TYPE "ProjectAutomationStatus" AS ENUM (
  'NOT_REQUESTED', 'REQUESTED', 'PROCESSING', 'COMPLETED',
  'PARTIAL', 'FAILED_RETRYABLE', 'FAILED_FINAL'
);

CREATE TYPE "ExecutionAttemptStatus" AS ENUM (
  'CREATED', 'QUEUED', 'RUNNING', 'WAITING_FOR_TOOL',
  'PRODUCING_EVIDENCE', 'SUBMITTED_FOR_REVIEW', 'PAUSED',
  'NEEDS_INPUT', 'TIMED_OUT',
  'FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED'
);

CREATE TYPE "ReviewDecision" AS ENUM (
  'PENDING', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED', 'CANCELLED'
);

CREATE TYPE "ReviewStatus" AS ENUM (
  'PENDING', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED', 'CANCELLED'
);

CREATE TYPE "EvidenceArtifactType" AS ENUM (
  'DRAFT', 'REPORT', 'DOCUMENT', 'DATA', 'OUTPUT'
);

CREATE TYPE "EvidenceSource" AS ENUM (
  'AI_GENERATED', 'HUMAN_PROVIDED', 'SYSTEM_DERIVED'
);

CREATE TYPE "TaskAssignmentStatus" AS ENUM (
  'ACTIVE', 'RELEASED', 'EXPIRED'
);

CREATE TYPE "AgentAvailability" AS ENUM (
  'AVAILABLE', 'BUSY', 'OFFLINE', 'ARCHIVED'
);

CREATE TYPE "ExecutionEngine" AS ENUM (
  'legacy', 'canonical'
);

-- ============================================================================
-- MODELS
-- ============================================================================

-- EnterpriseInitiation
CREATE TABLE "enterprise_initiations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT,
  "status" "InitiationStatus" NOT NULL DEFAULT 'DRAFT',
  "projectName" TEXT NOT NULL,
  "projectDescription" TEXT,
  "targetDate" TIMESTAMP(3),
  "discoveredData" JSONB NOT NULL DEFAULT '{}',
  "approvedByActorId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvalComment" TEXT,
  "projectId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "enterprise_initiations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "enterprise_initiations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL
);

CREATE INDEX "enterprise_initiations_tenantId_idx" ON "enterprise_initiations"("tenantId");
CREATE INDEX "enterprise_initiations_tenantId_status_idx" ON "enterprise_initiations"("tenantId", "status");
CREATE UNIQUE INDEX "enterprise_initiations_tenantId_projectId_key" ON "enterprise_initiations"("tenantId", "projectId");

-- ExecutionAttempt
CREATE TABLE "execution_attempts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "executionRequestId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" "ExecutionAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "policy" JSONB NOT NULL DEFAULT '{}',
  "outputSummary" TEXT,
  "submittedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "lastErrorClassification" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_attempts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "execution_attempts_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE,
  CONSTRAINT "execution_attempts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE
);

CREATE INDEX "execution_attempts_tenantId_idx" ON "execution_attempts"("tenantId");
CREATE INDEX "execution_attempts_taskId_idx" ON "execution_attempts"("taskId");
CREATE INDEX "execution_attempts_agentId_idx" ON "execution_attempts"("agentId");
CREATE INDEX "execution_attempts_status_idx" ON "execution_attempts"("status");
CREATE UNIQUE INDEX "execution_attempts_tenantId_taskId_executionRequestId_key" ON "execution_attempts"("tenantId", "taskId", "executionRequestId");
CREATE UNIQUE INDEX "execution_attempts_taskId_attemptNumber_key" ON "execution_attempts"("taskId", "attemptNumber");

-- Review
CREATE TABLE "reviews" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "decision" "ReviewDecision" NOT NULL DEFAULT 'PENDING',
  "reviewerId" TEXT,
  "comment" TEXT,
  "revisionInstructions" TEXT,
  "decidedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "reviews_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE,
  CONSTRAINT "reviews_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "execution_attempts"("id") ON DELETE CASCADE
);

CREATE INDEX "reviews_tenantId_idx" ON "reviews"("tenantId");
CREATE INDEX "reviews_taskId_idx" ON "reviews"("taskId");
CREATE INDEX "reviews_attemptId_idx" ON "reviews"("attemptId");
CREATE INDEX "reviews_status_idx" ON "reviews"("status");

-- EvidenceArtifact
CREATE TABLE "evidence_artifacts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "executionAttemptId" TEXT NOT NULL,
  "artifactType" "EvidenceArtifactType" NOT NULL,
  "storageRef" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "source" "EvidenceSource" NOT NULL,
  "createdByActorId" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_artifacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "evidence_artifacts_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE,
  CONSTRAINT "evidence_artifacts_executionAttemptId_fkey" FOREIGN KEY ("executionAttemptId") REFERENCES "execution_attempts"("id") ON DELETE CASCADE
);

CREATE INDEX "evidence_artifacts_tenantId_idx" ON "evidence_artifacts"("tenantId");
CREATE INDEX "evidence_artifacts_taskId_idx" ON "evidence_artifacts"("taskId");
CREATE INDEX "evidence_artifacts_executionAttemptId_idx" ON "evidence_artifacts"("executionAttemptId");

-- TaskAssignment
CREATE TABLE "task_assignments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "generation" INTEGER NOT NULL,
  "rationale" TEXT NOT NULL,
  "status" "TaskAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "task_assignments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE,
  CONSTRAINT "task_assignments_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "task_assignments_tenantId_taskId_generation_key" ON "task_assignments"("tenantId", "taskId", "generation");
CREATE INDEX "task_assignments_agentId_idx" ON "task_assignments"("agentId");

-- Make idempotency_records.expiresAt nullable for durable business records
-- Per NC-AWL-IMP-1 §3.3 (corrected): business idempotency keys do not expire.
-- Transient coordination uses a separate lock record (not this column).
ALTER TABLE "idempotency_records" ALTER COLUMN "expiresAt" DROP NOT NULL;

-- TenantFeatureFlagOverride
CREATE TABLE "tenant_feature_flag_overrides" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "flagKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "setByActorId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_feature_flag_overrides_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "tenant_feature_flag_overrides_tenantId_flagKey_key" ON "tenant_feature_flag_overrides"("tenantId", "flagKey");

-- FeatureFlagAuditLog
CREATE TABLE "feature_flag_audit_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "flagKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "oldValue" BOOLEAN,
  "newValue" BOOLEAN,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_flag_audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX "feature_flag_audit_logs_tenantId_idx" ON "feature_flag_audit_logs"("tenantId");
CREATE INDEX "feature_flag_audit_logs_flagKey_idx" ON "feature_flag_audit_logs"("flagKey");

-- ============================================================================
-- ALTER EXISTING MODELS
-- ============================================================================

-- Agent: add new fields
ALTER TABLE "agents"
  ADD COLUMN "role" TEXT,
  ADD COLUMN "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "maxConcurrency" INTEGER DEFAULT 5,
  ADD COLUMN "availability" "AgentAvailability" DEFAULT 'AVAILABLE',
  ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- Goal: add automationVersion and templateKey
ALTER TABLE "goals"
  ADD COLUMN "automationVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "templateKey" TEXT;

CREATE UNIQUE INDEX "goals_tenantId_projectId_automationVersion_templateKey_key"
  ON "goals"("tenantId", "projectId", "automationVersion", "templateKey");

-- Task: add automationVersion, templateKey, requiredRole, requiredCapabilities
ALTER TABLE "tasks"
  ADD COLUMN "automationVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "templateKey" TEXT,
  ADD COLUMN "requiredRole" TEXT,
  ADD COLUMN "requiredCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "tasks_tenantId_projectId_automationVersion_templateKey_key"
  ON "tasks"("tenantId", "projectId", "automationVersion", "templateKey");

-- Project: add executionEngineVersion and initiationId relation
ALTER TABLE "projects"
  ADD COLUMN "executionEngineVersion" "ExecutionEngine" DEFAULT 'legacy',
  ADD COLUMN "initiationId" TEXT;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_initiationId_fkey" FOREIGN KEY ("initiationId") REFERENCES "enterprise_initiations"("id") ON DELETE SET NULL;

CREATE INDEX "projects_initiationId_idx" ON "projects"("initiationId");
