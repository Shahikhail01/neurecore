/**
 * CR-AI-0505 — Service / Case Resolution agent
 *
 * Case classification, sentiment, urgency, SLA risk, cited knowledge
 * resolution, response draft, governed assignment. Uses
 * analytics.case-classify provider.
 */

import type { OotbAgentDefinition } from './UNIVERSAL.agent';

export const SERVICE_AGENT_ID = 'CR-AI-0505';
export const SERVICE_AGENT_VERSION = '1.0.0';

export const SERVICE_AGENT: OotbAgentDefinition = {
  stableId: SERVICE_AGENT_ID,
  version: SERVICE_AGENT_VERSION,
  type: 'SERVICE',
  purpose:
    'Case summarization, classification, priority and urgency, ' +
    'sentiment and SLA-breach prediction, related-case discovery, ' +
    'cited knowledge resolution suggestions, response drafts, and ' +
    'governed assignment / status / notes / escalation / customer ' +
    'communication.',
  supportedIntents: [
    'service.case.classify',
    'service.case.summarize',
    'service.case.sentiment',
    'service.case.urgency',
    'service.case.related',
    'service.case.resolve',
    'service.case.responseDraft',
    'service.case.escalation',
    'service.case.slaRisk',
    'service.case.governedUpdate',
  ],
  unsupportedIntents: [
    'service.case.purgeAuditTrail',
    'service.case.bypassApproval',
    'service.case.sendExternalWithoutApproval',
  ],
  skills: [
    {
      skillKey: 'case-classify.predict',
      semanticVersion: '1.0.0',
      description: 'Predicts category, urgency, sentiment, SLA risk',
    },
    {
      skillKey: 'case-summarize',
      semanticVersion: '1.0.0',
      description: 'Summarizes case thread',
    },
    {
      skillKey: 'case-resolve',
      semanticVersion: '1.0.0',
      description: 'Resolution recommendation with citations',
    },
    {
      skillKey: 'case-response.draft',
      semanticVersion: '1.0.0',
      description: 'Drafts customer-facing response with approval',
    },
    {
      skillKey: 'case-escalate.recommend',
      semanticVersion: '1.0.0',
      description: 'Recommends escalation / re-routing',
    },
    {
      skillKey: 'case.assignment.governed',
      semanticVersion: '1.0.0',
      description: 'Governed case assignment, status, notes, escalation',
    },
  ],
  dataSources: [
    { kind: 'case', access: 'READ', tenantIsolated: true },
    { kind: 'knowledge_article', access: 'READ', tenantIsolated: true },
    { kind: 'crm_contact', access: 'READ', tenantIsolated: true },
    { kind: 'crm_account', access: 'READ', tenantIsolated: true },
  ],
  toolCeiling: 'EXTERNAL_WRITE',
  approvalPolicy: 'OPTIONAL',
  escalationOwner: 'service-manager',
  evaluationSet: [
    {
      id: 'V-1',
      intent: 'case.classify',
      input: 'Classify case "Cannot log in after password reset"',
      expectedOutcome:
        'category + priority + sentiment + SLA risk with limitations',
      qualityThreshold: 0.85,
    },
    {
      id: 'V-2',
      intent: 'case.resolve',
      input: 'Suggest resolution for invoice email failure',
      expectedOutcome: 'cited knowledge article with matching excerpt',
      qualityThreshold: 0.9,
    },
    {
      id: 'V-3',
      intent: 'case.assignment',
      input: 'Reassign case to billing team',
      expectedOutcome: 'governed assignment, requires approval if cross-team',
      qualityThreshold: 0.95,
    },
  ],
  budget: { dailyTokens: 300_000, dailyCostCents: 300 },
  channels: ['web', 'teams', 'outlook'],
  lifecycle: { status: 'CERTIFIED', certifiedAt: '2026-08-02T00:00:00Z' },
  slo: { p95LatencyMs: 3000, availability: 0.99 },
  killSwitch: {
    flagKey: 'agent.oob.service.killswitch',
    reason: 'Emergency stop for the service OOTB agent',
  },
};
