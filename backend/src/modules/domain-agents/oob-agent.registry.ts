/**
 * Domain Agents — Single Canonical Registry.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.6 (10 sales),
 * §5.7 (5 marketing), §5.8 (5 service), §5.15 (5 workflow),
 * §5.13 (universal).
 *
 * Solid:
 *   • SRP — only the registry. Each agent's runtime behaviour lives
 *     in `agents/<kind>.ts`; the registry composes them.
 *   • OCP — adding a new OOB agent = new entry here + new file under
 *     `agents/`. No other module changes.
 *   • DRY — every definition in this file is the single source of
 *     truth; no per-feature redefinition.
 */

import { DomainAgentKind } from '@prisma/client';

export type DomainGroup =
  | 'sales'
  | 'marketing'
  | 'service'
  | 'workflow'
  | 'universal';

export interface OobAgentSpec {
  kind: DomainAgentKind;
  slug: string;
  displayName: string;
  shortName: string;
  description: string;
  domain: DomainGroup;
  planSection: string;
  reads: string[];
  writes: string[];
  // Risk tier 1..5. The phase-1 HITL policy engine consumes this.
  riskTier: 1 | 2 | 3 | 4 | 5;
  // Capabilities required for the agent to execute. Used by the runtime
  // gate (Phase 5) to refuse execution if the actor's twin/session
  // doesn't grant the scope.
  requiredScopes: string[];
}

export const OOB_AGENT_REGISTRY: ReadonlyArray<OobAgentSpec> = [
  // ─── Sales (§5.6) ────────────────────────────────────────────────────
  {
    kind: DomainAgentKind.SALES_ACCOUNT_RESEARCH,
    slug: 'sales-account-research',
    displayName: 'Account Research Agent',
    shortName: 'Account Research',
    description:
      'Gathers public + CRM-sourced intelligence about a target account; produces a one-pager brief.',
    domain: 'sales',
    planSection: '5.6.1',
    reads: ['crm.read.contacts', 'crm.read.deals', 'crm.read.accounts', 'knowledge.search'],
    writes: ['crm.write.deals.notes'],
    riskTier: 1,
    requiredScopes: ['crm.read.contacts'],
  },
  {
    kind: DomainAgentKind.SALES_QUOTE_GENERATION,
    slug: 'sales-quote-generation',
    displayName: 'Quote Generation Agent',
    shortName: 'Quote Gen',
    description:
      'Generates a draft quote from the configured catalog + discount ladder; never sends it.',
    domain: 'sales',
    planSection: '5.6.2',
    reads: ['crm.read.deals', 'catalog.read.products'],
    writes: ['crm.write.quotes.draft'],
    riskTier: 3,
    requiredScopes: ['crm.read.deals', 'crm.write.quotes.draft'],
  },
  {
    kind: DomainAgentKind.SALES_MEETING_PREPARATION,
    slug: 'sales-meeting-prep',
    displayName: 'Meeting Preparation Agent',
    shortName: 'Meeting Prep',
    description:
      'Pre-read digest + suggested talking points + open-deal summary before a meeting.',
    domain: 'sales',
    planSection: '5.6.3',
    reads: ['crm.read.contacts', 'crm.read.deals', 'crm.read.activities'],
    writes: ['crm.write.activities'],
    riskTier: 1,
    requiredScopes: ['crm.read.deals'],
  },
  {
    kind: DomainAgentKind.SALES_MS_TEAMS,
    slug: 'sales-ms-teams',
    displayName: 'MS Teams Sales Agent',
    shortName: 'Teams',
    description:
      'Sells from inside Microsoft Teams. Reads/updates CRM records from chat. Phase 5 dependency: MS Teams connector.',
    domain: 'sales',
    planSection: '5.6.4',
    reads: ['crm.read.contacts', 'crm.read.deals'],
    writes: ['crm.write.tasks', 'chat.send'],
    riskTier: 2,
    requiredScopes: ['crm.read.deals', 'chat.send'],
  },
  {
    kind: DomainAgentKind.SALES_MS_OUTLOOK,
    slug: 'sales-ms-outlook',
    displayName: 'MS Outlook Sales Agent',
    shortName: 'Outlook',
    description:
      'Smarter inbox — triages replies, drafts follow-ups, syncs to CRM.',
    domain: 'sales',
    planSection: '5.6.5',
    reads: ['crm.read.contacts', 'crm.read.deals', 'mail.read'],
    writes: ['crm.write.activities', 'mail.draft'],
    riskTier: 3,
    requiredScopes: ['mail.read', 'mail.draft', 'crm.read.deals'],
  },
  {
    kind: DomainAgentKind.SALES_FORECAST,
    slug: 'sales-forecast',
    displayName: 'Sales Forecast Agent',
    shortName: 'Forecast',
    description:
      'Generates a deal-stage-aware forecast with confidence intervals.',
    domain: 'sales',
    planSection: '5.6.6',
    reads: ['crm.read.deals', 'crm.read.activities'],
    writes: ['forecast.write'],
    riskTier: 2,
    requiredScopes: ['crm.read.deals'],
  },
  {
    kind: DomainAgentKind.SALES_TERRITORY_MANAGEMENT,
    slug: 'sales-territory-mgmt',
    displayName: 'Territory Management Agent',
    shortName: 'Territory',
    description:
      'Reassigns leads between reps based on workload, capacity, and skill match.',
    domain: 'sales',
    planSection: '5.6.7',
    reads: ['crm.read.contacts', 'crm.read.users'],
    writes: ['crm.write.contacts.owner'],
    riskTier: 3,
    requiredScopes: ['crm.write.contacts.owner'],
  },
  {
    kind: DomainAgentKind.SALES_NEXT_BEST_STEP,
    slug: 'sales-next-best-step',
    displayName: 'Next Best Step Agent',
    shortName: 'Next Step',
    description:
      'Recommends the next action for a deal: call / email / meeting / drop.',
    domain: 'sales',
    planSection: '5.6.8',
    reads: ['crm.read.deals', 'crm.read.activities'],
    writes: ['crm.write.activities'],
    riskTier: 1,
    requiredScopes: ['crm.read.deals'],
  },
  {
    kind: DomainAgentKind.SALES_ORDER_FULFILLMENT,
    slug: 'sales-order-fulfillment',
    displayName: 'Order Fulfillment Agent',
    shortName: 'Order Fulfillment',
    description:
      'Converts an accepted quote to an order; updates ERP via the ERP connector.',
    domain: 'sales',
    planSection: '5.6.9',
    reads: ['crm.read.quotes'],
    writes: ['erp.write.orders', 'crm.write.deals.stage'],
    riskTier: 4,
    requiredScopes: ['erp.write.orders'],
  },
  {
    kind: DomainAgentKind.SALES_CRM_DATA_UPDATE,
    slug: 'sales-crm-data-update',
    displayName: 'CRM Data Update Agent',
    shortName: 'CRM Hygiene',
    description:
      'Detects and normalises stale / inconsistent CRM data; requires human approval before any merge.',
    domain: 'sales',
    planSection: '5.6.10',
    reads: ['crm.read.contacts', 'crm.read.deals'],
    writes: ['crm.write.contacts.merge'],
    riskTier: 4,
    requiredScopes: ['crm.write.contacts.merge'],
  },
  // ─── Marketing (§5.7) ───────────────────────────────────────────────
  {
    kind: DomainAgentKind.MARKETING_CONTENT,
    slug: 'marketing-content',
    displayName: 'Marketing Content Agent',
    shortName: 'Content',
    description:
      'Generates landing-page copy, blog drafts, social posts in the brand voice.',
    domain: 'marketing',
    planSection: '5.7.1',
    reads: ['knowledge.search', 'brand.voice'],
    writes: ['content.write.draft'],
    riskTier: 1,
    requiredScopes: ['content.write.draft'],
  },
  {
    kind: DomainAgentKind.MARKETING_EMAIL_GENERATION,
    slug: 'marketing-email',
    displayName: 'Email Generation Agent',
    shortName: 'Email Gen',
    description:
      'Drafts marketing emails (subject + body) personalised by segment. Send requires approval.',
    domain: 'marketing',
    planSection: '5.7.2',
    reads: ['crm.read.contacts', 'segment.read'],
    writes: ['mail.draft', 'crm.write.activities'],
    riskTier: 2,
    requiredScopes: ['mail.draft'],
  },
  {
    kind: DomainAgentKind.MARKETING_CAMPAIGN,
    slug: 'marketing-campaign',
    displayName: 'Campaign Agent',
    shortName: 'Campaign',
    description:
      'Orchestrates end-to-end campaigns across email + landing-page + analytics.',
    domain: 'marketing',
    planSection: '5.7.3',
    reads: ['campaign.read', 'analytics.read'],
    writes: ['campaign.write.draft', 'mail.draft', 'content.write.draft'],
    riskTier: 3,
    requiredScopes: ['campaign.write.draft'],
  },
  {
    kind: DomainAgentKind.MARKETING_LEAD_SCORING,
    slug: 'marketing-lead-scoring',
    displayName: 'Marketing Lead Scoring Agent',
    shortName: 'Lead Score',
    description:
      'Marketing-tuned variant of the Lead Scoring agent. Sends leads to the Lead Distribution Agent.',
    domain: 'marketing',
    planSection: '5.7.4',
    reads: ['crm.read.contacts', 'analytics.read'],
    writes: ['crm.write.contacts.score'],
    riskTier: 2,
    requiredScopes: ['crm.write.contacts.score'],
  },
  {
    kind: DomainAgentKind.MARKETING_LEAD_DISTRIBUTION,
    slug: 'marketing-lead-distribution',
    displayName: 'Lead Distribution Agent',
    shortName: 'Lead Distribution',
    description:
      'Routes marketing-qualified leads to the right sales rep / territory / queue.',
    domain: 'marketing',
    planSection: '5.7.5',
    reads: ['crm.read.contacts', 'crm.read.users', 'crm.read.territories'],
    writes: ['crm.write.contacts.owner', 'queue.write'],
    riskTier: 3,
    requiredScopes: ['crm.write.contacts.owner'],
  },
  // ─── Service (§5.8) ────────────────────────────────────────────────
  {
    kind: DomainAgentKind.SERVICE_CASE_RESOLUTION,
    slug: 'service-case-resolution',
    displayName: 'Case Resolution Agent',
    shortName: 'Case Resolution',
    description:
      'Resolves a support case end-to-end (read KB, draft reply, request approval).',
    domain: 'service',
    planSection: '5.8.1',
    reads: ['crm.read.cases', 'knowledge.search'],
    writes: ['crm.write.cases.draft', 'mail.draft'],
    riskTier: 3,
    requiredScopes: ['crm.read.cases'],
  },
  {
    kind: DomainAgentKind.SERVICE_KNOWLEDGE_BASE,
    slug: 'service-kb',
    displayName: 'Knowledge Base Agent',
    shortName: 'KB',
    description:
      'Indexes articles, drafts new ones from resolved cases, suggests gaps.',
    domain: 'service',
    planSection: '5.8.2',
    reads: ['knowledge.read'],
    writes: ['knowledge.write.draft'],
    riskTier: 2,
    requiredScopes: ['knowledge.write.draft'],
  },
  {
    kind: DomainAgentKind.SERVICE_CASE_CLASSIFICATION,
    slug: 'service-case-classification',
    displayName: 'Case Classification Agent',
    shortName: 'Classify',
    description:
      'Routes incoming cases to the right queue, priority, and owner.',
    domain: 'service',
    planSection: '5.8.3',
    reads: ['crm.read.cases'],
    writes: ['crm.write.cases.classify'],
    riskTier: 2,
    requiredScopes: ['crm.write.cases.classify'],
  },
  {
    kind: DomainAgentKind.SERVICE_PLAYBOOK,
    slug: 'service-playbook',
    displayName: 'Service Playbook Agent',
    shortName: 'Playbook',
    description:
      'Walks a service rep through the right next step based on case type and SLA.',
    domain: 'service',
    planSection: '5.8.4',
    reads: ['crm.read.cases', 'knowledge.search', 'playbook.read'],
    writes: ['crm.write.activities'],
    riskTier: 1,
    requiredScopes: ['crm.read.cases'],
  },
  {
    kind: DomainAgentKind.SERVICE_NEXT_BEST_ACTION,
    slug: 'service-next-best-action',
    displayName: 'Service Next Best Action Agent',
    shortName: 'Service NBA',
    description:
      'Service-tuned variant of the Next Best Step agent. Operates on cases, not deals.',
    domain: 'service',
    planSection: '5.8.5',
    reads: ['crm.read.cases', 'crm.read.activities'],
    writes: ['crm.write.activities'],
    riskTier: 1,
    requiredScopes: ['crm.read.cases'],
  },
  // ─── Workflow / Productivity (§5.15) ───────────────────────────────
  {
    kind: DomainAgentKind.WORKFLOW_CONTENT_PREPARATION,
    slug: 'workflow-content-prep',
    displayName: 'Content Preparation Agent',
    shortName: 'Content Prep',
    description:
      'Turns a brief into a first draft in the user\'s preferred format.',
    domain: 'workflow',
    planSection: '5.15.1',
    reads: ['knowledge.search', 'brand.voice'],
    writes: ['content.write.draft'],
    riskTier: 1,
    requiredScopes: ['content.write.draft'],
  },
  {
    kind: DomainAgentKind.WORKFLOW_CONTENT_LOCALIZATION,
    slug: 'workflow-content-localization',
    displayName: 'Content Localization Agent',
    shortName: 'Localization',
    description:
      'Translates + adapts a piece of content for a target locale and tone.',
    domain: 'workflow',
    planSection: '5.15.2',
    reads: ['content.read'],
    writes: ['content.write.draft'],
    riskTier: 1,
    requiredScopes: ['content.write.draft'],
  },
  {
    kind: DomainAgentKind.WORKFLOW_MEETING_MANAGEMENT,
    slug: 'workflow-meeting-mgmt',
    displayName: 'Meeting Management Agent',
    shortName: 'Meeting Mgmt',
    description:
      'Schedules, summarises, and follows up on meetings via calendar + mail.',
    domain: 'workflow',
    planSection: '5.15.3',
    reads: ['calendar.read', 'mail.read', 'crm.read.activities'],
    writes: ['calendar.write', 'mail.draft', 'crm.write.activities'],
    riskTier: 2,
    requiredScopes: ['calendar.write'],
  },
  {
    kind: DomainAgentKind.WORKFLOW_ACTIVITY_SUMMARY,
    slug: 'workflow-activity-summary',
    displayName: 'Activity Summary Agent',
    shortName: 'Summary',
    description:
      'Summarises recent activity on a customer / case / deal at any cadence.',
    domain: 'workflow',
    planSection: '5.15.4',
    reads: ['crm.read.activities', 'mail.read', 'chat.read'],
    writes: ['summary.write.draft'],
    riskTier: 1,
    requiredScopes: ['summary.write.draft'],
  },
  {
    kind: DomainAgentKind.WORKFLOW_COMMUNICATION_TEMPLATE,
    slug: 'workflow-comm-template',
    displayName: 'Communication Template Agent',
    shortName: 'Comm Template',
    description:
      'Generates + maintains reusable message templates (response library).',
    domain: 'workflow',
    planSection: '5.15.5',
    reads: ['template.read'],
    writes: ['template.write'],
    riskTier: 1,
    requiredScopes: ['template.write'],
  },
  // ─── Universal ────────────────────────────────────────────────────
  {
    kind: DomainAgentKind.UNIVERSAL_GENERIC,
    slug: 'universal-generic',
    displayName: 'Universal Generic Agent',
    shortName: 'Universal',
    description:
      'Default catch-all for custom prompts that do not match any specialised OOB agent.',
    domain: 'universal',
    planSection: '5.13',
    reads: [],
    writes: [],
    riskTier: 2,
    requiredScopes: [],
  },
];

export function findOobAgent(kind: DomainAgentKind): OobAgentSpec | null {
  return OOB_AGENT_REGISTRY.find((a) => a.kind === kind) ?? null;
}

export function findOobAgentBySlug(slug: string): OobAgentSpec | null {
  return OOB_AGENT_REGISTRY.find((a) => a.slug === slug) ?? null;
}

export function listOobAgentsByDomain(domain: DomainGroup): OobAgentSpec[] {
  return OOB_AGENT_REGISTRY.filter((a) => a.domain === domain);
}
