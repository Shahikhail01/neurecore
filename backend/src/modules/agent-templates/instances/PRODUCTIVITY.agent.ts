/**
 * CR-AI-0502 — Productivity agent
 *
 * Summarize / rewrite / translate / change tone / extract / draft /
 * scheduled task creation. Mutations route through Work Runtime + Human
 * approval when the produced effect is INTERNAL_WRITE.
 */

import type { OotbAgentDefinition } from './UNIVERSAL.agent';

export const PRODUCTIVITY_AGENT_ID = 'CR-AI-0502';
export const PRODUCTIVITY_AGENT_VERSION = '1.0.0';

export const PRODUCTIVITY_AGENT: OotbAgentDefinition = {
  stableId: PRODUCTIVITY_AGENT_ID,
  version: PRODUCTIVITY_AGENT_VERSION,
  type: 'PRODUCTIVITY',
  purpose:
    'Summarize records / threads / files, rewrite or change tone, ' +
    'translate, extract structured fields, draft emails and reports, ' +
    'and create scheduled tasks. Mutations are governed; the LLM only ' +
    'drafts.',
  supportedIntents: [
    'productivity.summarize',
    'productivity.rewrite',
    'productivity.translate',
    'productivity.changeTone',
    'productivity.extract',
    'productivity.compare',
    'productivity.draftReport',
    'productivity.draftEmail',
    'productivity.scheduleTask',
  ],
  unsupportedIntents: [
    'productivity.sendEmailWithoutApproval',
    'productivity.modifyBilling',
  ],
  skills: [
    {
      skillKey: 'summarize',
      semanticVersion: '1.0.0',
      description: 'Faithful summary of a record, thread, or document',
    },
    {
      skillKey: 'rewrite',
      semanticVersion: '1.0.0',
      description: 'Reformulates along an axis (shorten, expand, tone)',
    },
    {
      skillKey: 'translate',
      semanticVersion: '1.0.0',
      description: 'Translates preserving entities / dates / currency',
    },
    {
      skillKey: 'extract',
      semanticVersion: '1.0.0',
      description: 'Extracts typed fields with confidence',
    },
    {
      skillKey: 'draft-report',
      semanticVersion: '1.0.0',
      description: 'Drafts a structured report',
    },
    {
      skillKey: 'draft-email',
      semanticVersion: '1.0.0',
      description: 'Drafts email — never sends without approval',
    },
    {
      skillKey: 'schedule-task',
      semanticVersion: '1.0.0',
      description: 'Creates a governed scheduled task via Work Runtime',
    },
  ],
  dataSources: [
    { kind: 'crm_account', access: 'READ', tenantIsolated: true },
    { kind: 'crm_contact', access: 'READ', tenantIsolated: true },
    { kind: 'knowledge_article', access: 'READ', tenantIsolated: true },
    { kind: 'user_profile', access: 'READ', tenantIsolated: true },
  ],
  toolCeiling: 'INTERNAL_WRITE',
  approvalPolicy: 'OPTIONAL',
  escalationOwner: 'tenant-owner',
  evaluationSet: [
    {
      id: 'P-1',
      intent: 'summarize.account',
      input: 'Summarize the top opportunities for Acme Corp',
      expectedOutcome:
        'summary with cited opportunities, no fabricated IDs, locale preserved',
      qualityThreshold: 0.9,
    },
    {
      id: 'P-2',
      intent: 'translate.thread',
      input: 'Translate this email thread to French',
      expectedOutcome: 'translation preserving entities, dates, currency',
      qualityThreshold: 0.95,
    },
    {
      id: 'P-3',
      intent: 'draft.email',
      input: 'Draft a follow-up email to John',
      expectedOutcome:
        'email draft with action item, no auto-send, approval flag set',
      qualityThreshold: 0.9,
    },
  ],
  budget: { dailyTokens: 200_000, dailyCostCents: 200 },
  channels: ['web', 'gmail', 'outlook'],
  lifecycle: { status: 'CERTIFIED', certifiedAt: '2026-08-02T00:00:00Z' },
  slo: { p95LatencyMs: 2500, availability: 0.99 },
  killSwitch: {
    flagKey: 'agent.oob.productivity.killswitch',
    reason: 'Emergency stop for the productivity OOTB agent',
  },
};
