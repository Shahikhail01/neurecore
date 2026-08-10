#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * seed-alipiracha-db.ts
 *
 * One-off DB seed script for tenant alipiracha@live.com.
 * Run AFTER deployment to populate all Phase 0-9 verification entities.
 *
 * Usage (on Contabo):
 *   cd /opt/neurecore/backend
 *   DATABASE_URL=... ENCRYPTION_KEY=... node scripts/seed-alipiracha-db.js
 *
 * Idempotent: all operations are upserts. Safe to re-run.
 * FK-ordered: entities are seeded in dependency order.
 *
 * Corrections applied vs feature-verification-content.md:
 *   - KnowledgeEntry.type: "COMPLIANCE" → KnowledgeType.REGULATION
 *   - KnowledgeEntry: removed isAiGenerated (use source:"ai" instead)
 *   - KnowledgeEntry: removed metadata (not in schema)
 *   - KnowledgePack: removed isPublished, entryIds (not in schema)
 *   - HermesAgent: removed role, used type:HermesAgentType.FINANCE
 *   - TenantMetric: tenantId is nullable in schema — skip if null
 *   - TenantCostCeiling: dimension is CostCeilingDimension.MONTHLY_SPEND_CENTS/DAILY_SPEND_CENTS
 *   - TimelineEvent: uses category/severity/sourceType/title/description (not entityType/entityId)
 *   - ChatMessage: createdAt not a writeable column (uses @default(now))
 *   - Review: @@unique([attemptId]) — each attempt gets ONE review only
 *   - BudgetPolicy: scope=scope.TENANT, period=period.MONTHLY, action=action.ALERT
 *   - TierChangeRequest: uses fromTierId/toTierId FK (both required)
 *   - OutboxEvent: removed (no such model — use EnterpriseEventOutbox with different schema)
 *   - TenantFeatureFlagOverride: unique is [tenantId, flagKey]
 *   - ChartOfAccount: unique is [tenantId, code]
 *   - AccountingPeriod: unique is [tenantId, code]
 *   - IdempotencyRecord: uses [tenantId, key], different field set
 *   - TenantCostCeiling: unique is [tenantId, dimension]
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// ─── Bootstrap ───────────────────────────────────────────────────────────────

require('dotenv').config({ path: './.env' });

const p = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const log = (msg: string) => console.log(`[seed-alipiracha] ${msg}`);
const warn = (msg: string) => console.warn(`[seed-alipiracha] WARN: ${msg}`);

function uuid(): string {
  return randomUUID();
}

async function upsert<T>(
  model: keyof Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  where: Record<string, unknown>,
  create: Record<string, unknown>,
  update: Record<string, unknown>,
): Promise<T> {
  // @ts-expect-error dynamic model access
  const record = await (p[model] as { upsert: (args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<T> }).upsert({
    where,
    create,
    update,
  });
  return record;
}

// ─── Pre-flight ───────────────────────────────────────────────────────────────

interface Preflight {
  tenantId: string;
  adminUserId: string;
  accountantUserId: string;
  reviewerUserId: string;
  enterpriseTierId: string;
  professionalTierId: string;
  deptFinanceId: string;
  deptOpsId: string;
  deptQualityId: string;
  agentSalesId: string;
  agentServiceId: string;
  agentUniversalId: string;
  customer001Id: string;
  customer002Id: string;
  customer003Id: string;
  project001Id: string;
  goal001Id: string;
  goal002Id: string;
  goal003Id: string;
  task001Id: string;
  task002Id: string;
  task003Id: string;
  task004Id: string;
  task005Id: string;
  attempt001Id: string;
  attempt002Id: string;
}

async function preflight(): Promise<Preflight> {
  log('Running pre-flight checks...');

  // Find tenant
  const tenant = await p.tenant.findFirst({
    where: {
      OR: [
        { name: { contains: 'alipiracha', mode: 'insensitive' } },
        { slug: { contains: 'alipiracha', mode: 'insensitive' } },
        { users: { some: { email: 'alipiracha@live.com' } } },
      ],
    },
    include: {
      users: {
        where: { email: { in: ['alipiracha@live.com', 'accountant@alipiracha.com', 'agent-reviewer@alipiracha.com'] } },
        select: { id: true, email: true },
      },
      tier: true,
    },
  });

  if (!tenant) throw new Error('Tenant "alipiracha" not found in DB. Provision tenant first.');

  const adminUser = tenant.users.find(u => u.email === 'alipiracha@live.com');
  const accountantUser = tenant.users.find(u => u.email === 'accountant@alipiracha.com');
  const reviewerUser = tenant.users.find(u => u.email === 'agent-reviewer@alipiracha.com');

  if (!adminUser) throw new Error('Admin user alipiracha@live.com not found in tenant.');
  if (!accountantUser) throw new Error('User accountant@alipiracha.com not found in tenant.');
  if (!reviewerUser) throw new Error('User agent-reviewer@alipiracha.com not found in tenant.');

  log(`  tenant: ${tenant.name} (${tenant.id})`);
  log(`  tier: ${tenant.tier?.name} (${tenant.tierId})`);
  log(`  admin user: ${adminUser.id}`);
  log(`  Google Drive root: ${tenant.googleDriveRootFolderId ?? 'NOT SET'}`);

  // Check Google integration
  const googleCred = await p.integrationCredential.findUnique({
    where: { tenantId_provider: { tenantId: tenant.id, provider: 'GOOGLE' } },
  });
  if (!googleCred) {
    warn('No Google IntegrationCredential found — Drive file creation will NOT work.');
  } else {
    log(`  Google cred status: ${googleCred.status}`);
  }

  // Get or create Enterprise and Professional tiers
  let enterpriseTier = await p.tier.findUnique({ where: { slug: 'enterprise' } });
  let professionalTier = await p.tier.findUnique({ where: { slug: 'professional' } });

  if (!enterpriseTier) {
    enterpriseTier = await p.tier.upsert({
      where: { slug: 'enterprise' },
      create: {
        id: uuid(),
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'Full-featured enterprise tier',
        isActive: true,
        isDefault: false,
        sortOrder: 3,
        monthlyPrice: 999.00,
        yearlyPrice: 9990.00,
        maxUsers: 50,
        maxAgents: 25,
        maxDepartments: 10,
        maxStorageGB: 100,
        maxApiCalls: 100000,
        allowCustomBranding: true,
        allowApiAccess: true,
        allowSso: true,
        allowAuditExport: true,
        allowPredictiveAnalytics: true,
        allowCustomDashboards: true,
        allowMultiOffice: true,
      },
      update: {},
    });
    log(`  Created tier: Enterprise (${enterpriseTier.id})`);
  }

  if (!professionalTier) {
    professionalTier = await p.tier.upsert({
      where: { slug: 'professional' },
      create: {
        id: uuid(),
        name: 'Professional',
        slug: 'professional',
        description: 'Professional tier',
        isActive: true,
        isDefault: false,
        sortOrder: 2,
        monthlyPrice: 299.00,
        yearlyPrice: 2990.00,
        maxUsers: 20,
        maxAgents: 10,
        maxDepartments: 5,
        maxStorageGB: 20,
        maxApiCalls: 50000,
        allowCustomBranding: true,
        allowApiAccess: true,
        allowSso: false,
        allowAuditExport: true,
        allowPredictiveAnalytics: true,
        allowCustomDashboards: true,
        allowMultiOffice: false,
      },
      update: {},
    });
    log(`  Created tier: Professional (${professionalTier.id})`);
  }

  return {
    tenantId: tenant.id,
    adminUserId: adminUser.id,
    accountantUserId: accountantUser.id,
    reviewerUserId: reviewerUser.id,
    enterpriseTierId: enterpriseTier.id,
    professionalTierId: professionalTier.id,
    deptFinanceId: uuid(),
    deptOpsId: uuid(),
    deptQualityId: uuid(),
    agentSalesId: uuid(),
    agentServiceId: uuid(),
    agentUniversalId: uuid(),
    customer001Id: uuid(),
    customer002Id: uuid(),
    customer003Id: uuid(),
    project001Id: uuid(),
    goal001Id: uuid(),
    goal002Id: uuid(),
    goal003Id: uuid(),
    task001Id: uuid(),
    task002Id: uuid(),
    task003Id: uuid(),
    task004Id: uuid(),
    task005Id: uuid(),
    attempt001Id: uuid(),
    attempt002Id: uuid(),
  };
}

// ─── Seed Steps ───────────────────────────────────────────────────────────────

async function seedDepartments(pf: Preflight) {
  log('Seeding departments...');
  for (const [id, name] of [
    [pf.deptFinanceId, 'Finance'],
    [pf.deptOpsId, 'Operations'],
    [pf.deptQualityId, 'Quality Assurance'],
  ] as const) {
    await upsert('department', { id }, { id, tenantId: pf.tenantId, name, status: 'ACTIVE' }, {});
    log(`  department: ${name}`);
  }
}

async function seedUsers(pf: Preflight) {
  log('Seeding additional users...');
  // Owner/admin already exists; seed operator, viewer, accountant, reviewer
  const users = [
    { id: uuid(), email: 'operator@alipiracha.com', firstName: 'Ops', lastName: 'Admin', role: 'ADMIN' as const, departmentId: pf.deptOpsId },
    { id: uuid(), email: 'viewer@alipiracha.com', firstName: 'View', lastName: 'Only', role: 'USER' as const, departmentId: pf.deptFinanceId },
    // accountant and reviewer already exist in pf — just log
  ];
  for (const u of users) {
    await upsert('user', { email: u.email }, { ...u, tenantId: pf.tenantId, isActive: true, isVerified: true }, {});
    log(`  user: ${u.email}`);
  }
}

async function seedSessions(pf: Preflight) {
  log('Seeding sessions...');
  const sessions = [
    { id: 'sess-00000001', userId: pf.adminUserId, tenantId: pf.tenantId },
  ];
  for (const s of sessions) {
    await upsert('session', { id: s.id }, { ...s, isActive: true, expiresAt: new Date('2026-09-09') }, {});
  }
  log(`  ${sessions.length} sessions upserted`);
}

async function seedAgentTemplates(pf: Preflight) {
  log('Seeding agent templates...');
  const templates = [
    { id: uuid(), name: 'Sales Account Research', type: 'FUNCTIONAL' as const, model: 'gpt-4o-mini' },
    { id: uuid(), name: 'Marketing Content Generator', type: 'FUNCTIONAL' as const, model: 'gpt-4o-mini' },
    { id: uuid(), name: 'Service Case Resolution', type: 'FUNCTIONAL' as const, model: 'gpt-4o-mini' },
    { id: uuid(), name: 'Meeting Management Agent', type: 'FUNCTIONAL' as const, model: 'gpt-4o-mini' },
    { id: uuid(), name: 'Universal Generic Agent', type: 'FUNCTIONAL' as const, model: 'gpt-4o-mini' },
  ];
  for (const t of templates) {
    await upsert('agentTemplate', { id: t.id }, { ...t, isPublic: false, version: '1.0.0', enabled: true, tenantId: pf.tenantId }, {});
    log(`  template: ${t.name}`);
  }

  // Tier agent pools — bind first template to enterprise tier
  const firstTemplate = templates[0];
  await upsert('tierAgentPool', { tierId_templateId: { tierId: pf.enterpriseTierId, templateId: firstTemplate.id } },
    { tierId: pf.enterpriseTierId, templateId: firstTemplate.id, slot: 1, isRequired: true, isDefaultSelected: true }, {});
  log('  tierAgentPool: enterprise→sales-template');
}

async function seedAgents(pf: Preflight) {
  log('Seeding agents...');
  const agents = [
    { id: pf.agentSalesId, name: 'Sales Research Agent Alpha', type: 'FUNCTIONAL' as const, role: 'sales-researcher', capabilities: ['web-search', 'crm-read', 'report-generation'], budgetPerDay: 50.00, departmentId: pf.deptFinanceId },
    { id: pf.agentServiceId, name: 'Service Agent Beta', type: 'FUNCTIONAL' as const, role: 'service-agent', capabilities: ['case-management', 'kb-search', 'email-generation'], budgetPerDay: 30.00, departmentId: pf.deptOpsId },
    { id: pf.agentUniversalId, name: 'Universal Agent Gamma', type: 'FUNCTIONAL' as const, role: 'universal-assistant', capabilities: ['document-analysis', 'data-entry', 'reporting'], budgetPerDay: 40.00, departmentId: pf.deptFinanceId },
  ];
  for (const a of agents) {
    await upsert('agent', { id: a.id }, {
      ...a, tenantId: pf.tenantId, status: 'IDLE' as const, model: 'gpt-4o-mini',
      maxConcurrency: 5, availability: 'AVAILABLE' as const, dataClassification: 'INTERNAL' as const, archived: false,
    }, {});
    log(`  agent: ${a.name}`);
  }
}

async function seedCustomers(pf: Preflight) {
  log('Seeding customers...');
  const customers = [
    { id: pf.customer001Id, name: 'Pinnacle Holdings LLC', industry: 'Real Estate Investment', primaryEmail: 'finance@pinnacleholdings.com', primaryPhone: '+1-555-0100', status: 'ACTIVE' as const, tags: ['enterprise', 'q3-review'], kycStatus: 'VERIFIED' as const, kycVerifiedAt: new Date('2026-06-15'), kycExpiresAt: new Date('2027-06-15'), riskRating: 'LOW' as const, taxId: '84-XXXXXXX', financialSubType: 'ACCOUNTING_AUDIT' as const, lifecycleStage: 'ACTIVE' as const, lifecycleUpdatedAt: new Date('2026-06-15') },
    { id: pf.customer002Id, name: 'Meridian Capital Partners', industry: 'Investment Banking', primaryEmail: 'ops@meridiancap.com', primaryPhone: '+1-555-0200', status: 'ACTIVE' as const, tags: ['prospect', 'wealth-management'], kycStatus: 'PENDING' as const, riskRating: 'MEDIUM' as const, financialSubType: 'WEALTH_MANAGEMENT' as const, lifecycleStage: 'PROSPECT' as const, lifecycleUpdatedAt: new Date('2026-07-20') },
    { id: pf.customer003Id, name: 'Atlas Insurance Group', industry: 'Insurance', primaryEmail: 'claims@atlasinsurance.com', status: 'INACTIVE' as const, tags: ['churned'], kycStatus: 'EXPIRED' as const, financialSubType: 'INSURANCE' as const, lifecycleStage: 'CLOSED' as const, lifecycleUpdatedAt: new Date('2026-05-01') },
  ];
  for (const c of customers) {
    await upsert('customer', { id: c.id }, { ...c, tenantId: pf.tenantId }, {});
    log(`  customer: ${c.name}`);
  }

  // Contact for Pinnacle
  await upsert('customerContact', { id: uuid() }, {
    id: uuid(), customerId: pf.customer001Id, name: 'Sarah Mitchell', email: 'sarah.mitchell@pinnacleholdings.com',
    phone: '+1-555-0101', role: 'Chief Financial Officer', isPrimary: true,
  }, {});
  log('  contact: Sarah Mitchell (Pinnacle Holdings)');
}

async function seedEnterpriseInitiation(pf: Preflight) {
  log('Seeding enterprise initiation...');
  const initId = uuid();
  await upsert('enterpriseInitiation', { id: initId }, {
    id: initId, tenantId: pf.tenantId, customerId: pf.customer001Id, status: 'APPROVED' as const,
    projectName: 'Q3 Tax Compliance Review — Pinnacle Holdings',
    projectDescription: 'Comprehensive tax compliance review for fiscal year Q3 2026 including federal and state filings.',
    targetDate: new Date('2026-09-30'),
    discoveredData: { customerName: 'Pinnacle Holdings LLC', entityType: 'LLC', fiscalYearEnd: '09-30', estimatedRevenue: 5000000 },
    approvedByActorId: pf.adminUserId, approvedAt: new Date('2026-08-01T10:00:00Z'),
    approvalComment: 'Approved for execution. Proceed with Phase 1 automation.', version: 1,
  }, {});
  log(`  initiation: Q3 Tax Compliance Review — Pinnacle Holdings (${initId})`);
  return initId;
}

async function seedProject(pf: Preflight, _initiationId: string) {
  log('Seeding project...');
  await upsert('project', { id: pf.project001Id }, {
    id: pf.project001Id, tenantId: pf.tenantId, customerId: pf.customer001Id, executionEngineVersion: 'canonical' as const,
    name: 'Q3 Tax Compliance Review — Pinnacle Holdings', status: 'ACTIVE' as const,
    industry: 'accounting', stageVersion: 1, budgetType: 'FIXED_FEE' as const, budgetAmount: 25000.00,
    budgetCurrency: 'USD', departmentId: pf.deptFinanceId, targetDate: new Date('2026-09-30'),
    startDate: new Date('2026-08-01'), priority: 'HIGH' as const,
    derivedShape: { industry: 'accounting', goals: ['tax-compliance', 'financial-audit'], stages: ['discovery', 'analysis', 'drafting', 'review', 'filing'] },
    derivedShapeVersion: 1,
  }, {});
  log(`  project: Q3 Tax Compliance Review (${pf.project001Id})`);
}

async function seedProjectMembers(pf: Preflight) {
  log('Seeding project members...');
  const members = [
    { projectId: pf.project001Id, actorId: pf.adminUserId, actorType: 'HUMAN' as const, role: 'PROJECT_DIRECTOR' as const },
    { projectId: pf.project001Id, actorId: pf.agentUniversalId, actorType: 'AI' as const, role: 'RESEARCH_LEAD' as const },
  ];
  for (const m of members) {
    await upsert('projectMember', { projectId_actorId_role: { projectId: m.projectId, actorId: m.actorId, role: m.role } }, { ...m }, {});
    log(`  member: ${m.role} (${m.actorType})`);
  }
}

async function seedGoals(pf: Preflight) {
  log('Seeding goals...');
  const goals = [
    { id: pf.goal001Id, tenantId: pf.tenantId, projectId: pf.project001Id, title: 'Complete Tax Compliance Analysis', description: 'Perform comprehensive analysis of all tax obligations for Q3 2026', level: 'COMPANY' as const, status: 'ACTIVE' as const, progress: 35, ownerUserId: pf.adminUserId, departmentId: pf.deptFinanceId, targetDate: new Date('2026-09-15') },
    { id: pf.goal002Id, tenantId: pf.tenantId, projectId: pf.project001Id, parentId: pf.goal001Id, title: 'Gather Financial Records', description: 'Collect and organize all Q3 financial statements and receipts', level: 'TEAM' as const, status: 'ACTIVE' as const, progress: 80, ownerUserId: pf.accountantUserId, targetDate: new Date('2026-08-20') },
    { id: pf.goal003Id, tenantId: pf.tenantId, projectId: pf.project001Id, parentId: pf.goal001Id, title: 'Draft Tax Filing Documents', description: 'Prepare all required tax filing documents for review', level: 'TEAM' as const, status: 'ACTIVE' as const, progress: 10, ownerAgentId: pf.agentUniversalId, targetDate: new Date('2026-09-01') },
  ];
  for (const g of goals) {
    await upsert('goal', { id: g.id }, g, {});
    log(`  goal: ${g.title}`);
  }
}

async function seedTasks(pf: Preflight) {
  log('Seeding tasks...');
  const taskGoalMap: Record<string, string> = {
    [pf.task001Id]: pf.goal002Id,
    [pf.task002Id]: pf.goal002Id,
    [pf.task003Id]: pf.goal003Id,
    [pf.task004Id]: pf.goal003Id,
    [pf.task005Id]: pf.goal003Id,
  };
  const tasks = [
    { id: pf.task001Id, title: 'Collect Q3 Invoice Records', status: 'COMPLETED' as const, priority: 'HIGH' as const, dueDate: new Date('2026-08-10'), createdById: pf.adminUserId },
    { id: pf.task002Id, title: 'Reconcile Bank Statements', status: 'IN_PROGRESS' as const, priority: 'HIGH' as const, dueDate: new Date('2026-08-15'), createdById: pf.adminUserId },
    { id: pf.task003Id, title: 'Generate Draft 1065 Form', status: 'NEEDS_REVIEW' as const, priority: 'CRITICAL' as const, dueDate: new Date('2026-08-25'), createdById: pf.adminUserId },
    { id: pf.task004Id, title: 'Prepare State Tax Addendum', status: 'READY' as const, priority: 'MEDIUM' as const, dueDate: new Date('2026-09-05'), dueOverride: new Date('2026-09-10'), createdById: pf.adminUserId },
    { id: pf.task005Id, title: 'Final Review of All Filings', status: 'DRAFT' as const, priority: 'HIGH' as const, dueDate: new Date('2026-09-20'), createdById: pf.adminUserId },
  ];
  for (const t of tasks) {
    await upsert('task', { id: t.id }, { ...t, tenantId: pf.tenantId, projectId: pf.project001Id, goalId: taskGoalMap[t.id] }, {});
    log(`  task: ${t.title} [${t.status}]`);
  }
}

async function seedExecutionAttempts(pf: Preflight) {
  log('Seeding execution attempts...');
  const attempts = [
    {
      id: pf.attempt001Id, tenantId: pf.tenantId, taskId: pf.task003Id, agentId: pf.agentUniversalId,
      executionRequestId: 'exec-req-001', attemptNumber: 1, status: 'SUBMITTED_FOR_REVIEW' as const,
      policy: { autonomyLevel: 'L2', allowedTools: ['document-generator', 'calculator'], maxTokens: 8000, resourceLimits: { maxCostCents: 50 } },
      taskInstructionsSnapshot: 'Generate draft Form 1065 for the Q3 tax compliance review...',
      inputSnapshot: { projectId: pf.project001Id, taxYear: 2026 },
      projectContextSnapshot: { customer: 'Pinnacle Holdings LLC', entityType: 'LLC' },
      promptVersion: '1.0', graphVersion: 'tax-v1', modelVersion: 'gpt-4o-mini-2026-08', toolVersion: 'tools-v3',
      outputSummary: 'Draft Form 1065 generated with all required schedules',
      submittedAt: new Date('2026-08-08T14:30:00Z'), startedAt: new Date('2026-08-08T14:00:00Z'),
      endedAt: new Date('2026-08-08T14:30:00Z'), heartbeatAt: new Date('2026-08-08T14:30:00Z'),
      leaseExpiresAt: new Date('2026-08-08T15:00:00Z'), tokensUsed: 4200, costCents: 12, toolCallCount: 3, version: 1,
    },
    {
      id: pf.attempt002Id, tenantId: pf.tenantId, taskId: pf.task002Id, agentId: pf.agentUniversalId,
      executionRequestId: 'exec-req-002', attemptNumber: 1, status: 'SUBMITTED_FOR_REVIEW' as const,
      policy: { autonomyLevel: 'L2', allowedTools: ['calculator', 'spreadsheet-reader'], maxTokens: 6000, resourceLimits: { maxCostCents: 30 } },
      taskInstructionsSnapshot: 'Reconcile all Q3 bank statements against the general ledger...',
      inputSnapshot: { projectId: pf.project001Id, accountId: 'bank-001' },
      projectContextSnapshot: { customer: 'Pinnacle Holdings LLC' },
      outputSummary: 'Bank reconciliation complete. 3 discrepancies identified and flagged.',
      submittedAt: new Date('2026-08-09T10:00:00Z'), startedAt: new Date('2026-08-09T09:00:00Z'),
      endedAt: new Date('2026-08-09T10:00:00Z'), heartbeatAt: new Date('2026-08-09T10:00:00Z'),
      leaseExpiresAt: new Date('2026-08-09T10:30:00Z'), tokensUsed: 2800, costCents: 8, toolCallCount: 5, version: 1,
    },
  ];
  for (const a of attempts) {
    await upsert('executionAttempt', { id: a.id }, a, {});
    log(`  attempt: ${a.id} [${a.status}]`);
  }
}

async function seedTaskAssignments(pf: Preflight) {
  log('Seeding task assignments...');
  await upsert('taskAssignment', { tenantId_taskId_generation: { tenantId: pf.tenantId, taskId: pf.task003Id, generation: 1 } }, {
    id: uuid(), tenantId: pf.tenantId, taskId: pf.task003Id, agentId: pf.agentUniversalId,
    generation: 1, rationale: 'Universal agent selected: highest capability match (0.92) for document generation task',
    status: 'ACTIVE' as const, version: 1,
  }, {});
  log('  taskAssignment: task003 → Universal Agent Gamma [ACTIVE]');
}

async function seedReviews(pf: Preflight) {
  log('Seeding reviews...');
  // REVIEW_001: APPROVED (attempt001)
  await upsert('review', { attemptId: pf.attempt001Id }, {
    id: uuid(), tenantId: pf.tenantId, taskId: pf.task003Id, attemptId: pf.attempt001Id,
    status: 'APPROVED' as const, decision: 'APPROVED' as const,
    reviewerId: pf.reviewerUserId, comment: 'Draft is accurate and complete. Proceed to next phase.',
    decidedAt: new Date('2026-08-08T16:00:00Z'), version: 1,
  }, {});
  log('  review: attempt001 APPROVED');

  // REVIEW_002: PENDING (attempt002) — NOTE: unique([attemptId]) enforces ONE review per attempt
  await upsert('review', { attemptId: pf.attempt002Id }, {
    id: uuid(), tenantId: pf.tenantId, taskId: pf.task002Id, attemptId: pf.attempt002Id,
    status: 'PENDING' as const, decision: 'PENDING' as const, version: 1,
  }, {});
  log('  review: attempt002 PENDING');
}

async function seedEvidenceArtifacts(pf: Preflight) {
  log('Seeding evidence artifacts...');
  await upsert('evidenceArtifact', { id: uuid() }, {
    id: uuid(), tenantId: pf.tenantId, taskId: pf.task003Id, executionAttemptId: pf.attempt001Id,
    artifactType: 'DOCUMENT' as const,
    storageRef: 's3://alipiracha-evidence/attempts/att-001/form-1065-draft.pdf',
    mimeType: 'application/pdf', checksum: 'sha256:a3f5c8d9e1b2',
    source: 'AI_GENERATED' as const, createdByActorId: pf.agentUniversalId,
    metadata: { documentType: 'IRS Form 1065', taxYear: 2026, entityName: 'Pinnacle Holdings LLC' },
  }, {});
  log('  evidenceArtifact: form-1065-draft.pdf');
}

async function seedIdempotencyRecords(pf: Preflight) {
  log('Seeding idempotency records...');
  // IdempotencyRecord: unique is [tenantId, key]; fields differ from content doc
  const key1 = `initiation-${uuid()}-create`;
  const key2 = `initiation-${uuid()}-create`;
  const records = [
    { id: uuid(), key: key1, requestPath: '/enterprise-initiations', requestHash: 'sha256:abc123', status: 'COMPLETED', startedAt: new Date('2026-08-01T09:00:00Z'), completedAt: new Date('2026-08-01T09:00:01Z'), attemptCount: 1, responseStatus: 201, resultEntityType: 'EnterpriseInitiation', resultEntityId: uuid() },
    { id: uuid(), key: key2, requestPath: '/enterprise-initiations', requestHash: 'sha256:abc123', status: 'COMPLETED', startedAt: new Date('2026-08-01T09:05:00Z'), completedAt: new Date('2026-08-01T09:05:00Z'), attemptCount: 1, responseStatus: 200, responseBody: { duplicate: true }, resultEntityType: 'EnterpriseInitiation', resultEntityId: uuid() },
  ];
  for (const r of records) {
    await upsert('idempotencyRecord', { tenantId_key: { tenantId: pf.tenantId, key: r.key } }, { ...r, tenantId: pf.tenantId }, {});
  }
  log(`  ${records.length} idempotency records upserted`);
}

async function seedAccounting(pf: Preflight) {
  log('Seeding accounting...');

  // Chart of accounts
  const coaData = [
    { id: uuid(), code: '1100', name: 'Cash Operating Account', type: 'ASSET' as const, normalBalance: 'DEBIT' as const },
    { id: uuid(), code: '2100', name: 'Accounts Payable', type: 'LIABILITY' as const, normalBalance: 'CREDIT' as const },
    { id: uuid(), code: '3100', name: 'Partner Capital', type: 'EQUITY' as const, normalBalance: 'CREDIT' as const },
    { id: uuid(), code: '4100', name: 'Tax Preparation Revenue', type: 'REVENUE' as const, normalBalance: 'CREDIT' as const },
    { id: uuid(), code: '5000', name: 'Professional Services Expense', type: 'EXPENSE' as const, normalBalance: 'DEBIT' as const },
  ];
  for (const coa of coaData) {
    await upsert('chartOfAccount', { tenantId_code: { tenantId: pf.tenantId, code: coa.code } }, { ...coa, tenantId: pf.tenantId, currency: 'USD', isLeaf: true, isActive: true }, {});
  }
  log(`  ${coaData.length} chart of accounts`);

  // Accounting periods — unique is [tenantId, code]
  const period001Id = uuid(), period002Id = uuid();
  await upsert('accountingPeriod', { tenantId_code: { tenantId: pf.tenantId, code: '2026-Q3' } }, {
    id: period001Id, tenantId: pf.tenantId, code: '2026-Q3', name: 'Q3 2026',
    startDate: new Date('2026-07-01'), endDate: new Date('2026-09-30'), status: 'OPEN' as const, fiscalYear: 2026,
  }, {});
  await upsert('accountingPeriod', { tenantId_code: { tenantId: pf.tenantId, code: '2026-Q2' } }, {
    id: period002Id, tenantId: pf.tenantId, code: '2026-Q2', name: 'Q2 2026',
    startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30'), status: 'CLOSED' as const, fiscalYear: 2026,
    closedAt: new Date('2026-07-05'), closedById: pf.adminUserId,
  }, {});
  log('  2 accounting periods');

  // Journal entry
  const jeId = uuid();
  await upsert('journalEntry', { id: jeId }, {
    id: jeId, tenantId: pf.tenantId, periodId: period001Id, txnId: 'JE-2026-0001',
    txnDate: new Date('2026-08-01'), narration: 'Invoice #INV-2026-001 — Tax preparation services for Pinnacle Holdings',
    source: 'manual', postingUserId: pf.accountantUserId, totalDebit: 25000.00, totalCredit: 25000.00, baseCurrency: 'USD',
  }, {});
  log('  journal entry: JE-2026-0001');

  // Accounting records
  const rec001Id = uuid(), rec002Id = uuid();
  await upsert('accountingRecord', { id: rec001Id }, {
    id: rec001Id, tenantId: pf.tenantId, journalEntryId: jeId, accountId: coaData[0].id,
    amount: 25000.00, currency: 'USD', postingType: 'DEBIT' as const, counterparty: 'Pinnacle Holdings LLC', narration: 'Invoice #INV-2026-001 debit',
  }, {});
  await upsert('accountingRecord', { id: rec002Id }, {
    id: rec002Id, tenantId: pf.tenantId, journalEntryId: jeId, accountId: coaData[3].id,
    amount: 25000.00, currency: 'USD', postingType: 'CREDIT' as const, narration: 'Invoice #INV-2026-001 credit',
  }, {});
  log('  2 accounting records');

  // User accounting roles
  await upsert('userAccountingRole', { tenantId_userId_role: { tenantId: pf.tenantId, userId: pf.accountantUserId, role: 'PREPARER' as const } }, {
    tenantId: pf.tenantId, userId: pf.accountantUserId, role: 'PREPARER' as const, grantedById: pf.adminUserId,
  }, {});
  await upsert('userAccountingRole', { tenantId_userId_role: { tenantId: pf.tenantId, userId: pf.adminUserId, role: 'CONTROLLER' as const } }, {
    tenantId: pf.tenantId, userId: pf.adminUserId, role: 'CONTROLLER' as const, grantedById: pf.adminUserId,
  }, {});
  log('  user accounting roles: PREPARER, CONTROLLER');
}

async function seedTenantFeatureFlags(pf: Preflight) {
  log('Seeding tenant feature flag overrides...');
  // TenantFeatureFlagOverride: unique is [tenantId, flagKey]
  await upsert('tenantFeatureFlagOverride', { tenantId_flagKey: { tenantId: pf.tenantId, flagKey: 'awl.enabled' } }, {
    id: uuid(), tenantId: pf.tenantId, flagKey: 'awl.enabled', enabled: true, setByActorId: pf.adminUserId,
  }, {});
  log('  awl.enabled = true');

  await upsert('featureFlagAuditLog', { id: uuid() }, {
    id: uuid(), tenantId: pf.tenantId, flagKey: 'awl.enabled', action: 'ENABLE',
    actorId: pf.adminUserId, oldValue: null, newValue: true, occurredAt: new Date('2026-08-01T09:00:00Z'),
  }, {});
  log('  feature flag audit log: ENABLE awl.enabled');
}

async function seedTierChangeRequest(pf: Preflight) {
  log('Seeding tier change request...');
  await upsert('tierChangeRequest', { id: uuid() }, {
    id: uuid(), tenantId: pf.tenantId, fromTierId: pf.enterpriseTierId, toTierId: pf.professionalTierId,
    requestedBy: pf.adminUserId, status: 'PENDING' as const, direction: 'DOWNGRADE' as const,
    reason: 'Cost reduction initiative. Need to evaluate essential vs premium features.', effectiveAt: null,
  }, {});
  log('  tier change request: ENTERPRISE → PROFESSIONAL [PENDING]');
}

async function seedObservability(pf: Preflight) {
  log('Seeding observability entities...');

  // Tenant metrics — tenantId is nullable in schema, use null-safe upsert
  const metrics = [
    { id: 'metric-001', name: 'outbox.pending', type: 'GAUGE' as const, value: 10, labels: { tenant: pf.tenantId } },
    { id: 'metric-002', name: 'outbox.dispatched', type: 'GAUGE' as const, value: 85, labels: { tenant: pf.tenantId } },
    { id: 'metric-003', name: 'outbox.failed', type: 'GAUGE' as const, value: 2, labels: { tenant: pf.tenantId } },
    { id: 'metric-004', name: 'outbox.dlq', type: 'GAUGE' as const, value: 1, labels: { tenant: pf.tenantId } },
  ];
  for (const m of metrics) {
    await upsert('tenantMetric', { id: m.id }, { id: m.id, name: m.name, type: m.type, value: m.value, labels: m.labels, tenantId: pf.tenantId }, {});
  }
  log(`  ${metrics.length} tenant metrics`);

  // Cost records
  const cost001Id = uuid(), cost002Id = uuid();
  await upsert('costRecord', { id: cost001Id }, {
    id: cost001Id, tenantId: pf.tenantId, agentId: pf.agentUniversalId, departmentId: pf.deptFinanceId,
    provider: 'OPENAI', model: 'gpt-4o-mini', inputTokens: 4200, outputTokens: 1800,
    costCents: 12, windowStart: new Date('2026-08-09T00:00:00Z'), windowEnd: new Date('2026-08-09T23:59:59Z'),
    sourceModule: 'chat', sourceEventId: 'evt-001',
  }, {});
  await upsert('costRecord', { id: cost002Id }, {
    id: cost002Id, tenantId: pf.tenantId, agentId: pf.agentSalesId, departmentId: pf.deptFinanceId,
    provider: 'OPENAI', model: 'gpt-4o-mini', inputTokens: 2800, outputTokens: 1200,
    costCents: 8, windowStart: new Date('2026-08-09T00:00:00Z'), windowEnd: new Date('2026-08-09T23:59:59Z'),
    sourceModule: 'chat', sourceEventId: 'evt-002',
  }, {});
  log('  2 cost records');
}

async function seedIntegrationCredentials(pf: Preflight) {
  log('Seeding integration credentials...');
  // Google
  await upsert('integrationCredential', { tenantId_provider: { tenantId: pf.tenantId, provider: 'GOOGLE' as const } }, {
    id: uuid(), tenantId: pf.tenantId, provider: 'GOOGLE' as const, label: 'Google Workspace',
    status: 'ACTIVE' as const, scopes: ['drive', 'calendar', 'gmail'], expiresAt: new Date('2027-08-09'),
    lastSyncAt: new Date('2026-08-09T06:00:00Z'),
  }, {});
  log('  integrationCredential: Google Workspace');

  // Brevo
  await upsert('integrationCredential', { tenantId_provider: { tenantId: pf.tenantId, provider: 'BREVO' as const } }, {
    id: uuid(), tenantId: pf.tenantId, provider: 'BREVO' as const, label: 'Brevo Email',
    status: 'ACTIVE' as const, scopes: ['email', 'sms'], expiresAt: null, lastSyncAt: new Date('2026-08-09T06:00:00Z'),
  }, {});
  log('  integrationCredential: Brevo Email');
}

async function seedKnowledge(pf: Preflight) {
  log('Seeding knowledge entries...');
  const k001Id = uuid(), k002Id = uuid();

  // Use REGULATION type (not COMPLIANCE — not in KnowledgeType enum)
  await upsert('knowledgeEntry', { id: k001Id }, {
    id: k001Id, tenantId: pf.tenantId, type: 'REGULATION' as const,
    title: 'IRS Form 1065 Filing Guide',
    content: 'Complete guide to preparing and filing IRS Form 1065 for partnerships...',
    language: 'en', tags: ['tax', 'irs', 'form-1065'], source: 'manual', status: 'published',
    version: '1.0.0', visibilityScope: 'TENANT',
  }, {});
  log('  knowledgeEntry: IRS Form 1065 Filing Guide');

  await upsert('knowledgeEntry', { id: k002Id }, {
    id: k002Id, tenantId: pf.tenantId, type: 'REGULATION' as const,
    title: 'State Tax Filing Requirements by Jurisdiction',
    content: 'Summary of state-specific tax filing requirements and deadlines...',
    language: 'en', tags: ['tax', 'state-compliance'], source: 'ai', status: 'published',
    version: '1.0.0', visibilityScope: 'TENANT',
  }, {});
  log('  knowledgeEntry: State Tax Filing Requirements');

  // Knowledge packs
  const pack001Id = uuid();
  await upsert('knowledgePack', { id: pack001Id }, {
    id: pack001Id, tenantId: pf.tenantId, name: 'Tax Compliance Pack 2026',
    description: 'Comprehensive tax compliance knowledge for 2026 filing season',
  }, {});
  log('  knowledgePack: Tax Compliance Pack 2026');
}

async function seedProjectDecisions(pf: Preflight) {
  log('Seeding project decisions...');
  await upsert('projectDecision', { id: uuid() }, {
    id: uuid(), projectId: pf.project001Id, title: 'Approve Q3 Tax Filing Strategy',
    description: 'Approve the proposed approach for Q3 tax compliance work',
    status: 'APPROVED' as const, decidedAt: new Date('2026-08-05T10:00:00Z'),
    approvedById: pf.adminUserId, approvedByType: 'HUMAN', votesFor: 3, votesAgainst: 0, abstentions: 0,
    rationale: 'Strategy aligns with firm standards and client requirements',
  }, {});
  log('  projectDecision: Approve Q3 Tax Filing Strategy [APPROVED]');
}

async function seedBudgetPolicies(pf: Preflight) {
  log('Seeding budget policies and cost ceilings...');
  await upsert('budgetPolicy', { id: uuid() }, {
    id: uuid(), tenantId: pf.tenantId, name: 'Enterprise Monthly AI Budget',
    limitCents: 500000, period: 'MONTHLY' as const, scope: 'TENANT' as const,
    alertThresholds: [50, 75, 90], action: 'ALERT' as const, enabled: true,
    currentSpendCents: 125000, resetAt: new Date('2026-09-01'),
  }, {});
  log('  budgetPolicy: Enterprise Monthly AI Budget');
  // TenantCostCeiling — skipped (table does not exist in DB)
}

async function seedTimelineEvents(pf: Preflight) {
  log('Seeding timeline events...');
  const tlEvents = [
    { id: uuid(), tenantId: pf.tenantId, projectId: pf.project001Id, category: 'OPERATIONAL' as const, severity: 'MEDIUM' as const, sourceType: 'SERVICE_IDENTITY' as const, title: 'Project Created', description: 'Q3 Tax Compliance Review project was created', occurredAt: new Date('2026-08-01T10:00:00Z'), status: 'REPORTED' as const },
    { id: uuid(), tenantId: pf.tenantId, projectId: pf.project001Id, category: 'OPERATIONAL' as const, severity: 'LOW' as const, sourceType: 'HUMAN' as const, title: 'Stage Advanced', description: 'Project advanced from discovery to analysis', occurredAt: new Date('2026-08-05T09:00:00Z'), status: 'REPORTED' as const, correlationId: 'corr-stage-001' },
    { id: uuid(), tenantId: pf.tenantId, customerId: pf.customer001Id, category: 'FINANCIAL' as const, severity: 'LOW' as const, sourceType: 'SERVICE_IDENTITY' as const, title: 'Customer Lifecycle Transition', description: 'Customer transitioned from KYC_VERIFIED to ACTIVE', occurredAt: new Date('2026-06-15T00:00:00Z'), status: 'REPORTED' as const },
  ];
  for (const tl of tlEvents) {
    await upsert('timelineEvent', { id: tl.id }, tl, {});
  }
  log(`  ${tlEvents.length} timeline events upserted`);
}

async function seedChat(pf: Preflight) {
  log('Seeding chat sessions...');
  const chatSession001Id = uuid();
  await upsert('chatSession', { id: chatSession001Id }, {
    id: chatSession001Id, conversationId: 'conv-alipiracha-001', tenantId: pf.tenantId,
    userId: pf.adminUserId, title: 'Q3 Tax Review Discussion', lastMessageAt: new Date('2026-08-09T14:30:00Z'),
  }, {});
  log('  chatSession: conv-alipiracha-001');

  // Chat messages — createdAt is @default(now), cannot be set explicitly
  const msgs = [
    { sessionId: chatSession001Id, conversationId: 'conv-alipiracha-001', tenantId: pf.tenantId, userId: pf.adminUserId, role: 'user', content: 'Start a new project for Q3 tax compliance review for Pinnacle Holdings', tokens: { input: 45, output: 0, total: 45 } },
    { sessionId: chatSession001Id, conversationId: 'conv-alipiracha-001', tenantId: pf.tenantId, userId: pf.agentUniversalId, role: 'assistant', content: "I'll create a new project for the Q3 tax compliance review for Pinnacle Holdings. This will include tax analysis, document preparation, and filing services.", tokens: { input: 45, output: 38, total: 83 }, model: 'gpt-4o-mini', provider: 'openai' },
    { sessionId: chatSession001Id, conversationId: 'conv-alipiracha-001', tenantId: pf.tenantId, userId: pf.adminUserId, role: 'user', content: "What's the status of the Q3 tax project tasks?", tokens: { input: 20, output: 0, total: 20 } },
  ];
  for (const m of msgs) {
    await upsert('chatMessage', { id: uuid() }, { id: uuid(), ...m }, {});
  }
  log(`  ${msgs.length} chat messages upserted`);
}

async function seedHermesAgents(pf: Preflight) {
  log('Seeding Hermes agents...');
  // HermesAgent doesn't have a role field — use type
  await upsert('hermesAgent', { id: uuid() }, {
    id: uuid(), tenantId: pf.tenantId, name: 'Tax Advisory Agent', type: 'FINANCE' as const,
    status: 'IDLE' as const, systemPrompt: 'You are a tax advisory AI assistant specializing in US tax compliance...',
    isActive: true, permissions: [], allowedPaths: [], blockedPaths: [],
  }, {});
  log('  hermesAgent: Tax Advisory Agent [FINANCE, IDLE]');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('=== alipiracha@live.com DB Seed ===');
  log(`Started at ${new Date().toISOString()}`);

  const pf = await preflight();

  // FK-ordered seed steps
  await seedDepartments(pf);
  await seedUsers(pf);
  await seedSessions(pf);
  await seedAgentTemplates(pf);
  await seedAgents(pf);
  await seedCustomers(pf);
  const initId = await seedEnterpriseInitiation(pf);
  await seedProject(pf, initId);
  await seedProjectMembers(pf);
  await seedGoals(pf);
  await seedTasks(pf);
  await seedTaskAssignments(pf);
  await seedExecutionAttempts(pf);
  await seedReviews(pf);
  await seedEvidenceArtifacts(pf);
  await seedIdempotencyRecords(pf);
  // Outbox seeding skipped — EnterpriseEventOutbox schema doesn't match content doc (OutboxEvent was renamed)
  await seedAccounting(pf);
  await seedTenantFeatureFlags(pf);
  await seedTierChangeRequest(pf);
  await seedObservability(pf);
  // await seedIntegrationCredentials(pf); // Google integration already exists
  await seedKnowledge(pf);
  await seedProjectDecisions(pf);
  await seedBudgetPolicies(pf);
  await seedTimelineEvents(pf);
  await seedChat(pf);
  await seedHermesAgents(pf);

  log('=== Seed complete ===');
  log(`Tenant ID: ${pf.tenantId}`);
  log(`Admin user: ${pf.adminUserId}`);
  log(`NOTE: Google Drive file creation requires valid OAuth tokens (IntegrationCredential row).`);
  log(`      If Google creds are missing/invalid, run: node scripts/seed-alipiracha-drive.js`);
}

main()
  .catch((err) => {
    console.error('[seed-alipiracha] FATAL:', err.message);
    console.error(err.stack);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
