-- Phase 7 migration: Service ops + governance authoring + XAI + Studio UI support
-- Source plan: §5.9.1/2/3/4/8, §5.10.1/4/5, §5.11.3/4/5, §5.13.13/16, §5.14.3/8/9/12, §5.4.17

CREATE TYPE "CaseTriageAction" AS ENUM ('AUTO_ROUTE_QUEUE', 'AUTO_ROUTE_OWNER', 'AUTO_PRIORITY', 'ESCALATE_HUMAN', 'REQUEST_INFO');
CREATE TYPE "CasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "OperationalHealthSeverity" AS ENUM ('OK', 'WARN', 'CRITICAL');
CREATE TYPE "ChatbotPersonaKind" AS ENUM ('SELF_SERVICE_24_7', 'SALES_ASSIST', 'SUPPORT_TIER_1', 'INTERNAL_HELPDESK');

CREATE TABLE "customer_touchpoint_events" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "channelKind" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "customer_touchpoint_events_tenantId_channelKind_externalId_key" UNIQUE ("tenantId", "channelKind", "externalId")
);
CREATE INDEX "customer_touchpoint_events_tenantId_customerId_occurredAt_idx" ON "customer_touchpoint_events"("tenantId", "customerId", "occurredAt");
CREATE INDEX "customer_touchpoint_events_tenantId_channelKind_occurredAt_idx" ON "customer_touchpoint_events"("tenantId", "channelKind", "occurredAt");

CREATE TABLE "case_triage_rules" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "priority" "CasePriority" NOT NULL DEFAULT 'MEDIUM',
  "action" "CaseTriageAction" NOT NULL,
  "targetQueue" TEXT,
  "targetOwnerId" TEXT,
  "predicate" JSONB NOT NULL DEFAULT '{}',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "case_triage_rules_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);
CREATE INDEX "case_triage_rules_tenantId_enabled_idx" ON "case_triage_rules"("tenantId", "enabled");

CREATE TABLE "chatbot_personas" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "kind" "ChatbotPersonaKind" NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "allowedActionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "knowledgeCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "escalationThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chatbot_personas_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);
CREATE INDEX "chatbot_personas_tenantId_kind_enabled_idx" ON "chatbot_personas"("tenantId", "kind", "enabled");

CREATE TABLE "real_time_agent_guidance" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "hint" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trigger" TEXT NOT NULL,
  "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3)
);
CREATE INDEX "real_time_agent_guidance_tenantId_caseId_shownAt_idx" ON "real_time_agent_guidance"("tenantId", "caseId", "shownAt");

CREATE TABLE "knowledge_gaps" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "caseCount" INTEGER NOT NULL DEFAULT 0,
  "topicHash" TEXT NOT NULL,
  "suggestedTitle" TEXT,
  "suggestedBody" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_gaps_tenantId_topicHash_key" UNIQUE ("tenantId", "topicHash")
);
CREATE INDEX "knowledge_gaps_tenantId_status_idx" ON "knowledge_gaps"("tenantId", "status");

CREATE TABLE "case_escalations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "ruleId" TEXT,
  "fromStatus" TEXT NOT NULL,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "case_escalations_tenantId_caseId_occurredAt_idx" ON "case_escalations"("tenantId", "caseId", "occurredAt");

CREATE TABLE "customer_intent_signals" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "intentKind" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "features" JSONB NOT NULL DEFAULT '{}',
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "customer_intent_signals_tenantId_customerId_detectedAt_idx" ON "customer_intent_signals"("tenantId", "customerId", "detectedAt");
CREATE INDEX "customer_intent_signals_tenantId_intentKind_idx" ON "customer_intent_signals"("tenantId", "intentKind");

CREATE TABLE "events" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "capacity" INTEGER,
  "venue" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "events_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);
CREATE INDEX "events_tenantId_status_idx" ON "events"("tenantId", "status");

CREATE TABLE "event_invitations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "contactId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "registeredAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "event_invitations_tenantId_status_idx" ON "event_invitations"("tenantId", "status");
CREATE INDEX "event_invitations_tenantId_eventId_idx" ON "event_invitations"("tenantId", "eventId");

CREATE TABLE "partners" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partners_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);
CREATE INDEX "partners_tenantId_enabled_idx" ON "partners"("tenantId", "enabled");

CREATE TABLE "partner_lead_shares" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
  "leadId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SHARED',
  "notes" TEXT,
  "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3)
);
CREATE INDEX "partner_lead_shares_tenantId_partnerId_status_idx" ON "partner_lead_shares"("tenantId", "partnerId", "status");
CREATE INDEX "partner_lead_shares_tenantId_leadId_idx" ON "partner_lead_shares"("tenantId", "leadId");

CREATE TABLE "quotes" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "quoteNumber" TEXT NOT NULL,
  "items" JSONB NOT NULL DEFAULT '[]',
  "subtotal" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "validUntil" TIMESTAMP(3),
  "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "generatedByAgentId" TEXT,
  "approvedByActorId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quotes_tenantId_quoteNumber_key" UNIQUE ("tenantId", "quoteNumber")
);
CREATE INDEX "quotes_tenantId_dealId_idx" ON "quotes"("tenantId", "dealId");
CREATE INDEX "quotes_tenantId_status_idx" ON "quotes"("tenantId", "status");

CREATE TABLE "sales_outreach_campaigns" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "sequence" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "contactedCount" INTEGER NOT NULL DEFAULT 0,
  "repliedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_outreach_campaigns_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);
CREATE INDEX "sales_outreach_campaigns_tenantId_status_idx" ON "sales_outreach_campaigns"("tenantId", "status");

CREATE TABLE "field_sales_assignments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "repId" TEXT NOT NULL,
  "subjectKind" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "field_sales_assignments_tenantId_repId_scheduledFor_idx" ON "field_sales_assignments"("tenantId", "repId", "scheduledFor");
CREATE INDEX "field_sales_assignments_tenantId_status_idx" ON "field_sales_assignments"("tenantId", "status");

CREATE TABLE "sales_lead_routing_decisions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "ruleId" TEXT,
  "chosenRepId" TEXT,
  "chosenQueue" TEXT,
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "sales_lead_routing_decisions_tenantId_leadId_decidedAt_idx" ON "sales_lead_routing_decisions"("tenantId", "leadId", "decidedAt");

CREATE TABLE "governance_control_rules" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "standards" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "predicate" JSONB NOT NULL DEFAULT '{}',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "governance_control_rules_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);
CREATE INDEX "governance_control_rules_tenantId_domain_enabled_idx" ON "governance_control_rules"("tenantId", "domain", "enabled");

CREATE TABLE "operational_health_metrics" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "probe" TEXT NOT NULL,
  "severity" "OperationalHealthSeverity" NOT NULL DEFAULT 'OK',
  "detail" JSONB NOT NULL DEFAULT '{}',
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "operational_health_metrics_tenantId_probe_observedAt_idx" ON "operational_health_metrics"("tenantId", "probe", "observedAt");
CREATE INDEX "operational_health_metrics_tenantId_severity_idx" ON "operational_health_metrics"("tenantId", "severity");

CREATE TABLE "security_control_states" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "controlKey" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_control_states_tenantId_controlKey_key" UNIQUE ("tenantId", "controlKey")
);
CREATE INDEX "security_control_states_tenantId_controlKey_idx" ON "security_control_states"("tenantId", "controlKey");

CREATE TABLE "internal_compliance_checks" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "checkName" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "internal_compliance_checks_tenantId_category_ranAt_idx" ON "internal_compliance_checks"("tenantId", "category", "ranAt");

CREATE TABLE "agent_envelope_explanations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "decisionTrace" JSONB NOT NULL DEFAULT '{}',
  "reason" TEXT NOT NULL,
  "factors" JSONB NOT NULL DEFAULT '[]',
  "featureImportances" JSONB NOT NULL DEFAULT '{}',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "agent_envelope_explanations_tenantId_executionId_idx" ON "agent_envelope_explanations"("tenantId", "executionId");
