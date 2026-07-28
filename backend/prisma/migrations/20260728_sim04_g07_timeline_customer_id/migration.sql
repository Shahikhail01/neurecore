-- ═══════════════════════════════════════════════════════════════════════════
-- 20260728_sim04_g07_timeline_customer_id — TimelineEvent.customerId
-- ═══════════════════════════════════════════════════════════════════════════
--
-- SIM-04 G-07 — adds a customerId FK column to TimelineEvent so that
-- customer-scoped events (e.g. customer lifecycle transitions) can be
-- persisted and queried by customer. The customer relation is SetNull on
-- delete so archiving a customer doesn't orphan historical events.

ALTER TABLE "timeline_events" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
CREATE INDEX IF NOT EXISTS "timeline_events_tenantId_customerId_idx"
  ON "timeline_events" ("tenantId", "customerId");
