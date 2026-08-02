#!/usr/bin/env node
/**
 * seed-financial-services-department-template.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.2 (Phase 2.B) — financial-services
 * Tenant Template (DepartmentTemplate + 8 AgentTemplate rows).
 *
 * Uses the R2 `seed-tenant-template` helper. ~50 lines of business data,
 * 0 lines of boilerplate. Idempotent: re-run = no-op.
 *
 * Run:
 *   node prisma/seed-financial-services-department-template.cjs          # apply
 *   node prisma/seed-financial-services-department-template.cjs --check  # dry-run
 *
 * Pre-requisites:
 *   node prisma/seed-industries-majors.cjs                             # industry must exist
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
  slug: 'financial-services-bank',
  name: 'Financial Services Bank',
  description: 'Tenant Template for `financial-services` industry. 8 departments + 8 platform agents. Wired via `seed-package` to FS packages.',
  category: 'financial-compliance', // P13 will turn this into enum; free-text until then.
  structure: [
    { name: 'Bank Manager / Firm Principal', description: 'Oversees firm-wide operations, regulatory standing, and strategic direction. Single accountable owner for SAFE/BSA audits.', type: 'EXECUTIVE' },
    { name: 'Client Onboarding',             description: 'Performs KYC intake, beneficial-ownership verification, sanctions screening, and risk rating at account opening.', type: 'CORE' },
    { name: 'Front Office / Teller Ops',     description: 'Day-to-day client servicing: deposits, withdrawals, transfers, statement reconciliation, dispute intake.', type: 'CORE' },
    { name: 'Lending Operations',            description: 'Loan origination, underwriting, documentation, servicing, and collections.', type: 'CORE' },
    { name: 'Compliance & Risk',             description: 'Policy management, regulatory reporting (SAR/CTR), internal audit coordination, model risk oversight.', type: 'CORE' },
    { name: 'AML / BSA Specialist',          description: 'Transaction monitoring, alert triage, suspicious activity investigation, 314(a) requests.', type: 'FUNCTIONAL', parentSlug: 'Compliance & Risk' },
    { name: 'Wealth Advisor',                description: 'Portfolio construction, client suitability, rebalancing proposals, performance reporting.', type: 'FUNCTIONAL', parentSlug: 'Front Office / Teller Ops' },
    { name: 'Operations Coordinator',        description: 'Cross-department scheduling, document routing, vendor management, workflow SLAs.', type: 'FUNCTIONAL' },
  ],
  agents: [
    { name: 'Firm Principal',           description: 'Senior principal responsible for firm-wide governance. Reviews escalation queues, signs off on regulatory filings, and approves high-risk client onboarding.', type: 'EXECUTIVE' },
    { name: 'KYC Officer',              description: 'Performs KYC intake: collects beneficial-ownership documents, runs sanctions/PEP screening, sets risk rating, and queues compliance review.', type: 'FUNCTIONAL' },
    { name: 'Client Relationship Manager', description: 'Day-to-day client service: handles service requests, coordinates with operations, prepares account reviews.', type: 'FUNCTIONAL' },
    { name: 'Loan Officer',             description: 'Loan origination specialist: structures credit memos, runs underwriting, prepares approval packages, monitors covenants.', type: 'FUNCTIONAL' },
    { name: 'Compliance Analyst',       description: 'Compliance generalist: reviews marketing materials, monitors transactions against policy, prepares regulatory reports.', type: 'FUNCTIONAL' },
    { name: 'AML Analyst',              description: 'AML/BSA specialist: investigates monitoring alerts, drafts SAR narratives, escalates to compliance officer when threshold exceeded.', type: 'FUNCTIONAL' },
    { name: 'Wealth Advisor',           description: 'Portfolio construction: proposes allocations matching client suitability profile, prepares quarterly performance reports.', type: 'FUNCTIONAL' },
    { name: 'Operations Coordinator',   description: 'Operational hub: routes documents, tracks workflow SLAs, escalates blockers, coordinates vendor interactions.', type: 'FUNCTIONAL' },
  ],
  options: {
    isPublic: true,
    tags: ['financial-services', 'phase-2.B', 'f-c-group'],
  },
};

(async () => {
  console.log(`Financial Services Tenant Template seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
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
    console.log(`  ✓ Tenant Template: ${TEMPLATE.slug}`);
    console.log(`  ✓ Departments:    ${TEMPLATE.structure.length}`);
    console.log(`  ✓ Agents:         ${TEMPLATE.agents.length}`);
    if (!DRY_RUN) {
      console.log(`  ✓ templateId:     ${result.templateId}`);
      console.log(`  ✓ agentIds:       ${result.agentIds.length} created/updated`);
    }
  } catch (err) {
    console.error(`  ✘ DepartmentTemplate: ${err.message}`);
    process.exitCode = 1;
  }

  // ─── TenantTemplate rows for FS lifecycle + roles ───────────────────
  try {
    const ttCount = await seedTenantTemplateRows({
      prisma,
      dryRun: DRY_RUN,
      rows: [
        {
          slug: 'fs-customer-lifecycle',
          name: 'FS Customer Lifecycle',
          description: 'Standard lifecycle for financial-services clients: prospect → KYC review → active → offboard.',
          templateType: 'CUSTOMER_LIFECYCLE',
          industrySlug: 'financial-services',
          config: {
            stages: [
              { name: 'Prospect',         terminalStatus: false },
              { name: 'KYC Review',       terminalStatus: false },
              { name: 'Active',           terminalStatus: false },
              { name: 'Offboarding',      terminalStatus: true  },
            ],
            approvalTemplate: [
              { stepOrder: 0, approverRole: 'KYC_OFFICER',     approvalType: 'LIFECYCLE_TRANSITION', riskTier: ['LOW'] },
              { stepOrder: 1, approverRole: 'FIRM_PRINCIPAL',  approvalType: 'LIFECYCLE_TRANSITION', riskTier: ['HIGH'] },
            ],
          },
          sourceSeedId: 'phase-2.B',
        },
        {
          slug: 'fs-agent-role-kyc-officer',
          name: 'FS Agent Role — KYC Officer',
          description: 'Default role prompt for the KYC Officer agent in financial-services tenants.',
          templateType: 'AGENT_ROLE',
          industrySlug: 'financial-services',
          config: {
            rolePrompt: 'You are a KYC Officer for a financial-services tenant. Perform KYC intake: collect beneficial-ownership documents, run sanctions/PEP screening, set risk rating, and queue compliance review. Never approve high-risk onboarding yourself — always escalate to the Firm Principal.',
            allowedTools: ['customer.create', 'customer.update', 'compliance.run-kyc'],
            maxConcurrentTasks: 10,
          },
          sourceSeedId: 'phase-2.B',
        },
        {
          slug: 'fs-department-default',
          name: 'FS Department Default',
          description: 'Default department structure for new financial-services tenants (8 departments).',
          templateType: 'DEPARTMENT_DEFAULT',
          industrySlug: 'financial-services',
          config: {
            departments: TEMPLATE.structure.map((s) => ({
              name: s.name,
              type: s.type,
              parentName: s.parentSlug ?? null,
            })),
          },
          sourceSeedId: 'phase-2.B',
        },
      ],
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