#!/usr/bin/env node
/**
 * seed-retail-commerce-consumer-packages.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.5 (Phase 4.A) — retail-commerce-consumer
 * package catalogue. 8 packages across 3 tiers.
 */

'use strict';

const { loadEnv } = require('./seed-helpers/load-env.cjs');
loadEnv();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ transactionOptions: { timeout: 30_000, maxWait: 5_000 } });
const { seedPackage } = require('./seed-helpers/seed-package.cjs');

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');

const PACKAGES = [
  // ─── Starter tier (2) ────────────────────────────────────────────────
  {
    slug: 'retail-store-operations', name: 'Retail Store Operations', scope: 'FUNCTIONAL', tierSlug: 'starter',
    description: 'Daily store operations from open to close, audit-logged.',
    departmentTemplateSlugs: ['retail-commerce-store'],
    agentTemplateNames: ['Operations Manager', 'Customer Service Rep'],
    featureKeys: ['workflow_automation', 'two_factor', 'sso'],
  },
  {
    slug: 'retail-customer-loyalty', name: 'Customer Loyalty', scope: 'FUNCTIONAL', tierSlug: 'starter',
    description: 'Loyalty program + retention campaigns.',
    departmentTemplateSlugs: ['retail-commerce-store'],
    agentTemplateNames: ['Customer Service Rep', 'Marketing Manager'],
    featureKeys: ['crm_integration', 'workflow_automation'],
  },

  // ─── Professional tier (3) ──────────────────────────────────────────
  {
    slug: 'retail-merchandising', name: 'Merchandising & Assortment', scope: 'FUNCTIONAL', tierSlug: 'professional',
    description: 'Category mix, pricing, promo planning. Inventory uses Document store (T4).',
    departmentTemplateSlugs: ['retail-commerce-store'],
    agentTemplateNames: ['Merchandiser', 'Analytics Manager'],
    featureKeys: ['workflow_automation', 'custom_reports', 'document_templates'],
  },
  {
    slug: 'retail-marketing-campaigns', name: 'Marketing Campaigns', scope: 'FUNCTIONAL', tierSlug: 'professional',
    description: 'Multi-channel campaign orchestration.',
    departmentTemplateSlugs: ['retail-commerce-store'],
    agentTemplateNames: ['Marketing Manager', 'Analytics Manager'],
    featureKeys: ['crm_integration', 'workflow_automation', 'custom_reports', 'webhooks'],
  },
  {
    slug: 'retail-ecommerce', name: 'E-Commerce Operations', scope: 'VERTICAL', tierSlug: 'professional',
    description: 'Online store ops + digital marketing + analytics.',
    departmentTemplateSlugs: ['retail-commerce-store'],
    agentTemplateNames: ['Operations Manager', 'Marketing Manager', 'Analytics Manager'],
    featureKeys: ['crm_integration', 'workflow_automation', 'api_access', 'webhooks'],
  },

  // ─── Enterprise tier (3) ────────────────────────────────────────────
  {
    slug: 'retail-multistore', name: 'Multi-Store Operations', scope: 'VERTICAL', tierSlug: 'enterprise',
    description: 'Multi-location ops dashboard + consolidated reporting.',
    departmentTemplateSlugs: ['retail-commerce-store'],
    agentTemplateNames: ['Operations Manager', 'Customer Service Rep', 'Merchandiser', 'Marketing Manager', 'Analytics Manager'],
    featureKeys: ['workflow_automation', 'api_access', 'webhooks', 'sso', 'two_factor', 'ms365_integration', 'google_workspace', 'custom_reports'],
  },
  {
    slug: 'retail-seasonal-campaigns', name: 'Seasonal Campaign Playbook', scope: 'VERTICAL', tierSlug: 'enterprise',
    description: 'Seasonal promotion playbook with pre-built workflows.',
    departmentTemplateSlugs: ['retail-commerce-store'],
    agentTemplateNames: ['Marketing Manager', 'Merchandiser', 'Analytics Manager'],
    featureKeys: ['crm_integration', 'workflow_automation', 'custom_reports', 'document_templates'],
  },
  {
    slug: 'retail-enterprise-platform', name: 'Retail Enterprise Platform', scope: 'VERTICAL', tierSlug: 'enterprise',
    description: 'Full retail stack for enterprise tenants + integrations.',
    departmentTemplateSlugs: ['retail-commerce-store'],
    agentTemplateNames: ['Operations Manager', 'Customer Service Rep', 'Merchandiser', 'Marketing Manager', 'Analytics Manager'],
    featureKeys: ['workflow_automation', 'api_access', 'webhooks', 'erp_integration', 'ms365_integration', 'custom_reports', 'sso', 'two_factor'],
  },
];

(async () => {
  console.log(`Retail package seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));
  console.log(`Total packages: ${PACKAGES.length}`);
  console.log('');

  const counts = { starter: 0, professional: 0, enterprise: 0 };
  for (const pkg of PACKAGES) {
    try {
      await seedPackage({
        prisma, industrySlug: 'retail-commerce-consumer', tierSlug: pkg.tierSlug,
        packageDef: {
          slug: pkg.slug, name: pkg.name, scope: pkg.scope, description: pkg.description,
          departmentTemplateSlugs: pkg.departmentTemplateSlugs,
          agentTemplateNames: pkg.agentTemplateNames, featureKeys: pkg.featureKeys,
        },
        dryRun: DRY_RUN,
      });
      counts[pkg.tierSlug]++;
      console.log(`  ✓ ${pkg.tierSlug.padEnd(12)} ${pkg.slug}`);
    } catch (err) {
      console.error(`  ✘ ${pkg.tierSlug} ${pkg.slug}: ${err.message}`);
      if (!DRY_RUN) process.exitCode = 1;
    }
  }

  console.log('');
  console.log('Summary:');
  console.log(`  starter:      ${counts.starter}`);
  console.log(`  professional: ${counts.professional}`);
  console.log(`  enterprise:   ${counts.enterprise}`);
  console.log(`  TOTAL:        ${PACKAGES.length}`);

  if (DRY_RUN) console.log('\nDRY RUN — no changes written.');
})()
  .catch((err) => { console.error('Fatal:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });