-- Migration: 20260808_phase27_crm_events
--
-- Phase 27 of neurecore/memory-bank-arc/harness/IMPLEMENTATION-PLAN-PARITY-COMPLETION.md
-- CR-AI-1106 — CRM/commerce event-triggered workflow skills.
--
-- Adds the crm_events table that backs PrismaCrmEventStore, giving the
-- CrmEventTriggerService durable idempotency + replay (previously
-- process-local in-memory only). The migration is additive — no
-- existing table is altered.

BEGIN;

CREATE TABLE IF NOT EXISTS "crm_events" (
  "id"              text PRIMARY KEY,
  "tenantId"        text NOT NULL,
  "source"          text NOT NULL,
  "eventType"       text NOT NULL,
  "payload"         jsonb NOT NULL,
  "receivedAt"      timestamptz NOT NULL,
  "providerEventId" text,
  CONSTRAINT "crm_events_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "crm_events_tenantId_source_eventType_providerEventId_idx"
  ON "crm_events"("tenantId","source","eventType","providerEventId");

COMMIT;
