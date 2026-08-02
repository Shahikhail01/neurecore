#!/usr/bin/env node
/**
 * seed-retail-commerce-consumer-department-template.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.5 (Phase 4.A) — retail-commerce-consumer
 * Tenant Template. 7 departments + 5 agents.
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
  slug: 'retail-commerce-store',
  name: 'Retail Commerce Store',
  description: 'Tenant Template for `retail-commerce-consumer` industry. 7 departments + 5 platform agents. T4: Inventory uses Document store, no specialized SKU entity.',
  category: 'consumer-commerce',
  structure: [
    { name: 'Store Director / GM',    description: 'Single accountable owner for store P&L, staffing, customer satisfaction.', type: 'EXECUTIVE' },
    { name: 'Store Operations',      description: 'Daily store ops: opening/closing, cash reconciliation, shift scheduling.', type: 'CORE' },
    { name: 'Merchandising',         description: 'Assortment planning, pricing strategy, promotional mix, supplier management.', type: 'CORE' },
    { name: 'Marketing & Campaigns', description: 'Campaign planning, audience targeting, content calendar, channel mix.', type: 'CORE' },
    { name: 'Customer Service',      description: 'Returns, complaints, loyalty program questions, post-purchase follow-up.', type: 'CORE' },
    { name: 'Analytics & Insights',  description: 'Sales analytics, customer segmentation, campaign performance.', type: 'FUNCTIONAL', parentSlug: 'Store Director / GM' },
    { name: 'E-Commerce Operations', description: 'Online store ops: product listing, order fulfillment, digital marketing.', type: 'FUNCTIONAL', parentSlug: 'Marketing & Campaigns' },
  ],
  agents: [
    { name: 'Operations Manager',     description: 'Owns daily store ops: shift schedule, cash reconciliation, opening/closing checklists.', type: 'FUNCTIONAL' },
    { name: 'Customer Service Rep',   description: 'Frontline service: handles returns, complaints, loyalty queries.', type: 'FUNCTIONAL' },
    { name: 'Merchandiser',           description: 'Assortment + pricing: plans category mix, sets promotional prices, negotiates with suppliers.', type: 'FUNCTIONAL' },
    { name: 'Marketing Manager',      description: 'Campaign owner: plans promotions, briefs creative, monitors ROAS.', type: 'FUNCTIONAL' },
    { name: 'Analytics Manager',      description: 'Insight generator: produces weekly sales/customer reports, identifies trends.', type: 'FUNCTIONAL' },
  ],
  options: { isPublic: true, tags: ['retail-commerce-consumer', 'phase-4.A', 'consumer-commerce', 't4-document-store'] },
};

const TENANT_TEMPLATE_ROWS = [
  {
    slug: 'retail-customer-lifecycle',
    name: 'Retail Customer Lifecycle',
    description: 'Standard retail customer journey: prospect → first purchase → loyal → advocate.',
    templateType: 'CUSTOMER_LIFECYCLE',
    industrySlug: 'retail-commerce-consumer',
    config: {
      stages: [
        { name: 'Prospect',     terminalStatus: false },
        { name: 'First Purchase', terminalStatus: false },
        { name: 'Loyal',        terminalStatus: false },
        { name: 'Advocate',     terminalStatus: false },
      ],
    },
    sourceSeedId: 'phase-4.A',
  },
  {
    slug: 'retail-department-default',
    name: 'Retail Department Default',
    description: 'Default department structure for new retail tenants.',
    templateType: 'DEPARTMENT_DEFAULT',
    industrySlug: 'retail-commerce-consumer',
    config: { departments: TEMPLATE.structure.map((s) => ({ name: s.name, type: s.type })) },
    sourceSeedId: 'phase-4.A',
  },
];

(async () => {
  console.log(`Retail Tenant Template seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
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