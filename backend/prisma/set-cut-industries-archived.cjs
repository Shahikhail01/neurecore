#!/usr/bin/env node
/**
 * set-cut-industries-archived.cjs
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.1 (Phase 2.A) — course correction.
 *
 * The plan originally called for adding an `Industry.isActive Boolean` column.
 * That was a duplicate concept — `Industry.status` (IndustryStatus enum:
 * ACTIVE | ARCHIVED) already exists and is wired into the admin UI.
 *
 * This script flips the 8 CUT Industries to `status = ARCHIVED` so the
 * onboarding picker, Customer Industry dropdown, and admin list filter them
 * out per the proposal's cut list. The 8 KEPT Industries stay ACTIVE.
 *
 * CUT (per PRUNED-TAXONOMY-PROPOSAL §4):
 *   healthcare-life-sciences, manufacturing-industrial,
 *   construction-engineering-infrastructure, energy-utilities-natural-resources,
 *   logistics-transportation-supply-chain, government-public-sector,
 *   education-research, agriculture-food-systems
 *
 * KEPT (per §5):
 *   accounting-audit-services, financial-services,
 *   technology-digital-services, professional-business-services,
 *   retail-commerce-consumer, media-communications-creative,
 *   nonprofit-international, special-purpose-organizations
 *
 * Run:
 *   node prisma/set-cut-industries-archived.cjs              # apply
 *   node prisma/set-cut-industries-archived.cjs --check      # dry-run
 *
 * Reads DATABASE_URL from backend/.env.production (falls back to .env).
 *
 * IDEMPOTENT: only writes where status !== target. Safe to re-run.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Load env
const envFile = path.join(__dirname, '..', '.env.production');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');

const CUT_SLUGS = [
  'healthcare-life-sciences',
  'manufacturing-industrial',
  'construction-engineering-infrastructure',
  'energy-utilities-natural-resources',
  'logistics-transportation-supply-chain',
  'government-public-sector',
  'education-research',
  'agriculture-food-systems',
];

const KEPT_SLUGS = [
  'accounting-audit-services',
  'financial-services',
  'technology-digital-services',
  'professional-business-services',
  'retail-commerce-consumer',
  'media-communications-creative',
  'nonprofit-international',
  'special-purpose-organizations',
];

async function main() {
  console.log(`Industry status flip — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));

  // Read current state
  const all = await prisma.industry.findMany({
    select: { slug: true, status: true },
    orderBy: { slug: 'asc' },
  });

  console.log(`Total Industries in DB: ${all.length}`);
  console.log('');

  let flipped = 0;
  let unchanged = 0;
  let unexpected = 0;

  for (const ind of all) {
    const isCut = CUT_SLUGS.includes(ind.slug);
    const isKept = KEPT_SLUGS.includes(ind.slug);

    if (!isCut && !isKept) {
      console.log(`  ⚠ UNEXPECTED slug: ${ind.slug} (status=${ind.status})`);
      unexpected++;
      continue;
    }

    const targetStatus = isCut ? 'ARCHIVED' : 'ACTIVE';

    if (ind.status === targetStatus) {
      unchanged++;
      continue;
    }

    console.log(
      `  ${DRY_RUN ? 'WOULD FLIP' : 'FLIPPING'}: ${ind.slug}  ${ind.status} → ${targetStatus}  (${isCut ? 'CUT' : 'KEPT'})`,
    );

    if (!DRY_RUN) {
      await prisma.industry.update({
        where: { slug: ind.slug },
        data: { status: targetStatus },
      });
    }
    flipped++;
  }

  console.log('');
  console.log('Summary:');
  console.log(`  Flipped:           ${flipped}`);
  console.log(`  Already correct:   ${unchanged}`);
  console.log(`  Unexpected slugs:  ${unexpected}`);
  console.log(`  CUT total:         ${CUT_SLUGS.length}`);
  console.log(`  KEPT total:        ${KEPT_SLUGS.length}`);

  if (DRY_RUN) {
    console.log('');
    console.log('DRY RUN — no changes written. Re-run without --check to apply.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });