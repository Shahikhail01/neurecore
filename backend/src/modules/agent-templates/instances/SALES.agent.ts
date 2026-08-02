/**
 * CR-AI-0503 — Sales agent
 *
 * Research / qualification / next-best-action / forecast. Uses the
 * canonical analytics prediction providers (lead-score,
 * opportunity-win, forecast, pipeline-health).
 */

import type { OotbAgentDefinition } from './UNIVERSAL.agent';

export const SALES_AGENT_ID = 'CR-AI-0503';
export const SALES_AGENT_VERSION = '1.0.0';

export const SALES_AGENT: OotbAgentDefinition = {
  stableId: SALES_AGENT_ID,
  version: SALES_AGENT_VERSION,
  type: 'SALES',
  purpose:
    'Authorized account / contact / lead / opportunity research, lead ' +
    'qualification and predictive scoring, opportunity summary, ' +
    'pipeline-health and forecast signals, explainable next-best ' +
    'action, follow-up drafts, and governed CRM field updates via ' +
    'Work Runtime.',
  supportedIntents: [
    'sales.research.account',
    'sales.research.contact',
    'sales.lead.qualify',
    'sales.lead.score',
    'sales.opportunity.summary',
    'sales.opportunity.winProb',
    'sales.pipeline.health',
    'sales.forecast',
    'sales.nba',
    'sales.followup.draft',
    'sales.crm.update',
  ],
  unsupportedIntents: [
    'sales.sendExternalWithoutApproval',
    'sales.bypassGovernance',
    'sales.opportunity.delete',
  ],
  skills: [
    {
      skillKey: 'lead-score.predict',
      semanticVersion: '1.0.0',
      description: 'Predictive lead score via analytics provider',
    },
    {
      skillKey: 'opportunity-win.predict',
      semanticVersion: '1.0.0',
      description: 'Predictive opportunity win probability',
    },
    {
      skillKey: 'forecast.predict',
      semanticVersion: '1.0.0',
      description: 'Sales forecast with confidence interval',
    },
    {
      skillKey: 'pipeline-health.classify',
      semanticVersion: '1.0.0',
      description: 'Churn / inactivity / close-risk classification',
    },
    {
      skillKey: 'followup.draft',
      semanticVersion: '1.0.0',
      description: 'Personalized follow-up draft — never auto-sends',
    },
    {
      skillKey: 'crm.update.governed',
      semanticVersion: '1.0.0',
      description: 'Governed CRM field update via Work Runtime',
    },
  ],
  dataSources: [
    { kind: 'crm_account', access: 'READ', tenantIsolated: true },
    { kind: 'crm_contact', access: 'READ', tenantIsolated: true },
    { kind: 'crm_lead', access: 'READ', tenantIsolated: true },
    { kind: 'crm_opportunity', access: 'READ', tenantIsolated: true },
    { kind: 'knowledge_article', access: 'READ', tenantIsolated: true },
  ],
  toolCeiling: 'EXTERNAL_WRITE',
  approvalPolicy: 'OPTIONAL',
  escalationOwner: 'sales-manager',
  evaluationSet: [
    {
      id: 'S-1',
      intent: 'lead.score',
      input: 'Qualify lead "Acme Corp inbound demo request"',
      expectedOutcome:
        'score with confidence, feature explanation, abstention if no snapshot',
      qualityThreshold: 0.85,
    },
    {
      id: 'S-2',
      intent: 'opportunity.winProb',
      input: 'Win probability for $250k renewal in PROPOSAL',
      expectedOutcome: 'win probability with limitations and explanation',
      qualityThreshold: 0.85,
    },
    {
      id: 'S-3',
      intent: 'forecast.q2',
      input: 'Forecast for next quarter',
      expectedOutcome:
        'forecast with confidence interval and backtest reference',
      qualityThreshold: 0.8,
    },
    {
      id: 'S-4',
      intent: 'crm.update',
      input: 'Move opportunity from PROPOSAL to NEGOTIATION',
      expectedOutcome:
        'governed transition requiring approval for stage change',
      qualityThreshold: 0.95,
    },
  ],
  budget: { dailyTokens: 300_000, dailyCostCents: 300 },
  channels: ['web', 'gmail', 'outlook'],
  lifecycle: { status: 'CERTIFIED', certifiedAt: '2026-08-02T00:00:00Z' },
  slo: { p95LatencyMs: 3000, availability: 0.99 },
  killSwitch: {
    flagKey: 'agent.oob.sales.killswitch',
    reason: 'Emergency stop for the sales OOTB agent',
  },
};
