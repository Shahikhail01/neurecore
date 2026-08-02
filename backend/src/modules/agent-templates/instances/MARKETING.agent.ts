/**
 * CR-AI-0504 — Marketing / Email Generation agent
 *
 * Permission-aware audience segmentation, campaign brief, email/body
 * variants, brand voice, governed campaign draft. Never sends without
 * approval.
 */

import type { OotbAgentDefinition } from './UNIVERSAL.agent';

export const MARKETING_AGENT_ID = 'CR-AI-0504';
export const MARKETING_AGENT_VERSION = '1.0.0';

export const MARKETING_AGENT: OotbAgentDefinition = {
  stableId: MARKETING_AGENT_ID,
  version: MARKETING_AGENT_VERSION,
  type: 'MARKETING',
  purpose:
    'Permission-aware audience segmentation, campaign brief and ' +
    'subject line variants, brand-voice email / landing-page drafts, ' +
    'campaign-response prediction, bounce categorization and ' +
    'remediation, and governed campaign draft via Work Runtime. ' +
    'Never sends an external campaign without approval.',
  supportedIntents: [
    'marketing.segment',
    'marketing.campaign.brief',
    'marketing.email.draft',
    'marketing.email.variants',
    'marketing.brand.complianceCheck',
    'marketing.campaign.predict',
    'marketing.bounce.analyze',
  ],
  unsupportedIntents: [
    'marketing.sendWithoutApproval',
    'marketing.skipBrandCheck',
    'marketing.contacts.export',
  ],
  skills: [
    {
      skillKey: 'segment.audience',
      semanticVersion: '1.0.0',
      description: 'Permission-aware audience segmentation',
    },
    {
      skillKey: 'campaign-brief',
      semanticVersion: '1.0.0',
      description: 'Drafts campaign brief with themes and constraints',
    },
    {
      skillKey: 'email-draft',
      semanticVersion: '1.0.0',
      description: 'Drafts email/body with brand voice and forbidden phrases',
    },
    {
      skillKey: 'email-variants',
      semanticVersion: '1.0.0',
      description: 'Generates subject/preview/body variants',
    },
    {
      skillKey: 'campaign-response.predict',
      semanticVersion: '1.0.0',
      description: 'Predicts campaign response propensity',
    },
    {
      skillKey: 'bounce-analyze',
      semanticVersion: '1.0.0',
      description: 'Categorizes bounces, recommends remediation',
    },
  ],
  dataSources: [
    { kind: 'crm_contact', access: 'READ', tenantIsolated: true },
    { kind: 'crm_account', access: 'READ', tenantIsolated: true },
    { kind: 'campaign', access: 'READ', tenantIsolated: true },
    { kind: 'knowledge_article', access: 'READ', tenantIsolated: true },
  ],
  toolCeiling: 'EXTERNAL_WRITE',
  approvalPolicy: 'ALWAYS',
  escalationOwner: 'marketing-manager',
  evaluationSet: [
    {
      id: 'M-1',
      intent: 'segment.audience',
      input: 'Build a segment of users who opened last newsletter',
      expectedOutcome: 'permission-aware segment with provenance and limit',
      qualityThreshold: 0.9,
    },
    {
      id: 'M-2',
      intent: 'email.draft',
      input: 'Draft a re-engagement email for dormant signups',
      expectedOutcome:
        'brand-voice draft with forbidden-phrase check, no auto-send',
      qualityThreshold: 0.9,
    },
    {
      id: 'M-3',
      intent: 'campaign.predict',
      input: 'Predict response rate for "Spring Promo" campaign',
      expectedOutcome:
        'predicted response, limitations, requires ACTIVE model lifecycle',
      qualityThreshold: 0.8,
    },
  ],
  budget: { dailyTokens: 300_000, dailyCostCents: 300 },
  channels: ['web', 'gmail', 'outlook'],
  lifecycle: { status: 'CERTIFIED', certifiedAt: '2026-08-02T00:00:00Z' },
  slo: { p95LatencyMs: 3500, availability: 0.99 },
  killSwitch: {
    flagKey: 'agent.oob.marketing.killswitch',
    reason: 'Emergency stop for the marketing OOTB agent',
  },
};
