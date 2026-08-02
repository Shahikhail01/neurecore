#!/usr/bin/env node
/**
 * seed-oob-agents.cjs — Phase 4 P4
 *
 * Idempotent seed of the 6 out-of-the-box (OOTB) role-based agents
 * declared by `creatio-parity-baseline.yaml` §Agents:
 *
 *   CR-AI-0501 UNIVERSAL
 *   CR-AI-0502 PRODUCTIVITY
 *   CR-AI-0503 SALES
 *   CR-AI-0504 MARKETING
 *   CR-AI-0505 SERVICE
 *   CR-AI-0506 KNOWLEDGE
 *
 * Each agent is materialised as:
 *   - one public `AgentTemplate` row (tenantId = null, isPublic = true)
 *   - one initial `AgentTemplateVersion` row (version pinned to the
 *     parity baseline) under the dedicated OOB platform-host tenant
 *   - one `AgentLifecycleAuditLog` row recording the seed
 *
 * The script is idempotent: re-running it changes nothing once the
 * rows exist. Existence is checked by (tenantId = null, name =
 * stableId) for templates and by (agentTemplateId, version) for
 * versions.
 *
 * Flags:
 *   --check    dry-run
 *   --verbose  log every row
 */

'use strict';

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.production');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// ─── OOB platform-host tenant constant ──────────────────────────────────
const OOB_PLATFORM_TENANT_ID = 'oob00000-0000-4000-8000-00000000oobb';
const OOB_PLATFORM_TENANT_SLUG = 'oob-platform';
const OOB_PLATFORM_TENANT_NAME = 'OOB Platform Seed';

// ─── Agent specs — mirror of backend/src/.../instances/*.agent.ts ──────
const AGENTS = [
  {
    stableId: 'CR-AI-0501',
    version: '1.0.0',
    type: 'CORE',
    purpose:
      'Default entry-point agent that routes supported requests to the right ' +
      'specialist agent (Productivity, Sales, Marketing, Service, Knowledge) ' +
      'and safely clarifies unsupported ones.',
    supportedIntents: ['universal.route', 'universal.clarify', 'universal.handoff', 'help.topics', 'help.listing'],
    skills: [
      { skillKey: 'universal.route', semanticVersion: '1.0.0', description: 'Deterministic intent classifier → specialist dispatch' },
      { skillKey: 'help.listing', semanticVersion: '1.0.0', description: 'Enumerates available agents, skills, and capabilities' },
    ],
    dataSources: [
      { kind: 'conversation_history', access: 'READ', tenantIsolated: true },
      { kind: 'user_profile', access: 'READ', tenantIsolated: true },
    ],
    toolCeiling: 'READ',
    approvalPolicy: 'NEVER',
    escalationOwner: 'tenant-owner',
    budget: { dailyTokens: 50000, dailyCostCents: 50 },
    channels: ['web'],
    slo: { p95LatencyMs: 1500, availability: 0.99 },
    killSwitch: { flagKey: 'agent.oob.universal.killswitch', reason: 'Emergency stop for the universal OOTB agent' },
  },
  {
    stableId: 'CR-AI-0502',
    version: '1.0.0',
    type: 'FUNCTIONAL',
    purpose:
      'Summarize records / threads / files, rewrite or change tone, translate, ' +
      'extract structured fields, draft emails and reports, and create scheduled tasks.',
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
    skills: [
      { skillKey: 'summarize', semanticVersion: '1.0.0', description: 'Faithful summary of a record, thread, or document' },
      { skillKey: 'rewrite', semanticVersion: '1.0.0', description: 'Reformulates along an axis (shorten, expand, tone)' },
      { skillKey: 'translate', semanticVersion: '1.0.0', description: 'Translates preserving entities / dates / currency' },
      { skillKey: 'extract', semanticVersion: '1.0.0', description: 'Extracts typed fields with confidence' },
      { skillKey: 'draft-report', semanticVersion: '1.0.0', description: 'Drafts a structured report' },
      { skillKey: 'draft-email', semanticVersion: '1.0.0', description: 'Drafts email — never sends without approval' },
      { skillKey: 'schedule-task', semanticVersion: '1.0.0', description: 'Creates a governed scheduled task via Work Runtime' },
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
    budget: { dailyTokens: 200000, dailyCostCents: 200 },
    channels: ['web', 'gmail', 'outlook'],
    slo: { p95LatencyMs: 2500, availability: 0.99 },
    killSwitch: { flagKey: 'agent.oob.productivity.killswitch', reason: 'Emergency stop for the productivity OOTB agent' },
  },
  {
    stableId: 'CR-AI-0503',
    version: '1.0.0',
    type: 'FUNCTIONAL',
    purpose:
      'Authorized account / contact / lead / opportunity research, lead ' +
      'qualification and predictive scoring, opportunity summary, pipeline-health ' +
      'and forecast signals, explainable next-best action, follow-up drafts, and ' +
      'governed CRM field updates via Work Runtime.',
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
    skills: [
      { skillKey: 'lead-score.predict', semanticVersion: '1.0.0', description: 'Predictive lead score via analytics provider' },
      { skillKey: 'opportunity-win.predict', semanticVersion: '1.0.0', description: 'Predictive opportunity win probability' },
      { skillKey: 'forecast.predict', semanticVersion: '1.0.0', description: 'Sales forecast with confidence interval' },
      { skillKey: 'pipeline-health.classify', semanticVersion: '1.0.0', description: 'Churn / inactivity / close-risk classification' },
      { skillKey: 'followup.draft', semanticVersion: '1.0.0', description: 'Personalized follow-up draft — never auto-sends' },
      { skillKey: 'crm.update.governed', semanticVersion: '1.0.0', description: 'Governed CRM field update via Work Runtime' },
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
    budget: { dailyTokens: 300000, dailyCostCents: 300 },
    channels: ['web', 'gmail', 'outlook'],
    slo: { p95LatencyMs: 3000, availability: 0.99 },
    killSwitch: { flagKey: 'agent.oob.sales.killswitch', reason: 'Emergency stop for the sales OOTB agent' },
  },
  {
    stableId: 'CR-AI-0504',
    version: '1.0.0',
    type: 'FUNCTIONAL',
    purpose:
      'Permission-aware audience segmentation, campaign brief and subject line ' +
      'variants, brand-voice email / landing-page drafts, campaign-response ' +
      'prediction, bounce categorization, and governed campaign draft via Work Runtime.',
    supportedIntents: [
      'marketing.segment',
      'marketing.campaign.brief',
      'marketing.email.draft',
      'marketing.email.variants',
      'marketing.brand.complianceCheck',
      'marketing.campaign.predict',
      'marketing.bounce.analyze',
    ],
    skills: [
      { skillKey: 'segment.audience', semanticVersion: '1.0.0', description: 'Permission-aware audience segmentation' },
      { skillKey: 'campaign-brief', semanticVersion: '1.0.0', description: 'Drafts campaign brief with themes and constraints' },
      { skillKey: 'email-draft', semanticVersion: '1.0.0', description: 'Drafts email/body with brand voice and forbidden phrases' },
      { skillKey: 'email-variants', semanticVersion: '1.0.0', description: 'Generates subject/preview/body variants' },
      { skillKey: 'campaign-response.predict', semanticVersion: '1.0.0', description: 'Predicts campaign response propensity' },
      { skillKey: 'bounce-analyze', semanticVersion: '1.0.0', description: 'Categorizes bounces, recommends remediation' },
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
    budget: { dailyTokens: 300000, dailyCostCents: 300 },
    channels: ['web', 'gmail', 'outlook'],
    slo: { p95LatencyMs: 3500, availability: 0.99 },
    killSwitch: { flagKey: 'agent.oob.marketing.killswitch', reason: 'Emergency stop for the marketing OOTB agent' },
  },
  {
    stableId: 'CR-AI-0505',
    version: '1.0.0',
    type: 'FUNCTIONAL',
    purpose:
      'Case summarization, classification, priority and urgency, sentiment and ' +
      'SLA-breach prediction, related-case discovery, cited knowledge resolution ' +
      'suggestions, response drafts, and governed assignment / status / notes / ' +
      'escalation / customer communication.',
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
    skills: [
      { skillKey: 'case-classify.predict', semanticVersion: '1.0.0', description: 'Predicts category, urgency, sentiment, SLA risk' },
      { skillKey: 'case-summarize', semanticVersion: '1.0.0', description: 'Summarizes case thread' },
      { skillKey: 'case-resolve', semanticVersion: '1.0.0', description: 'Resolution recommendation with citations' },
      { skillKey: 'case-response.draft', semanticVersion: '1.0.0', description: 'Drafts customer-facing response with approval' },
      { skillKey: 'case-escalate.recommend', semanticVersion: '1.0.0', description: 'Recommends escalation / re-routing' },
      { skillKey: 'case.assignment.governed', semanticVersion: '1.0.0', description: 'Governed case assignment, status, notes, escalation' },
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
    budget: { dailyTokens: 300000, dailyCostCents: 300 },
    channels: ['web', 'teams', 'outlook'],
    slo: { p95LatencyMs: 3000, availability: 0.99 },
    killSwitch: { flagKey: 'agent.oob.service.killswitch', reason: 'Emergency stop for the service OOTB agent' },
  },
  {
    stableId: 'CR-AI-0506',
    version: '1.0.0',
    type: 'FUNCTIONAL',
    purpose:
      'Grounded, citation-bearing answers to natural-language questions, article ' +
      'draft from a prompt or resolved case, and detection of gaps, duplicates, ' +
      'conflicts, and stale content. Always abstains when evidence is insufficient. ' +
      'Review and publication are governed.',
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
    skills: [
      { skillKey: 'grounded.answer', semanticVersion: '1.0.0', description: 'Permission-aware grounded answer with citations' },
      { skillKey: 'article-draft', semanticVersion: '1.0.0', description: 'Drafts a knowledge article from prompt or case' },
      { skillKey: 'gap.detect', semanticVersion: '1.0.0', description: 'Identifies content gaps from query patterns' },
      { skillKey: 'duplicate.detect', semanticVersion: '1.0.0', description: 'Detects duplicate or near-duplicate articles' },
      { skillKey: 'conflict.detect', semanticVersion: '1.0.0', description: 'Detects conflicting statements across articles' },
      { skillKey: 'stale.detect', semanticVersion: '1.0.0', description: 'Marks articles past their freshness window' },
      { skillKey: 'knowledge-publish.governed', semanticVersion: '1.0.0', description: 'Publishes an article via Work Runtime with required approval' },
    ],
    dataSources: [
      { kind: 'knowledge_article', access: 'READ', tenantIsolated: true },
      { kind: 'case', access: 'READ', tenantIsolated: true },
      { kind: 'conversation_history', access: 'READ', tenantIsolated: true },
    ],
    toolCeiling: 'INTERNAL_WRITE',
    approvalPolicy: 'ALWAYS',
    escalationOwner: 'knowledge-curator',
    budget: { dailyTokens: 250000, dailyCostCents: 250 },
    channels: ['web', 'teams'],
    slo: { p95LatencyMs: 3000, availability: 0.99 },
    killSwitch: { flagKey: 'agent.oob.knowledge.killswitch', reason: 'Emergency stop for the knowledge OOTB agent' },
  },
];

async function ensurePlatformTenant() {
  if (DRY_RUN) {
    if (VERBOSE) console.log(`  [DRY-RUN] ensure tenant ${OOB_PLATFORM_TENANT_ID}`);
    return;
  }
  const defaultTier = await prisma.tier.findFirst({ orderBy: { name: 'asc' } });
  if (!defaultTier) {
    throw new Error('No Tier row found; run tier seed (backfill-tier-system) first.');
  }
  await prisma.tenant.upsert({
    where: { id: OOB_PLATFORM_TENANT_ID },
    update: { name: OOB_PLATFORM_TENANT_NAME, slug: OOB_PLATFORM_TENANT_SLUG },
    create: {
      id: OOB_PLATFORM_TENANT_ID,
      name: OOB_PLATFORM_TENANT_NAME,
      slug: OOB_PLATFORM_TENANT_SLUG,
      tier: { connect: { id: defaultTier.id } },
    },
  });
  if (VERBOSE) console.log(`  upserted OOB platform tenant ${OOB_PLATFORM_TENANT_ID}`);
}

async function seedAgent(agent) {
  if (DRY_RUN) {
    if (VERBOSE) console.log(`  [DRY-RUN] would seed ${agent.stableId}@${agent.version}`);
    return { status: 'DRY_RUN' };
  }
  const template = await prisma.agentTemplate.findFirst({
    where: { tenantId: null, name: agent.stableId, isPublic: true },
  });
  let templateId = template?.id;
  if (!templateId) {
    const created = await prisma.agentTemplate.create({
      data: {
        tenantId: null,
        name: agent.stableId,
        description: agent.purpose,
        type: agent.type,
        model: 'gpt-4o-mini',
        systemPrompt: `You are ${agent.stableId} (${agent.type}). ${agent.purpose}`,
        instructions: agent.purpose,
        permissions: [],
        config: {
          parBaselineId: agent.stableId,
          type: agent.type,
          supportedIntents: agent.supportedIntents,
          dataSources: agent.dataSources,
          toolCeiling: agent.toolCeiling,
          approvalPolicy: agent.approvalPolicy,
          escalationOwner: agent.escalationOwner,
          channels: agent.channels,
          budget: agent.budget,
          slo: agent.slo,
          killSwitch: agent.killSwitch,
        },
        isPublic: true,
        version: agent.version,
        enabled: true,
      },
    });
    templateId = created.id;
    if (VERBOSE) console.log(`  created template ${agent.stableId} (${templateId})`);
  } else if (VERBOSE) {
    console.log(`  template ${agent.stableId} already exists (${templateId})`);
  }

  const existingVersion = await prisma.agentTemplateVersion.findFirst({
    where: { tenantId: OOB_PLATFORM_TENANT_ID, agentTemplateId: templateId, version: agent.version },
  });
  if (existingVersion) {
    if (VERBOSE) console.log(`  version ${agent.stableId}@${agent.version} already exists`);
    return { status: 'UNCHANGED', templateId, versionId: existingVersion.id };
  }
  const version = await prisma.agentTemplateVersion.create({
    data: {
      tenantId: OOB_PLATFORM_TENANT_ID,
      agentTemplateId: templateId,
      version: agent.version,
      definition: {
        purpose: agent.purpose,
        supportedIntents: agent.supportedIntents,
        skills: agent.skills,
        dataSources: agent.dataSources,
        toolCeiling: agent.toolCeiling,
        approvalPolicy: agent.approvalPolicy,
        escalationOwner: agent.escalationOwner,
        channels: agent.channels,
        budget: agent.budget,
        slo: agent.slo,
        killSwitch: agent.killSwitch,
        parBaselineId: agent.stableId,
      },
      composedSkillRefs: agent.skills.map((s) => `${s.skillKey}@${s.semanticVersion}`),
      maxEffect: 'READ',
      authorityCeiling: 0,
      budgetLimit: { dailyTokens: agent.budget.dailyTokens, dailyCostCents: agent.budget.dailyCostCents },
      channelBindings: agent.channels,
      certificationStatus: 'CERTIFIED',
      certifiedAt: new Date(),
      certifiedByActorId: 'system:oob-seed',
      lifecycleStatus: 'ACTIVE',
    },
  });
  await prisma.agentLifecycleAuditLog.create({
    data: {
      tenantId: OOB_PLATFORM_TENANT_ID,
      actorId: 'system:oob-seed',
      action: 'CREATE_OOB_VERSION',
      subjectType: 'TEMPLATE',
      subjectId: agent.stableId,
      previousState: {},
      newState: { version: agent.version, lifecycleStatus: 'ACTIVE' },
      reason: `Seeded OOB agent ${agent.stableId}@${agent.version} active by default`,
    },
  });
  if (VERBOSE) console.log(`  created ACTIVE version ${agent.stableId}@${agent.version} (${version.id})`);
  return { status: 'CREATED', templateId, versionId: version.id };
}

async function main() {
  console.log(
    `\n→ seed-oob-agents.cjs (Phase 4 P4 — OOTB role agents)` +
      (DRY_RUN ? ' [DRY RUN]' : '') +
      (VERBOSE ? ' [verbose]' : ''),
  );
  console.log(`  Agents: ${AGENTS.length}`);
  await ensurePlatformTenant();
  let created = 0;
  let unchanged = 0;
  for (const agent of AGENTS) {
    const r = await seedAgent(agent);
    if (r.status === 'CREATED') created++;
    else unchanged++;
  }
  console.log(`  created=${created} unchanged=${unchanged} total=${AGENTS.length}`);
}

main()
  .catch((err) => {
    console.error('seed-oob-agents.cjs failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
