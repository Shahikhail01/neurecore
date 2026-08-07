-- Migration: 20260807_add_meetings_tables
--
-- Phase 16 of neurecore/memory-bank-arc/harness/IMPLEMENTATION-PLAN-PHASE-15-18.md
--
-- Adds four tables for CR-AI-0401..0404:
--   - meeting_provider_consent    ingestion consent record per provider
--   - meeting_transcripts         raw transcript + metadata + jurisdiction
--   - meeting_summary_templates   per-meeting-type template (4 sections)
--   - meeting_action_items         extracted action items
--
-- All additive. Drops require operator approval in a follow-up.

BEGIN;

CREATE TYPE "MeetingProvider" AS ENUM (
  'OUTLOOK', 'TEAMS', 'ZOOM', 'GOOGLE_MEET', 'MANUAL'
);

CREATE TYPE "MeetingStatus" AS ENUM (
  'INGESTED', 'TRANSCRIBED', 'SUMMARIZED', 'ACTIONS_EXTRACTED', 'LINKED', 'FAILED'
);

CREATE TABLE IF NOT EXISTS "meeting_provider_consents" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "userId" text NOT NULL,
  "provider" "MeetingProvider" NOT NULL,
  "scopes" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "jurisdiction" text,
  "grantedAt" timestamptz NOT NULL DEFAULT now(),
  "revokedAt" timestamptz,
  CONSTRAINT "meeting_provider_consents_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "meeting_provider_consents_tenantId_userId_provider_idx"
  ON "meeting_provider_consents"("tenantId","userId","provider");
CREATE INDEX IF NOT EXISTS "meeting_provider_consents_tenantId_revokedAt_idx"
  ON "meeting_provider_consents"("tenantId","revokedAt");

CREATE TABLE IF NOT EXISTS "meeting_summary_templates" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "name" text NOT NULL,
  "meetingType" text NOT NULL,
  "sections" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "isDefault" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "meeting_summary_templates_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "meeting_summary_templates_tenantId_name_key" UNIQUE ("tenantId","name")
);

CREATE TABLE IF NOT EXISTS "meeting_transcripts" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizerUserId" text,
  "provider" "MeetingProvider" NOT NULL,
  "providerMeetingId" text NOT NULL,
  "title" text NOT NULL,
  "scheduledAt" timestamptz NOT NULL,
  "durationSeconds" integer NOT NULL DEFAULT 0,
  "languageCode" text NOT NULL DEFAULT 'en',
  "jurisdiction" text,
  "transcriptText" text NOT NULL DEFAULT '',
  "participantsJson" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" "MeetingStatus" NOT NULL DEFAULT 'INGESTED',
  "summaryTemplateId" text,
  "linkedRecordType" text,
  "linkedRecordId" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "meeting_transcripts_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "meeting_transcripts_summaryTemplateId_fkey" FOREIGN KEY ("summaryTemplateId")
    REFERENCES "meeting_summary_templates"("id") ON DELETE SET NULL,
  CONSTRAINT "meeting_transcripts_tenantId_provider_providerMeetingId_key" UNIQUE ("tenantId","provider","providerMeetingId")
);

CREATE INDEX IF NOT EXISTS "meeting_transcripts_tenantId_status_scheduledAt_idx"
  ON "meeting_transcripts"("tenantId","status","scheduledAt" DESC);
CREATE INDEX IF NOT EXISTS "meeting_transcripts_tenantId_linkedRecordType_idx"
  ON "meeting_transcripts"("tenantId","linkedRecordType","linkedRecordId");

CREATE TABLE IF NOT EXISTS "meeting_action_items" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "transcriptId" text NOT NULL,
  "description" text NOT NULL,
  "ownerUserId" text,
  "dueDate" timestamptz,
  "confidencePercent" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'PENDING',
  "ambiguousOwner" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "meeting_action_items_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "meeting_action_items_transcriptId_fkey" FOREIGN KEY ("transcriptId")
    REFERENCES "meeting_transcripts"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "meeting_action_items_tenantId_status_idx"
  ON "meeting_action_items"("tenantId","status");
CREATE INDEX IF NOT EXISTS "meeting_action_items_tenantId_transcriptId_idx"
  ON "meeting_action_items"("tenantId","transcriptId");

COMMIT;
