#!/usr/bin/env node
/**
 * seed-media-communications-creative-department-template.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.6 (Phase 4.B) —
 * media-communications-creative Tenant Template. 5 departments + 4 agents.
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
  slug: 'media-creative-agency',
  name: 'Media & Creative Agency',
  description: 'Tenant Template for `media-communications-creative` industry. 5 departments + 4 platform agents. Different from retail in exec structure: Creative Director at top, Production + Creative as peers.',
  category: 'consumer-commerce',
  structure: [
    { name: 'Creative Director', description: 'Owns creative output quality, approves final deliverables, pitches on key accounts.', type: 'EXECUTIVE' },
    { name: 'Creative / Design', description: 'Concepting, design execution, copy.', type: 'CORE' },
    { name: 'Production',       description: 'Content production: shoot/edit/publish across formats.', type: 'CORE' },
    { name: 'Client Services',  description: 'Client-facing: briefs, status, approvals, billing.', type: 'CORE' },
    { name: 'Operations Coordinator', description: 'Resource scheduling, vendor coordination.', type: 'FUNCTIONAL', parentSlug: 'Client Services' },
  ],
  agents: [
    { name: 'Creative Director',     description: 'Creative authority: signs off on concepts + final deliverables, mentors creative team.', type: 'FUNCTIONAL' },
    { name: 'Copywriter',           description: 'Brand voice + content craft: writes copy across formats, maintains tone consistency.', type: 'FUNCTIONAL' },
    { name: 'Content Producer',     description: 'Production lead: schedules shoots, manages editors, ships deliverables on time.', type: 'FUNCTIONAL' },
    { name: 'Project Manager Creative', description: 'Client interface: runs status, manages scope, shepherds approvals.', type: 'FUNCTIONAL' },
  ],
  options: { isPublic: true, tags: ['media-communications-creative', 'phase-4.B', 'consumer-commerce'] },
};

const TENANT_TEMPLATE_ROWS = [
  {
    slug: 'media-client-lifecycle',
    name: 'Media Client Lifecycle',
    description: 'Lifecycle for media clients: prospect → brief → production → renewal.',
    templateType: 'CUSTOMER_LIFECYCLE',
    industrySlug: 'media-communications-creative',
    config: {
      stages: [
        { name: 'Prospect',   terminalStatus: false },
        { name: 'Brief',      terminalStatus: false },
        { name: 'Production', terminalStatus: false },
        { name: 'Renewal',    terminalStatus: false },
        { name: 'Offboarding', terminalStatus: true },
      ],
    },
    sourceSeedId: 'phase-4.B',
  },
  {
    slug: 'media-department-default',
    name: 'Media Department Default',
    description: 'Default department structure for new media tenants.',
    templateType: 'DEPARTMENT_DEFAULT',
    industrySlug: 'media-communications-creative',
    config: { departments: TEMPLATE.structure.map((s) => ({ name: s.name, type: s.type })) },
    sourceSeedId: 'phase-4.B',
  },
];

(async () => {
  console.log(`Media Tenant Template seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
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