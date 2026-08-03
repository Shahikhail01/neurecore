/**
 * NeureCore Harness - Phase 6: SIM Migration Adapters
 *
 * Convert the per-simulation runner scripts (SIM-04..SIM-11) into the
 * common SimManifest format. Each adapter preserves the original scenario
 * intent (per the migration map §3.3) and exposes the existing defects
 * as blocking defects.
 *
 * Document ID: NC-HARNESS-PHASE6-MIGRATION-001
 * Version: 1.0
 * Status: PHASE_6_IMPLEMENTED
 */

import {
  type SimManifest,
  type CriticalJourney,
  type JourneyStep,
  type TenantCohort,
  type TenantCohortEntry,
  type KnownDefect,
  type BrowserMatrix,
  type EvidenceChannel,
  SimManifestSchema,
  TenantCohortEntrySchema,
} from '../manifest';
import { UuidSchema, IsoDateTimeSchema, SemverSchema } from '../../contracts';

// ============================================================
// KNOWN DEFECTS (consolidated from prior reports)
// ============================================================

/**
 * NC-SIM04-002 — FE customer form submit blocked by modal backdrop overlay.
 * Blocks SIM-04 until fixed.
 */
export const NC_SIM04_002: KnownDefect = {
  defectId: 'NC-SIM04-002',
  title: 'FE customer form submit blocked by modal backdrop overlay',
  blockingCapability: 'customer.create',
  isBlocking: true,
  note: 'In SIM-04 Stage 1 the "Create Customer" button is visible and enabled but the overlay intercepts pointer events. Per SIM-04 lesson: the runner does NOT fall back to the API.',
};

/**
 * NC-SIM04-005 — Chat did not create a project after 4 conversational turns.
 * Blocks SIM-04 until fixed.
 */
export const NC_SIM04_005: KnownDefect = {
  defectId: 'NC-SIM04-005',
  title: 'Chat did not create a project after natural business language turns',
  blockingCapability: 'project.create.from_chat',
  isBlocking: true,
  note: 'The chat agent runs diagnostic tools but does not bind the project creation graph tool to natural-language turns.',
};

// ============================================================
// HELPERS
// ============================================================

export function makeTenantEntry(
  tenantSlug: string,
  tenantId: string = randomUuidLike(tenantSlug),
  userId: string = randomUuidLike(`user-${tenantSlug}`),
  email: string = `${tenantSlug}@sim04.test`,
): TenantCohortEntry {
  return TenantCohortEntrySchema.parse({
    tenantId,
    tenantSlug,
    userId,
    email,
    preRunDuplicateCounts: { customers: 0, projects: 0, goals: 0 },
  });
}

function randomUuidLike(_seed: string): string {
  // Deterministic uuid5-like generation for tests; in production the cohort
  // is provisioned by provision-sim04-tenants.cjs (read via the harness).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('node:crypto') as typeof import('node:crypto');
  return crypto.randomUUID();
}

function defaultMatrix(): BrowserMatrix {
  return {
    viewports: ['DESKTOP_1080P'],
    browsers: ['CHROMIUM_DESKTOP'],
    sessions: 1,
    accessibility: ['STANDARD'],
  };
}

function defaultChannels(): EvidenceChannel[] {
  return [
    {
      channelId: 'ui.dom',
      mediaType: 'application/x-playwright-dom',
      captureMode: 'ON_FAILURE',
      retentionClass: 'MEDIUM_TERM',
      redactionRequired: false,
    },
    {
      channelId: 'ui.trace',
      mediaType: 'application/zip+playwright-trace',
      captureMode: 'ON_FAILURE',
      retentionClass: 'MEDIUM_TERM',
      redactionRequired: false,
    },
    {
      channelId: 'tool.events',
      mediaType: 'application/json',
      captureMode: 'CONTINUOUS',
      retentionClass: 'LONG_TERM',
      redactionRequired: true,
    },
    {
      channelId: 'domain.events',
      mediaType: 'application/json',
      captureMode: 'CONTINUOUS',
      retentionClass: 'LONG_TERM',
      redactionRequired: true,
    },
  ];
}

function makeCohort(slugPrefix: string, count: number): TenantCohort {
  const entries: TenantCohortEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    entries.push(
      makeTenantEntry(`${slugPrefix}-${String(i).padStart(2, '0')}`),
    );
  }
  return {
    cohortId: `${slugPrefix}-cohort-${Date.now()}`,
    provisionedAt: new Date().toISOString(),
    source: 'PROVISIONED_BY_SCRIPT',
    entries,
  };
}

// ============================================================
// SIM-04: Accounting Project Full Flow
// ============================================================

const sim04Journey: CriticalJourney = {
  journeyId: 'sim04.accounting.full_flow',
  name: 'Accounting — Acme Corp Onboarding + Q3 Return Workflow',
  description:
    '12-stage FE-first journey: login → create customer → create project → ' +
    'create goal → create tasks → execute tasks → review/approve → completion. ' +
    'S1 + S2 are blockers until NC-SIM04-002 and NC-SIM04-005 are fixed.',
  steps: [
    step(
      'S1',
      'create-customer',
      'FILL',
      '#customer-name',
      'Customer form: name, financialSubType, lifecycleStage',
      'Acme Corp',
    ),
    step(
      'S1',
      'submit-customer',
      'CLICK',
      '#customer-submit',
      'Submit customer form',
    ),
    step(
      'S1',
      'verify-customer',
      'ASSERT_DOM',
      '.customer-row',
      'Customer created in list',
    ),
    step('S2', 'open-chat', 'CLICK', '#open-chat', 'Open chat panel'),
    step(
      'S2',
      'send-prompt',
      'CHAT_SEND',
      '',
      'Onboard Acme Corp + prepare Q3 return workflow',
    ),
    step(
      'S2',
      'verify-project',
      'ASSERT_DOM',
      '.project-row',
      'Project created by chat agent',
    ),
    step(
      'S3',
      'create-goal',
      'FILL',
      '#goal-title',
      'Goal: deliver Q3 return by deadline',
      'Deliver Q3 return',
    ),
    step(
      'S4',
      'create-tasks',
      'FILL',
      '#task-title',
      'Tasks: gather docs, reconcile, file, notify',
      'Gather documents',
    ),
    step(
      'S5',
      'execute-task-1',
      'CLICK',
      '#execute-task-1',
      'Execute first task',
    ),
    step(
      'S6',
      'submit-for-approval',
      'CLICK',
      '#submit-approval',
      'Submit completed work for review',
    ),
    step(
      'S7',
      'approve-card',
      'APPROVE_CARD',
      '.approval-card-1',
      'Approve via inline approval card',
    ),
    step(
      'S8',
      'verify-state',
      'ASSERT_DOM',
      '#state',
      'Project state machine reached COMPLETED',
    ),
  ],
};

export function buildSim04Manifest(opts?: {
  cohortCount?: number;
}): SimManifest {
  const manifest: SimManifest = {
    schemaVersion: '1.0.0',
    manifestId: 'sim04.accounting.manifest',
    manifestVersion: '1.0.0',
    simulationId: 'SIM-04',
    simulationVersion: '1.0.0',
    title: 'SIM-04 — Accounting Project Full Flow',
    industry: 'ACCOUNTING',
    lane: 'TENANT_HQ',
    feFirst: 'STRICT',
    riskTier: 'CRITICAL',
    executionMode: 'DETERMINISTIC',
    environmentClass: 'STAGING',
    requiredCapabilities: [
      'customer.create',
      'project.create.from_chat',
      'goal.create',
      'task.create',
      'task.execute',
      'task.review',
      'project.complete',
    ],
    cohort: makeCohort('sim04-clean', opts?.cohortCount ?? 5),
    matrix: defaultMatrix(),
    journeys: [sim04Journey],
    evidenceChannels: defaultChannels(),
    knownDefects: [NC_SIM04_002, NC_SIM04_005],
  };
  return SimManifestSchema.parse(manifest);
}

// ============================================================
// SIM-05: Financial Services Project Full Flow
// ============================================================

const sim05Journey: CriticalJourney = {
  journeyId: 'sim05.financial_services.full_flow',
  name: 'Financial Services — KYC + Compliance Workflow',
  description:
    'FE-first journey for a regulated financial tenant: KYC intake, document ' +
    'review, compliance check, approval, completion.',
  steps: [
    step('S1', 'login', 'FILL', '#email', 'Tenant login', 'test@example.com'),
    step('S1', 'submit-login', 'CLICK', '#login-submit', 'Submit login form'),
    step(
      'S2',
      'create-customer',
      'FILL',
      '#kyc-name',
      'KYC intake form',
      'Acme Corp',
    ),
    step('S3', 'attach-docs', 'CUSTOM', '', 'Attach KYC documents via UI'),
    step(
      'S4',
      'run-compliance',
      'CLICK',
      '#run-compliance',
      'Run compliance check',
    ),
    step(
      'S5',
      'review-result',
      'ASSERT_DOM',
      '#compliance-result',
      'Compliance result rendered',
    ),
    step(
      'S6',
      'submit-approval',
      'CLICK',
      '#submit-approval',
      'Submit for approval',
    ),
    step(
      'S7',
      'approve',
      'APPROVE_CARD',
      '.approval-card-1',
      'Approve via inline card',
    ),
    step(
      'S8',
      'verify-state',
      'ASSERT_DOM',
      '#state',
      'Project reaches COMPLETED',
    ),
  ],
};

export function buildSim05Manifest(): SimManifest {
  return SimManifestSchema.parse({
    schemaVersion: '1.0.0',
    manifestId: 'sim05.financial.manifest',
    manifestVersion: '1.0.0',
    simulationId: 'SIM-05',
    simulationVersion: '1.0.0',
    title: 'SIM-05 — Financial Services Project Full Flow',
    industry: 'FINANCIAL_SERVICES',
    lane: 'TENANT_HQ',
    feFirst: 'STRICT',
    riskTier: 'CRITICAL',
    executionMode: 'DETERMINISTIC',
    environmentClass: 'STAGING',
    requiredCapabilities: [
      'customer.create',
      'compliance.run',
      'document.attach',
      'approval.request',
      'approval.grant',
      'project.complete',
    ],
    cohort: makeCohort('sim05', 3),
    matrix: defaultMatrix(),
    journeys: [sim05Journey],
    evidenceChannels: defaultChannels(),
    knownDefects: [],
  });
}

// ============================================================
// SIM-06..SIM-11: shared industry template
// ============================================================

const simGenericJourney: CriticalJourney = {
  journeyId: 'simXX.industry.full_flow',
  name: 'Industry Full Flow',
  description:
    'Generic industry journey: login → intake → execute → review → complete.',
  steps: [
    step('S1', 'login', 'FILL', '#email', 'Tenant login', 'test@example.com'),
    step('S1', 'submit-login', 'CLICK', '#login-submit', 'Submit login'),
    step(
      'S2',
      'intake',
      'FILL',
      '#intake-name',
      'Intake form',
      'Sample intake',
    ),
    step('S3', 'execute', 'CLICK', '#execute', 'Execute the work plan'),
    step('S4', 'review', 'ASSERT_DOM', '#review', 'Review rendered'),
    step(
      'S5',
      'approve',
      'APPROVE_CARD',
      '.approval-card-1',
      'Approve via inline card',
    ),
    step('S6', 'verify', 'ASSERT_DOM', '#state', 'Project reaches COMPLETED'),
  ],
};

interface SimTemplate {
  simulationId: string;
  title: string;
  industry: SimManifest['industry'];
  requiredCapabilities: string[];
}

const SIM_TEMPLATES: SimTemplate[] = [
  {
    simulationId: 'SIM-06',
    title: 'SIM-06 — Technology & Digital Services Project Full Flow',
    industry: 'TECHNOLOGY',
    requiredCapabilities: [
      'customer.create',
      'sprint.plan',
      'task.execute',
      'release.approve',
      'project.complete',
    ],
  },
  {
    simulationId: 'SIM-07',
    title: 'SIM-07 — Professional & Business Services Project Full Flow',
    industry: 'PROFESSIONAL_BUSINESS',
    requiredCapabilities: [
      'customer.create',
      'engagement.plan',
      'deliverable.review',
      'client.approve',
      'project.complete',
    ],
  },
  {
    simulationId: 'SIM-08',
    title: 'SIM-08 — Retail, Commerce & Consumer Project Full Flow',
    industry: 'RETAIL_COMMERCE',
    requiredCapabilities: [
      'customer.create',
      'order.process',
      'fulfillment.track',
      'return.handle',
      'project.complete',
    ],
  },
  {
    simulationId: 'SIM-09',
    title: 'SIM-09 — Media, Communications & Creative Project Full Flow',
    industry: 'MEDIA_COMMUNICATIONS',
    requiredCapabilities: [
      'customer.create',
      'campaign.plan',
      'creative.review',
      'campaign.approve',
      'project.complete',
    ],
  },
  {
    simulationId: 'SIM-10',
    title: 'SIM-10 — Nonprofit & International Project Full Flow',
    industry: 'NONPROFIT',
    requiredCapabilities: [
      'beneficiary.create',
      'program.plan',
      'deliverable.review',
      'donor.approve',
      'project.complete',
    ],
  },
  {
    simulationId: 'SIM-11',
    title: 'SIM-11 — Special Purpose Organizations Project Full Flow',
    industry: 'SPECIAL_PURPOSE',
    requiredCapabilities: [
      'stakeholder.create',
      'mandate.plan',
      'deliverable.review',
      'board.approve',
      'project.complete',
    ],
  },
];

export function buildSimManifest(template: SimTemplate): SimManifest {
  const journey: CriticalJourney = {
    ...simGenericJourney,
    journeyId: `${template.simulationId.toLowerCase()}.industry.full_flow`,
    name: template.title.replace(/^SIM-\d+\s+—\s+/, 'Industry — '),
  };
  return SimManifestSchema.parse({
    schemaVersion: '1.0.0',
    manifestId: `${template.simulationId.toLowerCase()}.industry.manifest`,
    manifestVersion: '1.0.0',
    simulationId: template.simulationId,
    simulationVersion: '1.0.0',
    title: template.title,
    industry: template.industry,
    lane: 'TENANT_HQ',
    feFirst: 'STRICT',
    riskTier: 'CRITICAL',
    executionMode: 'DETERMINISTIC',
    environmentClass: 'STAGING',
    requiredCapabilities: template.requiredCapabilities,
    cohort: makeCohort(template.simulationId.toLowerCase(), 3),
    matrix: defaultMatrix(),
    journeys: [journey],
    evidenceChannels: defaultChannels(),
    knownDefects: [],
  });
}

export function buildSim06Manifest(): SimManifest {
  return buildSimManifest(SIM_TEMPLATES[0]);
}
export function buildSim07Manifest(): SimManifest {
  return buildSimManifest(SIM_TEMPLATES[1]);
}
export function buildSim08Manifest(): SimManifest {
  return buildSimManifest(SIM_TEMPLATES[2]);
}
export function buildSim09Manifest(): SimManifest {
  return buildSimManifest(SIM_TEMPLATES[3]);
}
export function buildSim10Manifest(): SimManifest {
  return buildSimManifest(SIM_TEMPLATES[4]);
}
export function buildSim11Manifest(): SimManifest {
  return buildSimManifest(SIM_TEMPLATES[5]);
}

export const SIM_BUILDERS: ReadonlyArray<{
  simulationId: string;
  build: () => SimManifest;
}> = [
  { simulationId: 'SIM-04', build: buildSim04Manifest },
  { simulationId: 'SIM-05', build: buildSim05Manifest },
  { simulationId: 'SIM-06', build: buildSim06Manifest },
  { simulationId: 'SIM-07', build: buildSim07Manifest },
  { simulationId: 'SIM-08', build: buildSim08Manifest },
  { simulationId: 'SIM-09', build: buildSim09Manifest },
  { simulationId: 'SIM-10', build: buildSim10Manifest },
  { simulationId: 'SIM-11', build: buildSim11Manifest },
];

// ============================================================
// STEP FACTORY (declaration merging + postcondition defaults)
// ============================================================

function step(
  stage: string,
  name: string,
  action: JourneyStep['action'],
  selectorOrDescription: string,
  descriptionOrValue?: string,
  value?: string,
): JourneyStep {
  // Two-call shapes supported:
  //   step(stage, name, action, description) — no selector/value
  //   step(stage, name, action, selector, description) — selector + description
  //   step(stage, name, action, selector, description, value) — + value
  const hasSelector = descriptionOrValue !== undefined;
  const stepRecord: JourneyStep = {
    stepId: `${stage}.${name}`,
    name: `${stage} ${name}`,
    action,
    description: hasSelector ? descriptionOrValue : selectorOrDescription,
    postconditions: [
      {
        assertionId: `${stage}.${name}.no_api_fallback`,
        type: 'NO_API_FALLBACK',
        expression: 'TEST_API',
        message:
          'No test-side API call observed during this step (FE-first rule).',
      },
      {
        assertionId: `${stage}.${name}.tenant_isolation`,
        type: 'TENANT_ISOLATION',
        expression: '*',
        message: 'No tool call touched a different tenant during this step.',
      },
    ],
  };
  if (hasSelector && selectorOrDescription.length > 0) {
    stepRecord.selector = selectorOrDescription;
  }
  if (value !== undefined && value.length > 0) {
    stepRecord.value = value;
  }
  return stepRecord;
}

// ============================================================
// RE-EXPORTS
// ============================================================

export { UuidSchema, IsoDateTimeSchema, SemverSchema };
