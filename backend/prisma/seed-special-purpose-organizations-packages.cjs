#!/usr/bin/env node
/**
 * seed-special-purpose-organizations-packages.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.8 (Phase 5.B) — 4 packages.
 * T8: `spo-family-office-reporting` (enterprise) has parentPackageSlug set,
 * but T8 cross-group resolution happens at onboarding time (not via direct
 * FK). The parent reference here is for documentation + the P9 admin
 * inheritance UI; the resolver service reads the chain at tenant-provision.
 */

'use strict';

const { loadEnv } = require('./seed-helpers/load-env.cjs');
loadEnv();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ transactionOptions: { timeout: 30_000, maxWait: 5_000 } });
const { seedPackage } = require('./seed-helpers/seed-package.cjs');

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');

const PACKAGES = [
  // ─── Starter tier (1) ────────────────────────────────────────────────
  {
    slug: 'spo-foundation', name: 'SPO Foundation', scope: 'FUNCTIONAL', tierSlug: 'starter',
    description: 'Single-entity holding company back office.',
    departmentTemplateSlugs: ['special-purpose-organizations-holding'],
    agentTemplateNames: ['Operations Coordinator'],
    featureKeys: ['workflow_automation', 'audit_logs', 'sso', 'two_factor'],
  },

  // ─── Professional tier (2) ──────────────────────────────────────────
  {
    slug: 'spo-multi-entity-operations', name: 'Multi-Entity Operations', scope: 'VERTICAL', tierSlug: 'professional',
    description: 'Inter-entity coordination + governance for 2-5 entity holdings.',
    departmentTemplateSlugs: ['special-purpose-organizations-holding'],
    agentTemplateNames: ['Operations Coordinator', 'Compliance Officer'],
    featureKeys: ['workflow_automation', 'document_templates', 'custom_reports', 'audit_logs'],
  },
  {
    slug: 'spo-portfolio-oversight', name: 'Portfolio Oversight', scope: 'VERTICAL', tierSlug: 'professional',
    description: 'Multi-asset portfolio tracking + intercompany reporting.',
    departmentTemplateSlugs: ['special-purpose-organizations-holding'],
    agentTemplateNames: ['Finance Controller', 'Operations Coordinator'],
    featureKeys: ['workflow_automation', 'custom_reports', 'document_templates'],
  },

  // ─── Enterprise tier (1) — T8 cross-group inheritance ────────────────
  // The parentPackageSlug is the F&C accounting-operations package. T8
  // cross-group FK is enforced at the SAME (industryId, tierId) level via the
  // FK (which is intra-group). Cross-group inheritance is documented via
  // the resolver service reading this annotation at onboarding time.
  {
    slug: 'spo-family-office-reporting', name: 'Family Office Reporting', scope: 'VERTICAL', tierSlug: 'enterprise',
    description: 'Full FOC reporting: consolidated financials + governance + inherited accounting (T8). Resolves `accounting-operations` agents (Bookkeeper & Controller, GL Accountant) at tenant onboarding.',
    departmentTemplateSlugs: ['special-purpose-organizations-holding'],
    agentTemplateNames: ['Finance Controller', 'Compliance Officer'],
    featureKeys: ['workflow_automation', 'custom_reports', 'audit_logs', 'document_templates'],
    // T8: this package INHERITS the F&C accounting-operations package via the
    // onboarding resolver. The parentPackageSlug here is for documentation +
    // P9 admin UI badge. The resolver service reads this chain at provision.
    parentPackageSlug: 'accounting-operations',
  },
];

(async () => {
  console.log(`SPO package seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));
  console.log(`Total packages: ${PACKAGES.length} (T8 cross-group inheritance: 1)`);
  console.log('');

  const counts = { starter: 0, professional: 0, enterprise: 0 };
  for (const pkg of PACKAGES) {
    try {
      await seedPackage({
        prisma, industrySlug: 'special-purpose-organizations', tierSlug: pkg.tierSlug,
        packageDef: {
          slug: pkg.slug, name: pkg.name, scope: pkg.scope, description: pkg.description,
          departmentTemplateSlugs: pkg.departmentTemplateSlugs,
          agentTemplateNames: pkg.agentTemplateNames, featureKeys: pkg.featureKeys,
          parentPackageSlug: pkg.parentPackageSlug, // T8
        },
        dryRun: DRY_RUN,
      });
      counts[pkg.tierSlug]++;
      const parentTag = pkg.parentPackageSlug ? ` [inherits: ${pkg.parentPackageSlug}]` : '';
      console.log(`  ✓ ${pkg.tierSlug.padEnd(12)} ${pkg.slug}${parentTag}`);
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