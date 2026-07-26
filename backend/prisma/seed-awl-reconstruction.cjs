#!/usr/bin/env node
/**
 * Idempotently seeds the AWL reconstruction tenant flag used by G1/G2 gates.
 *
 * Run from backend:
 *   pnpm run seed:awl-reconstruction
 *   pnpm run seed:awl-reconstruction -- --check
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--check') || process.argv.includes('--dry-run');

const TENANT_ID = process.env.AWL_RECONSTRUCTION_TENANT_ID || 'reconstruction-integration-test';
const TENANT_SLUG = process.env.AWL_RECONSTRUCTION_TENANT_SLUG || 'reconstruction-test';
const TENANT_NAME = process.env.AWL_RECONSTRUCTION_TENANT_NAME || 'Reconstruction Test Tenant';
const FLAG_KEY = 'CANONICAL_INITIATION';
const ACTOR_ID = process.env.AWL_RECONSTRUCTION_SEED_ACTOR || 'system-seed';

async function resolveTierId() {
  const tier = await prisma.tier.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, slug: true },
  });

  if (!tier) {
    throw new Error('No active tier found. Run tier/business-composition seed before AWL reconstruction seed.');
  }

  return tier.id;
}

async function main() {
  const existingTenant = await prisma.tenant.findUnique({
    where: { id: TENANT_ID },
    select: { id: true, slug: true, name: true },
  });
  const existingFlag = await prisma.tenantFeatureFlagOverride.findUnique({
    where: { tenantId_flagKey: { tenantId: TENANT_ID, flagKey: FLAG_KEY } },
    select: { id: true, enabled: true, version: true },
  });

  if (dryRun) {
    console.log('[DRY RUN] AWL reconstruction seed check');
    console.log(`tenant: ${existingTenant ? 'exists' : 'missing'} (${TENANT_ID})`);
    console.log(`flag: ${existingFlag?.enabled === true ? 'enabled' : existingFlag ? 'disabled' : 'missing'} (${FLAG_KEY})`);
    return;
  }

  const tierId = existingTenant ? undefined : await resolveTierId();
  const tenant = await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    create: {
      id: TENANT_ID,
      name: TENANT_NAME,
      slug: TENANT_SLUG,
      status: 'ACTIVE',
      tierId,
      settings: {},
      metadata: { seededBy: 'seed-awl-reconstruction.cjs' },
    },
    update: {
      status: 'ACTIVE',
      metadata: { seededBy: 'seed-awl-reconstruction.cjs' },
    },
    select: { id: true, slug: true, name: true },
  });

  const previousValue = existingFlag?.enabled ?? null;
  const flag = await prisma.tenantFeatureFlagOverride.upsert({
    where: { tenantId_flagKey: { tenantId: tenant.id, flagKey: FLAG_KEY } },
    create: {
      tenantId: tenant.id,
      flagKey: FLAG_KEY,
      enabled: true,
      setByActorId: ACTOR_ID,
      version: 1,
    },
    update: {
      enabled: true,
      setByActorId: ACTOR_ID,
      version: { increment: 1 },
    },
    select: { id: true, enabled: true, version: true },
  });

  await prisma.featureFlagAuditLog.create({
    data: {
      tenantId: tenant.id,
      flagKey: FLAG_KEY,
      action: existingFlag ? 'OVERRIDE_UPDATED' : 'OVERRIDE_CREATED',
      actorId: ACTOR_ID,
      oldValue: previousValue,
      newValue: true,
    },
  });

  console.log(`Seeded tenant: ${tenant.name} (${tenant.id}, slug=${tenant.slug})`);
  console.log(`Enabled flag: ${FLAG_KEY}=${flag.enabled} (version=${flag.version})`);
}

main()
  .catch((error) => {
    console.error('AWL reconstruction seed failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
