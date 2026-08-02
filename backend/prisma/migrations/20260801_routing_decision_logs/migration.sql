-- ═══════════════════════════════════════════════════════════════════════════
-- 20260801_routing_decision_logs — Phase 2 service-gateway-v2 plan
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds a tenant-scoped, immutable RoutingDecisionLog table backing the
-- DeterministicIntentClassifier in Phase 2. Every classified prompt (READ,
-- MUTATION, AMBIGUOUS, UNSUPPORTED) writes one row so platform operators can
-- audit capability routing and reproduce every tool invocation back to its
-- classifier result.
--
-- No FK back-relation on actor/User is added in this migration; the
-- actorId is stored as an opaque string and not joined at the DB level.
-- Tenant isolation is enforced by the back-relation @relation(tenantId) and
-- by the @@index([tenantId, ...]) indexes that make tenant filtering
-- constant-time on every read.
--
-- Three keys index beyond the default tenant index:
--   - (tenantId, ruleId)         — detect rules that frequently emit
--                                  ambiguity or unsupported.
--   - (tenantId, canonicalCapability)
--                                — track which canonical capability actually
--                                  fired when LLM- and classifier-derived
--                                  identifiers disagreed.
--   - (tenantId, ambiguous)      — fast count of clarification prompts.

CREATE TABLE "routing_decision_logs" (
  "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"            TEXT         NOT NULL,
  "actorId"             TEXT         NOT NULL,
  "ruleVersion"         TEXT         NOT NULL,
  "ruleId"              TEXT         NOT NULL,
  "intent"              TEXT         NOT NULL,
  "canonicalCapability" TEXT,
  "confidence"          DOUBLE PRECISION NOT NULL,
  "rawMessageHash"      TEXT         NOT NULL,
  "resolvedActionId"    TEXT,
  "sessionId"           TEXT,
  "correlationId"       TEXT,
  "ambiguous"           BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "routing_decision_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "routing_decision_logs_tenantId_createdAt_idx"
  ON "routing_decision_logs"("tenantId", "createdAt");
CREATE INDEX "routing_decision_logs_tenantId_ruleId_idx"
  ON "routing_decision_logs"("tenantId", "ruleId");
CREATE INDEX "routing_decision_logs_tenantId_canonicalCapability_idx"
  ON "routing_decision_logs"("tenantId", "canonicalCapability");
CREATE INDEX "routing_decision_logs_tenantId_ambiguous_idx"
  ON "routing_decision_logs"("tenantId", "ambiguous");

ALTER TABLE "routing_decision_logs"
  ADD CONSTRAINT "routing_decision_logs_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE;
