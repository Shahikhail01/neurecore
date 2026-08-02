#!/usr/bin/env node
/**
 * seed-professional-business-services-packages.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.4 (Phase 3.B) — 5 packages
 * (post-T3 legal cut). Uses R2 seed-package helper.
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
    slug: 'professional-consulting', name: 'Professional Consulting', scope: 'FUNCTIONAL', tierSlug: 'starter',
    description: 'Management consulting engagement delivery and client management.',
    departmentTemplateSlugs: ['professional-business-services-firm'],
    agentTemplateNames: ['Engagement Manager', 'Subject Matter Expert', 'Operations Coordinator'],
    featureKeys: ['workflow_automation', 'crm_integration', 'sso'],
  },
  {
    slug: 'professional-business-dev', name: 'Business Development', scope: 'FUNCTIONAL', tierSlug: 'starter',
    description: 'Prospect qualification, proposal development, and pipeline management.',
    departmentTemplateSlugs: ['professional-business-services-firm'],
    agentTemplateNames: ['Business Development', 'Operations Coordinator'],
    featureKeys: ['crm_integration', 'workflow_automation', 'two_factor'],
  },

  // ─── Professional tier (2) — professional-legal CUT per T3 ────────────
  {
    slug: 'professional-research-knowledge', name: 'Research & Knowledge Management', scope: 'FUNCTIONAL', tierSlug: 'professional',
    description: 'Internal knowledge base that improves every engagement.',
    departmentTemplateSlugs: ['professional-business-services-firm'],
    agentTemplateNames: ['Research Specialist', 'Subject Matter Expert'],
    featureKeys: ['workflow_automation', 'document_templates', 'custom_reports'],
  },
  {
    slug: 'professional-recruiting', name: 'Recruiting & Talent', scope: 'VERTICAL', tierSlug: 'professional',
    description: 'Bench management + candidate sourcing + placement for client projects.',
    departmentTemplateSlugs: ['professional-business-services-firm'],
    agentTemplateNames: ['Business Development', 'Operations Coordinator', 'Engagement Manager'],
    featureKeys: ['crm_integration', 'workflow_automation', 'api_access'],
  },

  // ─── Enterprise tier (1) ─────────────────────────────────────────────
  {
    slug: 'professional-advisory-firm', name: 'Advisory Firm Platform', scope: 'VERTICAL', tierSlug: 'enterprise',
    description: 'Full advisory firm back-office + client delivery at scale.',
    departmentTemplateSlugs: ['professional-business-services-firm'],
    agentTemplateNames: ['Engagement Manager', 'Subject Matter Expert', 'Business Development', 'Research Specialist', 'Operations Coordinator', 'Compliance Officer'],
    featureKeys: ['workflow_automation', 'api_access', 'sso', 'two_factor', 'ms365_integration', 'custom_reports', 'document_templates'],
  },
];

(async () => {
  console.log(`Pro Services package seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));
  console.log(`Total packages: ${PACKAGES.length} (T3 legal cut applied — 4 remaining + 1 enterprise)`);
  console.log('');

  const counts = { starter: 0, professional: 0, enterprise: 0 };
  for (const pkg of PACKAGES) {
    try {
      await seedPackage({
        prisma, industrySlug: 'professional-business-services', tierSlug: pkg.tierSlug,
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