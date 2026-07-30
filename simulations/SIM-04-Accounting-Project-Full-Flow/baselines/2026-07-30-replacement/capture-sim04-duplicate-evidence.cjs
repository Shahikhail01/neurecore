#!/usr/bin/env node
const { readFile, writeFile, mkdir } = require('node:fs/promises');
const { createRequire } = require('node:module');
const path = require('node:path');

function backendPackagePath() {
  const candidates = [path.resolve('backend', 'package.json'), path.resolve('package.json')];
  for (const candidate of candidates) {
    try {
      require('node:fs').accessSync(candidate);
      return candidate;
    } catch {
      // try the next layout
    }
  }
  return path.resolve('backend', 'package.json');
}

const backendRequire = createRequire(backendPackagePath());
const { PrismaClient } = backendRequire('@prisma/client');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = {
    manifest: process.env.SIM04_TENANT_MANIFEST ?? null,
    output: path.join(
      'simulations',
      'SIM-04-Accounting-Project-Full-Flow',
      'certification',
      `sim04-duplicate-evidence-${new Date().toISOString().slice(0, 10)}.json`,
    ),
    environment: process.env.SIM04_EVIDENCE_ENVIRONMENT ?? 'unlabelled database',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest') args.manifest = argv[++i];
    else if (arg.startsWith('--manifest=')) args.manifest = arg.slice('--manifest='.length);
    else if (arg === '--output') args.output = argv[++i];
    else if (arg.startsWith('--output=')) args.output = arg.slice('--output='.length);
    else if (arg === '--environment') args.environment = argv[++i];
    else if (arg.startsWith('--environment=')) args.environment = arg.slice('--environment='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.manifest) {
    throw new Error('Missing --manifest or SIM04_TENANT_MANIFEST');
  }
  return args;
}

async function loadManifest(manifestPath) {
  const resolvedPath = path.resolve(manifestPath);
  const manifest = JSON.parse(await readFile(resolvedPath, 'utf8'));
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.tenants)) {
    throw new Error(`Invalid SIM-04 tenant manifest: ${resolvedPath}`);
  }
  return { manifestPath: resolvedPath, manifest };
}

async function duplicateCounts(tenantId) {
  const [customers, projects, goals] = await Promise.all([
    prisma.customer.groupBy({
      by: ['name'],
      where: { tenantId },
      having: { name: { _count: { gt: 1 } } },
      _count: { name: true },
    }),
    prisma.project.groupBy({
      by: ['name'],
      where: { tenantId },
      having: { name: { _count: { gt: 1 } } },
      _count: { name: true },
    }),
    prisma.goal.groupBy({
      by: ['projectId', 'title'],
      where: { tenantId },
      having: { title: { _count: { gt: 1 } } },
      _count: { title: true },
    }),
  ]);

  return {
    customers: customers.length,
    projects: projects.length,
    goals: goals.length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { manifestPath, manifest } = await loadManifest(args.manifest);
  const perTenant = [];

  for (const tenant of manifest.tenants) {
    const counts = await duplicateCounts(tenant.tenantId);
    perTenant.push({
      tenantId: tenant.tenantId,
      tenantSlug: tenant.tenantSlug,
      email: tenant.email,
      counts,
    });
  }

  const totals = perTenant.reduce(
    (sum, row) => ({
      customers: sum.customers + row.counts.customers,
      projects: sum.projects + row.counts.projects,
      goals: sum.goals + row.counts.goals,
    }),
    { customers: 0, projects: 0, goals: 0 },
  );

  const evidence = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    environment: args.environment,
    scope: 'SIM-04 clean-tenant duplicate Customer, Project, and Goal records',
    tenantManifest: manifestPath,
    counts: totals,
    perTenant,
  };

  const output = path.resolve(args.output);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
