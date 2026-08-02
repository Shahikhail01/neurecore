#!/usr/bin/env node
/**
 * seed-nonprofit-international-packages.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.7 (Phase 5.A) — 7 packages.
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
    slug: 'ngo-foundation', name: 'NGO Foundation', scope: 'FUNCTIONAL', tierSlug: 'starter',
    description: 'Day-1 ops for a small NGO: program + operations + compliance.',
    departmentTemplateSlugs: ['nonprofit-international-ngo'],
    agentTemplateNames: ['Program Manager', 'Operations Coordinator'],
    featureKeys: ['workflow_automation', 'audit_logs', 'sso', 'two_factor'],
  },
  {
    slug: 'ngo-program-delivery', name: 'NGO Program Delivery', scope: 'FUNCTIONAL', tierSlug: 'starter',
    description: 'Program planning + field mission tracking + beneficiary reporting.',
    departmentTemplateSlugs: ['nonprofit-international-ngo'],
    agentTemplateNames: ['Program Manager', 'Operations Coordinator'],
    featureKeys: ['workflow_automation', 'field_mission_pack', 'hr_pack', 'stakeholder_pack'],
  },

  // ─── Professional tier (3) ──────────────────────────────────────────
  {
    slug: 'ngo-donor-crm', name: 'NGO Donor CRM', scope: 'FUNCTIONAL', tierSlug: 'professional',
    description: 'Donor database + stewardship + retention.',
    departmentTemplateSlugs: ['nonprofit-international-ngo'],
    agentTemplateNames: ['Donor Stewardship', 'Grant Writer'],
    featureKeys: ['crm_integration', 'workflow_automation', 'grant_pack', 'custom_reports'],
  },
  {
    slug: 'ngo-grant-acquisition', name: 'Grant Acquisition', scope: 'VERTICAL', tierSlug: 'professional',
    description: 'Grant pipeline + proposal drafting + submission tracking.',
    departmentTemplateSlugs: ['nonprofit-international-ngo'],
    agentTemplateNames: ['Grant Writer', 'Donor Stewardship', 'Program Manager'],
    featureKeys: ['crm_integration', 'workflow_automation', 'grant_pack', 'document_templates', 'custom_reports'],
  },
  {
    slug: 'ngo-volunteer-management', name: 'NGO Volunteer Management', scope: 'FUNCTIONAL', tierSlug: 'professional',
    description: 'Volunteer onboarding + scheduling + impact tracking.',
    departmentTemplateSlugs: ['nonprofit-international-ngo'],
    agentTemplateNames: ['Program Manager', 'Operations Coordinator'],
    featureKeys: ['workflow_automation', 'hr_pack', 'stakeholder_pack'],
  },

  // ─── Enterprise tier (2) ────────────────────────────────────────────
  {
    slug: 'ngo-impact-reporting', name: 'NGO Impact Reporting', scope: 'VERTICAL', tierSlug: 'enterprise',
    description: 'Outcome measurement + board reporting + funder reporting.',
    departmentTemplateSlugs: ['nonprofit-international-ngo'],
    agentTemplateNames: ['Operations Coordinator', 'Program Manager'],
    featureKeys: ['workflow_automation', 'custom_reports', 'document_templates', 'audit_logs'],
  },
  {
    slug: 'ngo-enterprise-platform', name: 'NGO Enterprise Platform', scope: 'VERTICAL', tierSlug: 'enterprise',
    description: 'Full NGO stack for multi-program international organizations.',
    departmentTemplateSlugs: ['nonprofit-international-ngo'],
    agentTemplateNames: ['Program Manager', 'Grant Writer', 'Donor Stewardship', 'Operations Coordinator'],
    featureKeys: ['workflow_automation', 'api_access', 'webhooks', 'sso', 'two_factor', 'ms365_integration', 'google_workspace', 'custom_reports'],
  },
];

(async () => {
  console.log(`NGO package seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));
  console.log(`Total packages: ${PACKAGES.length}`);
  console.log('');

  const counts = { starter: 0, professional: 0, enterprise: 0 };
  for (const pkg of PACKAGES) {
    try {
      await seedPackage({
        prisma, industrySlug: 'nonprofit-international', tierSlug: pkg.tierSlug,
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