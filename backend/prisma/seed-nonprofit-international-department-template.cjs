#!/usr/bin/env node
/**
 * seed-nonprofit-international-department-template.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.7 (Phase 5.A) — nonprofit-international
 * Tenant Template. 6 departments + 4 agents. Reuses question packs from
 * `seeds/question-packs/*.json`.
 */

'use strict';

const { loadEnv } = require('./seed-helpers/load-env.cjs');
loadEnv();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ transactionOptions: { timeout: 30_000, maxWait: 5_000 } });
const { seedTenantTemplate } = require('./seed-helpers/seed-tenant-template.cjs');
const { seedTenantTemplateRows } = require('./seed-helpers/seed-tenant-template-rows.cjs');

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');

const TEMPLATE = {
  slug: 'nonprofit-international-ngo',
  name: 'Nonprofit & International NGO',
  description: 'Tenant Template for `nonprofit-international` industry. 6 departments + 4 platform agents. T6: uses `operations-coordinator` + `+compliance_pack` for compliance; no dedicated `compliance-officer` (T7 reserved for SPO).',
  category: 'public-social',
  structure: [
    { name: 'Executive Director',     description: 'Owns mission delivery + financial sustainability + board reporting.', type: 'EXECUTIVE' },
    { name: 'Programs',               description: 'Program design, beneficiary engagement, field operations.', type: 'CORE' },
    { name: 'Development / Fundraising', description: 'Grant pipeline, major donor cultivation, foundation relationships.', type: 'CORE' },
    { name: 'Operations',             description: 'Day-to-day org ops: HR, finance (non-grant), facilities, IT.', type: 'CORE' },
    { name: 'Donor Stewardship',      description: 'Donor CRM: acknowledgments, impact reporting, retention.', type: 'FUNCTIONAL', parentSlug: 'Development / Fundraising' },
    { name: 'Compliance & Reporting', description: 'Regulatory compliance (state charity filings, international NGO rules), board reporting.', type: 'FUNCTIONAL', parentSlug: 'Executive Director' },
  ],
  agents: [
    { name: 'Program Manager',    description: 'Owns program delivery: plans, executes, measures, reports on outcomes.', type: 'FUNCTIONAL' },
    { name: 'Grant Writer',       description: 'Pipeline owner: researches funders, drafts proposals, shepherds submissions, reports on grants.', type: 'FUNCTIONAL' },
    { name: 'Donor Stewardship',  description: 'Donor relations: sends acknowledgments, prepares impact reports, drives retention.', type: 'FUNCTIONAL' },
    { name: 'Operations Coordinator', description: 'Operational backbone: HR, vendor management, internal comms.', type: 'FUNCTIONAL' },
  ],
  options: { isPublic: true, tags: ['nonprofit-international', 'phase-5.A', 'public-social'] },
};

const TENANT_TEMPLATE_ROWS = [
  {
    slug: 'ngo-beneficiary-lifecycle',
    name: 'NGO Beneficiary Lifecycle',
    description: 'Lifecycle for NGO beneficiaries: enrolled → active → graduated.',
    templateType: 'CUSTOMER_LIFECYCLE',
    industrySlug: 'nonprofit-international',
    config: {
      stages: [
        { name: 'Enrolled', terminalStatus: false },
        { name: 'Active',   terminalStatus: false },
        { name: 'Graduated', terminalStatus: true  },
      ],
    },
    sourceSeedId: 'phase-5.A',
  },
  {
    slug: 'ngo-department-default',
    name: 'NGO Department Default',
    description: 'Default department structure for new NGO tenants.',
    templateType: 'DEPARTMENT_DEFAULT',
    industrySlug: 'nonprofit-international',
    config: { departments: TEMPLATE.structure.map((s) => ({ name: s.name, type: s.type })) },
    sourceSeedId: 'phase-5.A',
  },
  {
    slug: 'ngo-agent-role-grant-writer',
    name: 'NGO Agent Role — Grant Writer',
    description: 'Default role prompt for the Grant Writer agent in NGO tenants.',
    templateType: 'AGENT_ROLE',
    industrySlug: 'nonprofit-international',
    config: {
      rolePrompt: 'You are a Grant Writer for a nonprofit tenant. Research funders, draft proposals, shepherd submissions, and report on grants. Always align proposals with the tenant\'s mission; never fabricate impact metrics.',
      allowedTools: ['grant.create', 'grant.update', 'funder.search'],
      maxConcurrentTasks: 5,
    },
    sourceSeedId: 'phase-5.A',
  },
];

(async () => {
  console.log(`NGO Tenant Template seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));

  try {
    const result = await seedTenantTemplate({
      prisma, slug: TEMPLATE.slug, name: TEMPLATE.name,
      description: TEMPLATE.description, category: TEMPLATE.category,
      structure: TEMPLATE.structure, agents: TEMPLATE.agents,
      options: { ...TEMPLATE.options, dryRun: DRY_RUN },
    });
    console.log(`  ✓ DepartmentTemplate: ${TEMPLATE.slug}`);
    console.log(`  ✓ Departments:        ${TEMPLATE.structure.length}`);
    console.log(`  ✓ Agents:             ${TEMPLATE.agents.length}`);
    if (!DRY_RUN) console.log(`  ✓ templateId:         ${result.templateId}`);
  } catch (err) {
    console.error(`  ✘ ${err.message}`);
    process.exitCode = 1;
  }

  try {
    const ttCount = await seedTenantTemplateRows({ prisma, dryRun: DRY_RUN, rows: TENANT_TEMPLATE_ROWS });
    console.log(`  ✓ TenantTemplate rows: ${ttCount.count}`);
  } catch (err) {
    console.error(`  ✘ ${err.message}`);
    process.exitCode = 1;
  }

  if (DRY_RUN) console.log('\nDRY RUN — no changes written.');
})()
  .catch((err) => { console.error('Fatal:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });