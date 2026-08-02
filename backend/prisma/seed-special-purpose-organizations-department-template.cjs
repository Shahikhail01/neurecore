#!/usr/bin/env node
/**
 * seed-special-purpose-organizations-department-template.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.8 (Phase 5.B) —
 * special-purpose-organizations Tenant Template. 4 departments + 3 agents.
 * T7: `compliance-officer` agent is generic (separate from F&C `Compliance Auditor`).
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
  slug: 'special-purpose-organizations-holding',
  name: 'Special Purpose Organizations (Holding)',
  description: 'Tenant Template for `special-purpose-organizations` industry. 4 departments + 3 agents. T8: enterprise package inherits F&C `accounting-operations` via cross-group Package.parentPackageId.',
  category: 'other',
  structure: [
    { name: 'Managing Director / Principal', description: 'Owns holding company strategy, inter-entity coordination, board governance.', type: 'EXECUTIVE' },
    { name: 'Operations',                   description: 'Inter-entity operations, shared services coordination.', type: 'CORE' },
    { name: 'Finance & Accounting',         description: 'Multi-entity accounting, treasury, consolidated reporting.', type: 'CORE' },
    { name: 'Compliance & Governance',      description: 'Corporate filings, beneficial ownership tracking, regulatory compliance.', type: 'CORE' },
  ],
  agents: [
    { name: 'Operations Coordinator',  description: 'Operational backbone: inter-entity scheduling, vendor management, shared services.', type: 'FUNCTIONAL' },
    { name: 'Finance Controller',       description: 'Multi-entity accountant: consolidates financials across entities, manages intercompany, prepares reports.', type: 'FUNCTIONAL' },
    // T7: generic compliance-officer — SEPARATE from F&C Compliance Auditor.
    { name: 'Compliance Officer',       description: 'Governance + regulatory: corporate filings (annual reports, beneficial ownership), board minutes, regulatory tracking. GENERIC — separate from F&C Compliance Auditor (audit-bound).', type: 'FUNCTIONAL' },
  ],
  options: { isPublic: true, tags: ['special-purpose-organizations', 'phase-5.B', 'other', 't7-compliance-officer', 't8-cross-group'] },
};

const TENANT_TEMPLATE_ROWS = [
  {
    slug: 'spo-entity-lifecycle',
    name: 'SPO Entity Lifecycle',
    description: 'Lifecycle for a holding-company entity: formation → operation → restructure → dissolution.',
    templateType: 'CUSTOMER_LIFECYCLE',
    industrySlug: 'special-purpose-organizations',
    config: {
      stages: [
        { name: 'Formation',   terminalStatus: false },
        { name: 'Operation',   terminalStatus: false },
        { name: 'Restructure', terminalStatus: false },
        { name: 'Dissolution', terminalStatus: true  },
      ],
    },
    sourceSeedId: 'phase-5.B',
  },
  {
    slug: 'spo-department-default',
    name: 'SPO Department Default',
    description: 'Default department structure for new SPO tenants.',
    templateType: 'DEPARTMENT_DEFAULT',
    industrySlug: 'special-purpose-organizations',
    config: { departments: TEMPLATE.structure.map((s) => ({ name: s.name, type: s.type })) },
    sourceSeedId: 'phase-5.B',
  },
];

(async () => {
  console.log(`SPO Tenant Template seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
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