-- Migration: 20260807_phase25_meetings_live
--
-- Phase 25 of neurecore/memory-bank-arc/harness/IMPLEMENTATION-PLAN-PARITY-COMPLETION.md
-- CR-AI-0401..0404 — Live meetings (Outlook / Teams call-graph + write-back).
--
-- Adds:
--   - meeting_provider_connections   per-tenant OAuth connection state
--   - meeting_live_sessions          live call-graph session lifecycle
--   - deal_pipeline_snapshots        (Phase 26 prep — additive, empty until P26 fills it)
--
-- All additive. No existing tables altered.

BEGIN;

CREATE TABLE IF NOT EXISTS "meeting_provider_connections" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "userId" text NOT NULL,
  "provider" "MeetingProvider" NOT NULL,
  "externalTenantId" text,
  "externalUserId" text,
  "scopes" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "meeting_provider_connections_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "meeting_provider_connections_tenant_user_provider_key"
  ON "meeting_provider_connections"("tenantId","userId","provider");
CREATE INDEX IF NOT EXISTS "meeting_provider_connections_tenantId_revokedAt_idx"
  ON "meeting_provider_connections"("tenantId","revokedAt");

CREATE TABLE IF NOT EXISTS "meeting_live_sessions" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "provider" "MeetingProvider" NOT NULL,
  "providerMeetingId" text NOT NULL,
  "transcriptId" text,
  "state" text NOT NULL DEFAULT 'OPEN', -- OPEN | CLOSED | FAILED
  "startedAt" timestamptz NOT NULL DEFAULT now(),
  "endedAt" timestamptz,
  "lastEventAt" timestamptz NOT NULL DEFAULT now(),
  "lastEventType" text,
  CONSTRAINT "meeting_live_sessions_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "meeting_live_sessions_tenant_provider_meeting_key"
  ON "meeting_live_sessions"("tenantId","provider","providerMeetingId");
CREATE INDEX IF NOT EXISTS "meeting_live_sessions_tenantId_state_idx"
  ON "meeting_live_sessions"("tenantId","state");

COMMIT;
