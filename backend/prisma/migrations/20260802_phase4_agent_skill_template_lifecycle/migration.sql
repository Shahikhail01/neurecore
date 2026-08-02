-- ═══════════════════════════════════════════════════════════════════════════
-- 20260802_phase4_agent_skill_template_lifecycle
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Plan ref: NC-AWL-IMP-1 §Phase 4 — persisted agent/skill template lifecycle.
--
-- Adds:
--   * 5 enums: AgentSkillCertificationStatus, AgentTemplateLifecycleStatus,
--     AgentLifecycleAuditAction, AgentLifecycleAuditSubject, AgentSkillMaxEffect
--   * 4 models: AgentSkillDefinition, AgentTemplateVersion,
--     AgentTemplateCertification, AgentLifecycleAuditLog
--
-- Tenant isolation: every row carries tenantId and is filtered at the Prisma
-- layer via repository helpers. Back-relations added on Tenant and
-- AgentTemplate in the schema file.

-- ─── Enums ───────────────────────────────────────────────────────────────

CREATE TYPE "AgentSkillCertificationStatus" AS ENUM (
  'DRAFT', 'CERTIFIED', 'DEPRECATED', 'RETIRED'
);

CREATE TYPE "AgentTemplateLifecycleStatus" AS ENUM (
  'DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED'
);

CREATE TYPE "AgentLifecycleAuditAction" AS ENUM (
  'CREATE', 'UPDATE', 'CERTIFY', 'ACTIVATE',
  'SUSPEND', 'RESUME', 'RETIRE', 'ROLLBACK'
);

CREATE TYPE "AgentLifecycleAuditSubject" AS ENUM (
  'TEMPLATE', 'SKILL', 'VERSION'
);

CREATE TYPE "AgentSkillMaxEffect" AS ENUM (
  'NONE', 'READ', 'SUGGEST', 'DRAFT',
  'EXECUTE_LOCAL', 'EXECUTE_EXTERNAL', 'IRREVERSIBLE'
);

-- ─── AgentSkillDefinition ────────────────────────────────────────────────

CREATE TABLE "agent_skill_definitions" (
    "id"                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenantId"                    TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "skillKey"                    TEXT NOT NULL,
    "semanticVersion"             TEXT NOT NULL DEFAULT '1.0.0',
    "inputSchema"                 JSONB NOT NULL DEFAULT '{}',
    "outputSchema"                JSONB NOT NULL DEFAULT '{}',
    "composedOf"                  JSONB NOT NULL DEFAULT '[]',
    "maxEffect"                   "AgentSkillMaxEffect" NOT NULL DEFAULT 'NONE',
    "requiredAuthority"           INTEGER NOT NULL DEFAULT 0,
    "approvalSensitive"           BOOLEAN NOT NULL DEFAULT false,
    "preconditions"               JSONB NOT NULL DEFAULT '{}',
    "postconditions"              JSONB NOT NULL DEFAULT '{}',
    "timeoutMs"                   INTEGER NOT NULL DEFAULT 30000,
    "retryPolicy"                 JSONB NOT NULL DEFAULT '{}',
    "idempotencyKeyPattern"       TEXT,
    "responseEnvelopeMapping"     JSONB NOT NULL DEFAULT '{}',
    "testExamples"                JSONB NOT NULL DEFAULT '[]',
    "certificationStatus"         "AgentSkillCertificationStatus" NOT NULL DEFAULT 'DRAFT',
    "certifiedAt"                 TIMESTAMP(3),
    "certifiedByActorId"          TEXT,
    "certifiedVersion"            TEXT,
    "rollbackOfId"                TEXT,
    "lifecycleStatus"             "AgentTemplateLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "agent_skill_definitions_tenantId_skillKey_semanticVersion_key"
  ON "agent_skill_definitions" ("tenantId", "skillKey", "semanticVersion");
CREATE INDEX "agent_skill_definitions_tenantId_skillKey_idx"
  ON "agent_skill_definitions" ("tenantId", "skillKey");
CREATE INDEX "agent_skill_definitions_tenantId_lifecycleStatus_idx"
  ON "agent_skill_definitions" ("tenantId", "lifecycleStatus");
CREATE INDEX "agent_skill_definitions_tenantId_certificationStatus_idx"
  ON "agent_skill_definitions" ("tenantId", "certificationStatus");

-- ─── AgentTemplateVersion ────────────────────────────────────────────────

CREATE TABLE "agent_template_versions" (
    "id"                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenantId"                 TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "agentTemplateId"          TEXT NOT NULL REFERENCES "agent_templates"("id") ON DELETE CASCADE,
    "version"                  TEXT NOT NULL,
    "definition"               JSONB NOT NULL DEFAULT '{}',
    "composedSkillRefs"        JSONB NOT NULL DEFAULT '[]',
    "maxEffect"                "AgentSkillMaxEffect" NOT NULL DEFAULT 'NONE',
    "authorityCeiling"         INTEGER NOT NULL DEFAULT 0,
    "escalationActorId"        TEXT,
    "budgetLimit"              JSONB,
    "rateLimits"               JSONB,
    "channelBindings"          JSONB NOT NULL DEFAULT '[]',
    "approvalPolicyRefs"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "evaluationMinScore"       DOUBLE PRECISION,
    "evaluationDatasetId"      TEXT,
    "certificationStatus"      "AgentSkillCertificationStatus" NOT NULL DEFAULT 'DRAFT',
    "certifiedAt"              TIMESTAMP(3),
    "certifiedByActorId"       TEXT,
    "lifecycleStatus"          "AgentTemplateLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "supersededByVersionId"    TEXT,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "agent_template_versions_tenantId_agentTemplateId_version_key"
  ON "agent_template_versions" ("tenantId", "agentTemplateId", "version");
CREATE INDEX "agent_template_versions_tenantId_agentTemplateId_idx"
  ON "agent_template_versions" ("tenantId", "agentTemplateId");
CREATE INDEX "agent_template_versions_tenantId_lifecycleStatus_idx"
  ON "agent_template_versions" ("tenantId", "lifecycleStatus");
CREATE INDEX "agent_template_versions_tenantId_certificationStatus_idx"
  ON "agent_template_versions" ("tenantId", "certificationStatus");
CREATE INDEX "agent_template_versions_agentTemplateId_lifecycleStatus_idx"
  ON "agent_template_versions" ("agentTemplateId", "lifecycleStatus");

-- ─── AgentTemplateCertification ──────────────────────────────────────────

CREATE TABLE "agent_template_certifications" (
    "id"                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenantId"               TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "agentTemplateVersionId" TEXT NOT NULL REFERENCES "agent_template_versions"("id") ON DELETE CASCADE,
    "certifiedByActorId"     TEXT NOT NULL,
    "certifiedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signatureHash"          TEXT NOT NULL,
    "evaluationReport"       JSONB NOT NULL DEFAULT '{}',
    "expiresAt"              TIMESTAMP(3)
);

CREATE INDEX "agent_template_certifications_tenantId_agentTemplateVersionId_idx"
  ON "agent_template_certifications" ("tenantId", "agentTemplateVersionId");
CREATE INDEX "agent_template_certifications_tenantId_certifiedAt_idx"
  ON "agent_template_certifications" ("tenantId", "certifiedAt");

-- ─── AgentLifecycleAuditLog ──────────────────────────────────────────────

CREATE TABLE "agent_lifecycle_audit_logs" (
    "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenantId"      TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "actorId"       TEXT NOT NULL,
    "action"        "AgentLifecycleAuditAction" NOT NULL,
    "subjectType"   "AgentLifecycleAuditSubject" NOT NULL,
    "subjectId"     TEXT NOT NULL,
    "previousState" JSONB NOT NULL,
    "newState"      JSONB NOT NULL,
    "reason"        TEXT NOT NULL,
    "occurredAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "agent_lifecycle_audit_logs_tenantId_subjectType_subjectId_occurre_idx"
  ON "agent_lifecycle_audit_logs" ("tenantId", "subjectType", "subjectId", "occurredAt");
CREATE INDEX "agent_lifecycle_audit_logs_tenantId_occurredAt_idx"
  ON "agent_lifecycle_audit_logs" ("tenantId", "occurredAt");
CREATE INDEX "agent_lifecycle_audit_logs_tenantId_actorId_idx"
  ON "agent_lifecycle_audit_logs" ("tenantId", "actorId");