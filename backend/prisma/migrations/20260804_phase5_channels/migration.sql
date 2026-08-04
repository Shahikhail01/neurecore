-- Phase 5 migration: Channel Integrations
-- Source plan: creatio-ai-parity-implementation-plan-v2.md §5.16
-- Solid:
--   * ChannelConnection is per-tenant; no platform-wide channel override.
--   * ChannelEvent is append-only.

CREATE TYPE "ChannelKind" AS ENUM (
  'WEB_ASSISTANT',
  'EMAIL',
  'SMS',
  'VOICE',
  'VIDEO',
  'MS_TEAMS',
  'MS_OUTLOOK',
  'GOOGLE_CHAT',
  'GOOGLE_CALENDAR',
  'ZOOM',
  'MCP',
  'WEBHOOK'
);

CREATE TYPE "ChannelConnectionStatus" AS ENUM (
  'ACTIVE',
  'DISABLED',
  'ERROR',
  'DRAINING'
);

CREATE TABLE "channel_connections" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "kind" "ChannelKind" NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" "ChannelConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "config" JSONB NOT NULL DEFAULT '{}',
  "secretRef" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCheckedAt" TIMESTAMP(3),
  CONSTRAINT "channel_connections_tenantId_kind_displayName_key" UNIQUE ("tenantId", "kind", "displayName")
);
CREATE INDEX "channel_connections_tenantId_kind_status_idx" ON "channel_connections"("tenantId", "kind", "status");

CREATE TABLE "channel_events" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "kind" "ChannelKind" NOT NULL,
  "connectionId" TEXT,
  "direction" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "errorMessage" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3)
);
CREATE INDEX "channel_events_tenantId_kind_occurredAt_idx" ON "channel_events"("tenantId", "kind", "occurredAt");
CREATE INDEX "channel_events_tenantId_status_idx" ON "channel_events"("tenantId", "status");
