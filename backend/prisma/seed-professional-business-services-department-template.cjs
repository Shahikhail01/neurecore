#!/usr/bin/env node
/**
 * seed-professional-business-services-department-template.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.4 (Phase 3.B) —
 * professional-business-services Tenant Template.
 *
 * Run:
 *   node prisma/seed-professional-business-services-department-template.cjs
 *   node prisma/seed-professional-business-services-department-template.cjs --check
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
  slug: 'professional-business-services-firm',
  name: 'Professional & Business Services Firm',
  description: 'Tenant Template for `professional-business-services` industry. 6 departments + 6 platform agents. Generic consulting + recruiting; legal services are CUT (T3).',
  category: 'business-technology',
  structure: [
    { name: 'Managing Partner / Principal', description: 'Owns practice P&L, signs off on new engagements, partners with sales on key accounts.', type: 'EXECUTIVE' },
    { name: 'Consulting Practice',          description: 'Engagements delivery: scoping, analysis, recommendations, implementation oversight.', type: 'CORE' },
    { name: 'Business Development',        description: 'Pipeline: prospecting, qualification, proposals, closes.', type: 'CORE' },
    { name: 'Research & Knowledge',        description: 'Internal IP library: research notes, frameworks, case studies, training material.', type: 'CORE' },
    { name: 'Recruiting & Talent',         description: 'Bench management: candidate sourcing, vetting, placement for client projects.', type: 'FUNCTIONAL', parentSlug: 'Business Development' },
    { name: 'Operations Coordinator',      description: 'Cross-engagement coordination, billing ops, vendor management.', type: 'FUNCTIONAL' },
  ],
  agents: [
    { name: 'Engagement Manager',     description: 'Owns delivery: scoping, plan, weekly steering, risk escalation, client status reporting.', type: 'FUNCTIONAL' },
    { name: 'Subject Matter Expert',  description: 'Domain authority: provides analysis, validates recommendations, supports pitches.', type: 'FUNCTIONAL' },
    { name: 'Business Development',   description: 'Pipeline owner: qualifies leads, drafts proposals, negotiates SOWs.', type: 'FUNCTIONAL' },
    { name: 'Research Specialist',    description: 'Knowledge curator: runs secondary research, drafts frameworks, maintains internal wiki.', type: 'FUNCTIONAL' },
    { name: 'Operations Coordinator', description: 'Operational hub: tracks engagement budgets, coordinates vendor interactions, prepares client invoices.', type: 'FUNCTIONAL' },
    { name: 'Compliance Officer',    description: 'Generic governance + regulatory tracking. NOTE: separate from F&C `Compliance Auditor` (audit-bound).', type: 'FUNCTIONAL' },
  ],
  options: { isPublic: true, tags: ['professional-business-services', 'phase-3.B', 'b-t-group', 'no-legal'] },
};

const TENANT_TEMPLATE_ROWS = [
  {
    slug: 'pro-client-lifecycle',
    name: 'Pro Client Lifecycle',
    description: 'Lifecycle for consulting clients: prospect → engagement → delivery → renewal.',
    templateType: 'CUSTOMER_LIFECYCLE',
    industrySlug: 'professional-business-services',
    config: {
      stages: [
        { name: 'Prospect',    terminalStatus: false },
        { name: 'Engagement',  terminalStatus: false },
        { name: 'Delivery',    terminalStatus: false },
        { name: 'Renewal',     terminalStatus: false },
        { name: 'Offboarding', terminalStatus: true  },
      ],
    },
    sourceSeedId: 'phase-3.B',
  },
  {
    slug: 'pro-department-default',
    name: 'Pro Department Default',
    description: 'Default department structure for new professional-services tenants.',
    templateType: 'DEPARTMENT_DEFAULT',
    industrySlug: 'professional-business-services',
    config: { departments: TEMPLATE.structure.map((s) => ({ name: s.name, type: s.type })) },
    sourceSeedId: 'phase-3.B',
  },
];

(async () => {
  console.log(`Pro Services Tenant Template seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
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
    console.error(`  ✘ DepartmentTemplate: ${err.message}`);
    process.exitCode = 1;
  }

  try {
    const ttCount = await seedTenantTemplateRows({ prisma, dryRun: DRY_RUN, rows: TENANT_TEMPLATE_ROWS });
    console.log(`  ✓ TenantTemplate rows: ${ttCount.count}`);
  } catch (err) {
    console.error(`  ✘ TenantTemplate rows: ${err.message}`);
    process.exitCode = 1;
  }

  if (DRY_RUN) console.log('\nDRY RUN — no changes written. Re-run without --check to apply.');
})()
  .catch((err) => { console.error('Fatal:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });