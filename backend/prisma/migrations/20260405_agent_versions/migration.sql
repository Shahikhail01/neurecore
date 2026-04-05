-- ─── Phase 7: Agent Version Control + Rollback ─────────────────────────────
-- Apply via: Neon SQL console (copy-paste) or `psql $DATABASE_URL`
-- After applying: run `pnpm prisma generate` in backend/

CREATE TABLE IF NOT EXISTS "agent_versions" (
  "id"             TEXT          NOT NULL,
  "agentId"        TEXT          NOT NULL,
  "tenantId"       TEXT          NOT NULL,
  "versionNumber"  INTEGER       NOT NULL,
  "label"          TEXT,
  "configSnapshot" JSONB         NOT NULL DEFAULT '{}',
  "changedBy"      TEXT          NOT NULL,
  "changeNote"     TEXT,
  "isActive"       BOOLEAN       NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_versions_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE,
  CONSTRAINT "agent_versions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "agent_versions_agentId_versionNumber_key"
    UNIQUE ("agentId", "versionNumber")
);

CREATE INDEX IF NOT EXISTS "agent_versions_agentId_idx"  ON "agent_versions"("agentId");
CREATE INDEX IF NOT EXISTS "agent_versions_tenantId_idx" ON "agent_versions"("tenantId");
