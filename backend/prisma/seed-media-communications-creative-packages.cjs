#!/usr/bin/env node
/**
 * seed-media-communications-creative-packages.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.6 (Phase 4.B) — 5 packages.
 * Campaigns/Content workspace modules are SHARED with retail (consumer-commerce
 * sub-industry filter handles visibility per P3).
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
    slug: 'media-content-production', name: 'Content Production', scope: 'FUNCTIONAL', tierSlug: 'starter',
    description: 'Content calendar + production pipeline for small agencies and in-house teams.',
    departmentTemplateSlugs: ['media-creative-agency'],
    agentTemplateNames: ['Content Producer', 'Project Manager Creative'],
    featureKeys: ['workflow_automation', 'document_templates', 'sso'],
  },

  // ─── Professional tier (2) ──────────────────────────────────────────
  {
    slug: 'media-brand-development', name: 'Brand Development', scope: 'FUNCTIONAL', tierSlug: 'professional',
    description: 'Brand strategy + identity + rollout for consultancies and creative boutiques.',
    departmentTemplateSlugs: ['media-creative-agency'],
    agentTemplateNames: ['Creative Director', 'Copywriter'],
    featureKeys: ['workflow_automation', 'document_templates', 'custom_reports'],
  },
  {
    slug: 'media-social-management', name: 'Social Media Management', scope: 'VERTICAL', tierSlug: 'professional',
    description: 'Social content + scheduling + community management.',
    departmentTemplateSlugs: ['media-creative-agency'],
    agentTemplateNames: ['Content Producer', 'Project Manager Creative'],
    featureKeys: ['crm_integration', 'webhooks', 'custom_reports'],
  },

  // ─── Enterprise tier (2) ─────────────────────────────────────────────
  {
    slug: 'media-video-production', name: 'Video Production', scope: 'VERTICAL', tierSlug: 'enterprise',
    description: 'Video production lifecycle: brief → shoot → edit → deliver.',
    departmentTemplateSlugs: ['media-creative-agency'],
    agentTemplateNames: ['Content Producer', 'Copywriter'],
    featureKeys: ['api_access', 'webhooks', 'custom_reports', 'document_templates'],
  },
  {
    slug: 'media-pr-campaigns', name: 'PR Campaigns', scope: 'VERTICAL', tierSlug: 'enterprise',
    description: 'PR campaign orchestration + media list + coverage tracking.',
    departmentTemplateSlugs: ['media-creative-agency'],
    agentTemplateNames: ['Project Manager Creative', 'Creative Director'],
    featureKeys: ['crm_integration', 'custom_reports', 'document_templates'],
  },
];

(async () => {
  console.log(`Media package seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));
  console.log(`Total packages: ${PACKAGES.length}`);
  console.log('');

  const counts = { starter: 0, professional: 0, enterprise: 0 };
  for (const pkg of PACKAGES) {
    try {
      await seedPackage({
        prisma, industrySlug: 'media-communications-creative', tierSlug: pkg.tierSlug,
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