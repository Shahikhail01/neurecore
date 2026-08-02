#!/usr/bin/env node
/**
 * seed-technology-digital-services-department-template.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.3 (Phase 3.A) — technology-digital-services
 * Tenant Template (DepartmentTemplate + 7 AgentTemplate rows + TenantTemplate rows).
 *
 * Uses the R2 `seed-tenant-template` + `seed-tenant-template-rows` helpers.
 *
 * Run:
 *   node prisma/seed-technology-digital-services-department-template.cjs
 *   node prisma/seed-technology-digital-services-department-template.cjs --check
 */

'use strict';

const { loadEnv } = require('./seed-helpers/load-env.cjs');
loadEnv();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  transactionOptions: { timeout: 30_000, maxWait: 5_000 },
});

const { seedTenantTemplate } = require('./seed-helpers/seed-tenant-template.cjs');
const { seedTenantTemplateRows } = require('./seed-helpers/seed-tenant-template-rows.cjs');

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');

const TEMPLATE = {
  slug: 'tech-digital-services-it',
  name: 'Technology & Digital Services (IT)',
  description: 'Tenant Template for `technology-digital-services` industry. 7 departments + 7 platform agents. The original Run-6 template; this seeder is idempotent over the existing seed and adds the canonical TenantTemplate rows.',
  category: 'business-technology',
  structure: [
    { name: 'Managing Director / Partner', description: 'Owns P&L, signs off on new client engagements, partners with sales on enterprise deals.', type: 'EXECUTIVE' },
    { name: 'Engineering', description: 'Technical delivery: architecture, code review, technical risk assessment.', type: 'CORE' },
    { name: 'Product', description: 'Roadmap, requirements, user research, prioritization.', type: 'CORE' },
    { name: 'DevOps', description: 'CI/CD, infrastructure, observability, incident response.', type: 'CORE' },
    { name: 'Quality Assurance', description: 'Test strategy, automation, regression, release gating.', type: 'CORE' },
    { name: 'Client Success', description: 'Post-sale relationship: SLA monitoring, renewals, expansion.', type: 'FUNCTIONAL' },
    { name: 'Operations Coordinator', description: 'Cross-team coordination, vendor management, billing ops.', type: 'FUNCTIONAL' },
  ],
  agents: [
    { name: 'Tech Delivery Lead',           description: 'Senior delivery lead: owns project plan, escalates risks, runs weekly steering.', type: 'FUNCTIONAL' },
    { name: 'Technical Lead',              description: 'Engineering authority: reviews architecture, signs off on technical decisions, mentors engineers.', type: 'FUNCTIONAL' },
    { name: 'Product Manager',             description: 'Product owner: writes specs, prioritizes backlog, validates outcomes.', type: 'FUNCTIONAL' },
    { name: 'DevOps Specialist',           description: 'Infrastructure + reliability: owns CI/CD, on-call rotation, capacity planning.', type: 'FUNCTIONAL' },
    { name: 'QA Engineer',                 description: 'Quality gate: designs test plans, automates regressions, blocks releases on failure.', type: 'FUNCTIONAL' },
    { name: 'Client Success Manager',      description: 'Post-sale success: monitors SLA, drives renewal, identifies expansion.', type: 'FUNCTIONAL' },
    { name: 'Operations Coordinator',      description: 'Operational backbone: tracks vendor SLAs, coordinates cross-team deliverables.', type: 'FUNCTIONAL' },
  ],
  options: {
    isPublic: true,
    tags: ['technology-digital-services', 'phase-3.A', 'b-t-group', 'run-6-original'],
  },
};

const TENANT_TEMPLATE_ROWS = [
  {
    slug: 'tech-client-lifecycle',
    name: 'Tech Client Lifecycle',
    description: 'Standard lifecycle for IT services clients: prospect → kickoff → delivery → renewal.',
    templateType: 'CUSTOMER_LIFECYCLE',
    industrySlug: 'technology-digital-services',
    config: {
      stages: [
        { name: 'Prospect',    terminalStatus: false },
        { name: 'Kickoff',     terminalStatus: false },
        { name: 'Delivery',    terminalStatus: false },
        { name: 'Renewal',     terminalStatus: false },
        { name: 'Offboarding', terminalStatus: true  },
      ],
    },
    sourceSeedId: 'phase-3.A',
  },
  {
    slug: 'tech-department-default',
    name: 'Tech Department Default',
    description: 'Default department structure for new tech-digital-services tenants.',
    templateType: 'DEPARTMENT_DEFAULT',
    industrySlug: 'technology-digital-services',
    config: {
      departments: TEMPLATE.structure.map((s) => ({ name: s.name, type: s.type })),
    },
    sourceSeedId: 'phase-3.A',
  },
  {
    slug: 'tech-agent-role-tech-delivery-lead',
    name: 'Tech Agent Role — Delivery Lead',
    description: 'Default role prompt for the Tech Delivery Lead agent.',
    templateType: 'AGENT_ROLE',
    industrySlug: 'technology-digital-services',
    config: {
      rolePrompt: 'You are a Tech Delivery Lead for a technology tenant. Own project plan, escalate risks, run weekly steering meetings, and ensure client status is always current. Coordinate with Technical Lead for technical decisions.',
      allowedTools: ['project.create', 'project.update', 'task.assign', 'task.update'],
      maxConcurrentTasks: 8,
    },
    sourceSeedId: 'phase-3.A',
  },
];

(async () => {
  console.log(`Tech & Digital Services Tenant Template seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));

  try {
    const result = await seedTenantTemplate({
      prisma,
      slug: TEMPLATE.slug,
      name: TEMPLATE.name,
      description: TEMPLATE.description,
      category: TEMPLATE.category,
      structure: TEMPLATE.structure,
      agents: TEMPLATE.agents,
      options: { ...TEMPLATE.options, dryRun: DRY_RUN },
    });
    console.log(`  ✓ DepartmentTemplate: ${TEMPLATE.slug}`);
    console.log(`  ✓ Departments:        ${TEMPLATE.structure.length}`);
    console.log(`  ✓ Agents:             ${TEMPLATE.agents.length}`);
    if (!DRY_RUN) {
      console.log(`  ✓ templateId:         ${result.templateId}`);
      console.log(`  ✓ agentIds:           ${result.agentIds.length}`);
    }
  } catch (err) {
    console.error(`  ✘ DepartmentTemplate: ${err.message}`);
    process.exitCode = 1;
  }

  try {
    const ttCount = await seedTenantTemplateRows({
      prisma,
      dryRun: DRY_RUN,
      rows: TENANT_TEMPLATE_ROWS,
    });
    console.log(`  ✓ TenantTemplate rows: ${ttCount.count}`);
  } catch (err) {
    console.error(`  ✘ TenantTemplate rows: ${err.message}`);
    process.exitCode = 1;
  }

  if (DRY_RUN) {
    console.log('');
    console.log('DRY RUN — no changes written. Re-run without --check to apply.');
  }
})()
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });