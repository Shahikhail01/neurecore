#!/usr/bin/env node
/**
 * seed-technology-digital-services-packages.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.3 (Phase 3.A) — technology-digital-services
 * package catalogue.
 *
 * 8 themed packages across 3 tiers (rewired from business-technology-packages.ts
 * stub defs using the R2 `seed-package` helper).
 *
 * Uses canonical 3-tier slugs (no legacy 'basic' or 'business').
 *
 * Run:
 *   node prisma/seed-technology-digital-services-packages.cjs
 *   node prisma/seed-technology-digital-services-packages.cjs --check
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

const PACKAGES = [
  // ─── Starter tier (2) ────────────────────────────────────────────────
  {
    slug: 'it-project-delivery',
    name: 'IT Project Delivery',
    scope: 'FUNCTIONAL',
    tierSlug: 'starter',
    description: 'Core project delivery for IT consulting and digital agencies.',
    departmentTemplateSlugs: ['tech-digital-services-it'],
    agentTemplateNames: ['Tech Delivery Lead', 'Technical Lead', 'QA Engineer'],
    featureKeys: ['workflow_automation', 'audit_logs'],
  },
  {
    slug: 'it-client-success',
    name: 'Client Success & Support',
    scope: 'FUNCTIONAL',
    tierSlug: 'starter',
    description: 'Client relationship management, ticket handling, and SLA tracking.',
    departmentTemplateSlugs: ['tech-digital-services-it'],
    agentTemplateNames: ['Client Success Manager', 'Tech Delivery Lead'],
    featureKeys: ['crm_integration', 'workflow_automation'],
  },

  // ─── Professional tier (3) ──────────────────────────────────────────
  {
    slug: 'it-devops-infrastructure',
    name: 'DevOps & Infrastructure',
    scope: 'FUNCTIONAL',
    tierSlug: 'professional',
    description: 'CI/CD pipelines, infrastructure management, and incident response.',
    departmentTemplateSlugs: ['tech-digital-services-it'],
    agentTemplateNames: ['DevOps Specialist', 'Technical Lead', 'QA Engineer'],
    featureKeys: ['workflow_automation', 'api_access', 'webhooks'],
  },
  {
    slug: 'it-product-development',
    name: 'Product Development',
    scope: 'FUNCTIONAL',
    tierSlug: 'professional',
    description: 'End-to-end product development lifecycle from spec to launch.',
    departmentTemplateSlugs: ['tech-digital-services-it'],
    agentTemplateNames: ['Technical Lead', 'Tech Delivery Lead', 'QA Engineer', 'DevOps Specialist'],
    featureKeys: ['workflow_automation', 'api_access', 'webhooks', 'audit_logs'],
  },
  {
    slug: 'it-quality-engineering',
    name: 'Quality Engineering',
    scope: 'FUNCTIONAL',
    tierSlug: 'professional',
    description: 'Test strategy, automation frameworks, and release gating for regulated software.',
    departmentTemplateSlugs: ['tech-digital-services-it'],
    agentTemplateNames: ['QA Engineer', 'Technical Lead'],
    featureKeys: ['workflow_automation', 'api_access', 'custom_reports'],
  },

  // ─── Enterprise tier (3) ────────────────────────────────────────────
  {
    slug: 'it-saas-operations',
    name: 'SaaS Operations',
    scope: 'VERTICAL',
    tierSlug: 'enterprise',
    description: 'Full SaaS operations: customer success + DevOps + engineering under one workspace.',
    departmentTemplateSlugs: ['tech-digital-services-it'],
    agentTemplateNames: [
      'Tech Delivery Lead', 'Technical Lead', 'Product Manager',
      'DevOps Specialist', 'QA Engineer', 'Client Success Manager', 'Operations Coordinator',
    ],
    featureKeys: ['workflow_automation', 'api_access', 'webhooks', 'audit_logs', 'sso', 'two_factor', 'ms365_integration', 'google_workspace', 'custom_reports'],
  },
  {
    slug: 'it-managed-services',
    name: 'Managed Services Provider',
    scope: 'VERTICAL',
    tierSlug: 'enterprise',
    description: 'MSP toolkit: client onboarding + infrastructure + QA + 24/7 support.',
    departmentTemplateSlugs: ['tech-digital-services-it'],
    agentTemplateNames: ['Client Success Manager', 'DevOps Specialist', 'QA Engineer', 'Operations Coordinator'],
    featureKeys: ['crm_integration', 'workflow_automation', 'api_access', 'webhooks', 'two_factor'],
  },
  {
    slug: 'it-enterprise-platform',
    name: 'IT Enterprise Platform',
    scope: 'VERTICAL',
    tierSlug: 'enterprise',
    description: 'All features on for enterprise IT tenants: all integrations, custom reports, white-label.',
    departmentTemplateSlugs: ['tech-digital-services-it'],
    agentTemplateNames: [
      'Tech Delivery Lead', 'Technical Lead', 'Product Manager',
      'DevOps Specialist', 'QA Engineer', 'Client Success Manager', 'Operations Coordinator',
    ],
    featureKeys: ['ms365_integration', 'google_workspace', 'erp_integration', 'workflow_automation', 'api_access', 'webhooks', 'sso', 'two_factor', 'custom_reports', 'audit_logs'],
  },
];

(async () => {
  console.log(`Tech & Digital Services package seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));
  console.log(`Total packages: ${PACKAGES.length}`);
  console.log('');

  const counts = { starter: 0, professional: 0, enterprise: 0 };
  for (const pkg of PACKAGES) {
    try {
      await seedPackage({
        prisma,
        industrySlug: 'technology-digital-services',
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