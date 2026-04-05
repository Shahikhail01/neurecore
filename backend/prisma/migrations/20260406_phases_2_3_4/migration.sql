-- ============================================================
-- Migration: Phases 2, 3, 4 schema additions
-- Covers:
--   Phase 2.1  Agent Staging + EvaluationRuns
--   Phase 2.3  Supervisor-Worker Agent relations
--   Phase 2.4  Department-scoped Knowledge Spaces
--   Phase 4.1  SSO Config scaffold
-- ============================================================

-- 1. New enum types ---------------------------------------------------

CREATE TYPE "DeploymentMode" AS ENUM ('PRODUCTION', 'STAGING');
CREATE TYPE "EvaluationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "KnowledgeSourceType" AS ENUM ('MANUAL', 'GOOGLE_DRIVE', 'NOTION', 'CONFLUENCE', 'GITHUB', 'SLACK');
CREATE TYPE "SsoProvider" AS ENUM ('SAML', 'OIDC');

-- 2. Alter agents table — staging + supervisor fields ----------------

ALTER TABLE "agents"
  ADD COLUMN "deployment_mode"   "DeploymentMode" NOT NULL DEFAULT 'PRODUCTION',
  ADD COLUMN "staging_parent_id" TEXT,
  ADD COLUMN "supervisor_id"     TEXT;

ALTER TABLE "agents"
  ADD CONSTRAINT "agents_staging_parent_id_fkey"
    FOREIGN KEY ("staging_parent_id") REFERENCES "agents"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "agents_supervisor_id_fkey"
    FOREIGN KEY ("supervisor_id") REFERENCES "agents"("id") ON DELETE SET NULL;

CREATE INDEX "agents_staging_parent_id_idx" ON "agents"("staging_parent_id");
CREATE INDEX "agents_supervisor_id_idx" ON "agents"("supervisor_id");

-- 3. EvaluationRun table -----------------------------------------------

CREATE TABLE "evaluation_runs" (
  "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "agent_id"      TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "status"        "EvaluationStatus" NOT NULL DEFAULT 'PENDING',
  "test_cases"    JSONB NOT NULL DEFAULT '[]',
  "results"       JSONB,
  "score_overall" DECIMAL(5,2),
  "run_by"        TEXT NOT NULL,
  "notes"         TEXT,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "evaluation_runs_agent_id_fkey"  FOREIGN KEY ("agent_id")  REFERENCES "agents"("id")  ON DELETE CASCADE,
  CONSTRAINT "evaluation_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX "evaluation_runs_agent_id_idx"  ON "evaluation_runs"("agent_id");
CREATE INDEX "evaluation_runs_tenant_id_idx" ON "evaluation_runs"("tenant_id");

-- 4. KnowledgeSpace table ----------------------------------------------

CREATE TABLE "knowledge_spaces" (
  "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "tenant_id"     TEXT NOT NULL,
  "department_id" TEXT,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "knowledge_spaces_tenant_id_fkey"     FOREIGN KEY ("tenant_id")     REFERENCES "tenants"("id")     ON DELETE CASCADE,
  CONSTRAINT "knowledge_spaces_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL
);

CREATE INDEX "knowledge_spaces_tenant_id_idx"     ON "knowledge_spaces"("tenant_id");
CREATE INDEX "knowledge_spaces_department_id_idx" ON "knowledge_spaces"("department_id");

-- 5. KnowledgeDocument table -------------------------------------------
-- pgvector column is optional; extension must be enabled in Neon (it is).

CREATE TABLE "knowledge_documents" (
  "id"          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "space_id"    TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "source_type" "KnowledgeSourceType" NOT NULL DEFAULT 'MANUAL',
  "source_url"  TEXT,
  "metadata"    JSONB NOT NULL DEFAULT '{}',
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "knowledge_documents_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "knowledge_spaces"("id") ON DELETE CASCADE
);

CREATE INDEX "knowledge_documents_space_id_idx" ON "knowledge_documents"("space_id");

-- 6. AgentKnowledgeAccess join table -----------------------------------

CREATE TABLE "agent_knowledge_access" (
  "id"       TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "agent_id" TEXT NOT NULL,
  "space_id" TEXT NOT NULL,
  CONSTRAINT "agent_knowledge_access_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id")           ON DELETE CASCADE,
  CONSTRAINT "agent_knowledge_access_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "knowledge_spaces"("id") ON DELETE CASCADE,
  CONSTRAINT "agent_knowledge_access_agent_space_unique" UNIQUE ("agent_id", "space_id")
);

CREATE INDEX "agent_knowledge_access_agent_id_idx" ON "agent_knowledge_access"("agent_id");
CREATE INDEX "agent_knowledge_access_space_id_idx" ON "agent_knowledge_access"("space_id");

-- 7. SsoConfig table ---------------------------------------------------

CREATE TABLE "sso_configs" (
  "id"          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id"   TEXT NOT NULL UNIQUE,
  "provider"    "SsoProvider" NOT NULL,
  "entry_point" TEXT,
  "issuer"      TEXT,
  "cert"        TEXT,
  "client_id"   TEXT,
  "is_enabled"  BOOLEAN NOT NULL DEFAULT FALSE,
  "metadata"    JSONB NOT NULL DEFAULT '{}',
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "sso_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);
