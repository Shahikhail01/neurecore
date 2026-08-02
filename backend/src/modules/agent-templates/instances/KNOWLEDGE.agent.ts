/**
 * CR-AI-0506 — Knowledge agent
 *
 * Grounded answers, article drafting, gap / duplicate / conflict /
 * staleness detection, governed publication. Always cites authorized
 * sources; abstains when evidence is insufficient.
 */

import type { OotbAgentDefinition } from './UNIVERSAL.agent';

export const KNOWLEDGE_AGENT_ID = 'CR-AI-0506';
export const KNOWLEDGE_AGENT_VERSION = '1.0.0';

export const KNOWLEDGE_AGENT: OotbAgentDefinition = {
  stableId: KNOWLEDGE_AGENT_ID,
  version: KNOWLEDGE_AGENT_VERSION,
  type: 'KNOWLEDGE',
  purpose:
    'Grounded, citation-bearing answers to natural-language questions, ' +
    'article draft from a prompt or resolved case, and detection of ' +
    'gaps, duplicates, conflicts, and stale content. Always abstains ' +
    'when evidence is insufficient. Review and publication are governed.',
  supportedIntents: [
    'knowledge.groundedAnswer',
    'knowledge.articleDraft',
    'knowledge.gap.detect',
    'knowledge.duplicate.detect',
    'knowledge.conflict.detect',
    'knowledge.stale.detect',
    'knowledge.updateRecommendation',
    'knowledge.publish.governed',
  ],
  unsupportedIntents: [
    'knowledge.publishWithoutReview',
    'knowledge.retrieveForbiddenSource',
    'knowledge.bypassCitations',
  ],
  skills: [
    {
      skillKey: 'grounded.answer',
      semanticVersion: '1.0.0',
      description: 'Permission-aware grounded answer with citations',
    },
    {
      skillKey: 'article-draft',
      semanticVersion: '1.0.0',
      description: 'Drafts a knowledge article from prompt or case',
    },
    {
      skillKey: 'gap.detect',
      semanticVersion: '1.0.0',
      description: 'Identifies content gaps from query patterns',
    },
    {
      skillKey: 'duplicate.detect',
      semanticVersion: '1.0.0',
      description: 'Detects duplicate or near-duplicate articles',
    },
    {
      skillKey: 'conflict.detect',
      semanticVersion: '1.0.0',
      description: 'Detects conflicting statements across articles',
    },
    {
      skillKey: 'stale.detect',
      semanticVersion: '1.0.0',
      description: 'Marks articles past their freshness window',
    },
    {
      skillKey: 'knowledge-publish.governed',
      semanticVersion: '1.0.0',
      description:
        'Publishes an article via Work Runtime with required approval',
    },
  ],
  dataSources: [
    { kind: 'knowledge_article', access: 'READ', tenantIsolated: true },
    { kind: 'case', access: 'READ', tenantIsolated: true },
    { kind: 'conversation_history', access: 'READ', tenantIsolated: true },
  ],
  toolCeiling: 'INTERNAL_WRITE',
  approvalPolicy: 'ALWAYS',
  escalationOwner: 'knowledge-curator',
  evaluationSet: [
    {
      id: 'K-1',
      intent: 'grounded.answer',
      input: 'What is our password reset policy?',
      expectedOutcome: 'cited answer or abstention with reason',
      qualityThreshold: 0.95,
    },
    {
      id: 'K-2',
      intent: 'article.draft',
      input: 'Draft an article from this resolved case',
      expectedOutcome: 'article draft, never auto-published, requires review',
      qualityThreshold: 0.85,
    },
    {
      id: 'K-3',
      intent: 'stale.detect',
      input: 'Are any onboarding articles past freshness?',
      expectedOutcome: 'list with last-updated timestamps',
      qualityThreshold: 0.9,
    },
  ],
  budget: { dailyTokens: 250_000, dailyCostCents: 250 },
  channels: ['web', 'teams'],
  lifecycle: { status: 'CERTIFIED', certifiedAt: '2026-08-02T00:00:00Z' },
  slo: { p95LatencyMs: 3000, availability: 0.99 },
  killSwitch: {
    flagKey: 'agent.oob.knowledge.killswitch',
    reason: 'Emergency stop for the knowledge OOTB agent',
  },
};
