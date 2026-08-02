#!/usr/bin/env node
/**
 * seed-financial-services-packages.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.2 (Phase 2.B) — financial-services
 * package catalogue.
 *
 * 8 themed packages across canonical 3 tiers (T1 fix applied).
 *   - T1 (2026-07-31): `basic` -> `starter`, `business` -> fold into starter/professional.
 *   - Composition (departments/agents/features) is recorded via M2M links
 *     using the R2 `seed-package` helper (not free-text in description).
 *
 * IDEMPOTENT: upsert keyed on (industryId, tierId, slug) via seedPackage helper.
 * Safe to re-run.
 *
 * Run:
 *   node prisma/seed-financial-services-packages.cjs              # apply
 *   node prisma/seed-financial-services-packages.cjs --check      # dry-run
 *
 * Pre-requisites:
 *   node prisma/seed-industries-majors.cjs                       # industry must exist
 *   node prisma/seed-business-composition.cjs                    # tiers must exist
 */

'use strict';

const { loadEnv } = require('./seed-helpers/load-env.cjs');
loadEnv();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  transactionOptions: { timeout: 30_000, maxWait: 5_000 },
});

const { seedPackage } = require('./seed-helpers/seed-package.cjs');

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');

// T1-mapped package definitions. Each entry uses canonical tier slugs.
// `agentTemplateNames` matches AgentTemplate rows by name where tenantId=null.
// `featureKeys` matches Feature rows by key.
// `departmentTemplateSlugs` matches DepartmentTemplate rows by slug — Phase 2.B
//   creates the FS template first via seed-financial-services-department-template.cjs.
const PACKAGES = [
  // ─── Starter tier (2) — was 1 basic + 1 business (folded) ─────────────────
  {
    slug: 'fs-foundation',
    name: 'Financial Services Foundation',
    scope: 'FUNCTIONAL',
    tierSlug: 'starter',
    description: 'Minimum-viable F&C platform: client onboarding, KYC capture, basic bookkeeping.',
    departmentTemplateSlugs: ['financial-services-bank'],
    agentTemplateNames: ['Client Relationship Manager', 'KYC Officer', 'Operations Coordinator'],
    featureKeys: ['ms365_integration', 'two_factor', 'audit_logs'],
  },
  {
    slug: 'fs-client-onboarding-kyc',
    name: 'F&C Client Onboarding & KYC',
    scope: 'FUNCTIONAL',
    tierSlug: 'starter',
    description: 'Standardised client intake + KYC/AML workflow for F&C firms.',
    departmentTemplateSlugs: ['financial-services-bank'],
    agentTemplateNames: ['KYC Officer', 'Compliance Analyst', 'AML Analyst'],
    featureKeys: ['ms365_integration', 'two_factor', 'sso', 'workflow_automation', 'audit_logs'],
  },

  // ─── Professional tier (3) — was 2 business (folded) + 1 professional ──────
  {
    slug: 'fs-wealth-management',
    name: 'Wealth Management Operations',
    scope: 'FUNCTIONAL',
    tierSlug: 'professional',
    description: 'Portfolio tracking, advisory workflow, and client reporting for wealth managers.',
    departmentTemplateSlugs: ['financial-services-bank'],
    agentTemplateNames: ['Wealth Advisor', 'Client Relationship Manager'],
    featureKeys: ['crm_integration', 'workflow_automation', 'custom_reports'],
  },
  {
    slug: 'fs-lending',
    name: 'F&C Lending Operations',
    scope: 'FUNCTIONAL',
    tierSlug: 'professional',
    description: 'Loan origination, servicing, and collections workflow for lenders.',
    departmentTemplateSlugs: ['financial-services-bank'],
    agentTemplateNames: ['Loan Officer', 'Compliance Analyst'],
    featureKeys: ['ms365_integration', 'workflow_automation', 'audit_logs', 'sso'],
  },
  {
    slug: 'fs-banking-core',
    name: 'F&C Banking Core',
    scope: 'VERTICAL',
    tierSlug: 'professional',
    description: 'End-to-end banking platform: deposits, payments, treasury, risk.',
    departmentTemplateSlugs: ['financial-services-bank'],
    agentTemplateNames: [
      'Operations Coordinator', 'Compliance Analyst', 'Loan Officer', 'Wealth Advisor',
    ],
    featureKeys: [
      'ms365_integration', 'google_workspace', 'erp_integration',
      'workflow_automation', 'api_access', 'sso', 'two_factor', 'audit_logs',
    ],
  },

  // ─── Enterprise tier (3) ──────────────────────────────────────────────────
  {
    slug: 'fs-insurance-claims',
    name: 'F&C Insurance Claims',
    scope: 'VERTICAL',
    tierSlug: 'enterprise',
    description: 'Claims intake, assessment, settlement workflow for insurers.',
    departmentTemplateSlugs: ['financial-services-bank'],
    agentTemplateNames: ['AML Analyst', 'Compliance Analyst'],
    featureKeys: ['ms365_integration', 'workflow_automation', 'api_access', 'audit_logs'],
  },
  {
    slug: 'fs-investment-management',
    name: 'Investment Management',
    scope: 'VERTICAL',
    tierSlug: 'enterprise',
    description: 'Portfolio construction, rebalancing, compliance monitoring for asset managers.',
    departmentTemplateSlugs: ['financial-services-bank'],
    agentTemplateNames: ['Wealth Advisor', 'Loan Officer'],
    featureKeys: ['api_access', 'workflow_automation', 'custom_reports', 'audit_logs'],
  },
  {
    slug: 'fs-enterprise-platform',
    name: 'F&C Enterprise Platform',
    scope: 'VERTICAL',
    tierSlug: 'enterprise',
    description: 'Full-stack F&C platform with multi-office support and advanced analytics.',
    departmentTemplateSlugs: ['financial-services-bank'],
    agentTemplateNames: [
      'Firm Principal', 'KYC Officer', 'Client Relationship Manager', 'Loan Officer',
      'Compliance Analyst', 'AML Analyst', 'Wealth Advisor', 'Operations Coordinator',
    ],
    featureKeys: [
      'ms365_integration', 'google_workspace', 'erp_integration',
      'workflow_automation', 'api_access', 'webhooks',
      'sso', 'two_factor', 'audit_logs', 'custom_reports',
    ],
  },
];

(async () => {
  console.log(`Financial Services package seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));
  console.log(`Total packages: ${PACKAGES.length} (T1 tier-slug consolidation applied)`);
  console.log('');

  const counts = { starter: 0, professional: 0, enterprise: 0 };

  for (const pkg of PACKAGES) {
    try {
      await seedPackage({
        prisma,
        industrySlug: 'financial-services',
        tierSlug: pkg.tierSlug,
        packageDef: {
          slug: pkg.slug,
          name: pkg.name,
          scope: pkg.scope,
          description: pkg.description,
          departmentTemplateSlugs: pkg.departmentTemplateSlugs,
          agentTemplateNames: pkg.agentTemplateNames,
          featureKeys: pkg.featureKeys,
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
  console.log(`  starter:     ${counts.starter}`);
  console.log(`  professional: ${counts.professional}`);
  console.log(`  enterprise:  ${counts.enterprise}`);
  console.log(`  TOTAL:       ${PACKAGES.length}`);

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