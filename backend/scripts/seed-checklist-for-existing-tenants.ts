#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * seed-checklist-for-existing-tenants.ts
 *
 * One-off migration script — run ONCE after PR-1 deploys to seed the
 * progressive onboarding checklist for tenants who already completed
 * onboarding before this PR shipped.
 *
 * Usage:
 *   DATABASE_URL=... npx ts-node scripts/seed-checklist-for-existing-tenants.ts
 *
 * Idempotent: uses upsert, safe to re-run.
 */

import { PrismaClient } from '@prisma/client';
import { ChecklistService } from '../src/modules/onboarding/checklist/checklist.service';
import { PrismaService } from '../src/infrastructure/database/prisma.service';

async function main() {
  const prisma = new PrismaClient();
  try {
    const checklist = new ChecklistService(prisma as unknown as PrismaService);

    // Find all tenants who completed onboarding but don't yet have checklist rows.
    const candidates = await prisma.tenant.findMany({
      where: {
        onboardingCompletedAt: { not: null },
        onboardingChecklistEntries: { none: {} },
      },
      select: { id: true, slug: true },
    });

    console.log(`[seed-checklist] Found ${candidates.length} tenants needing checklist seed.`);

    let totalCreated = 0;
    let totalExisting = 0;
    for (const t of candidates) {
      const result = await checklist.seed(t.id);
      totalCreated += result.created;
      totalExisting += result.existing;
      console.log(
        `[seed-checklist] ${t.slug} (${t.id}): created=${result.created}, existing=${result.existing}`,
      );
    }

    console.log(
      `[seed-checklist] Done. Total: created=${totalCreated}, existing=${totalExisting}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed-checklist] FAILED:', err);
  process.exit(1);
});