#!/usr/bin/env node
const crypto = require('node:crypto');
const { mkdir, writeFile } = require('node:fs/promises');
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
const bcrypt = backendRequire('bcryptjs');
const { PrismaClient } = backendRequire('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_COUNT = 20;
const DEFAULT_PREFIX = 'sim04-clean-20260730';
const DEFAULT_PASSWORD_PREFIX = 'SIM04!Clean';
const INDUSTRY = 'accounting-audit-services';
const INDUSTRY_GROUP = 'financial-compliance';

function parseArgs(argv) {
  const args = {
    count: DEFAULT_COUNT,
    prefix: DEFAULT_PREFIX,
    output: path.join(
      'simulations',
      'SIM-04-Accounting-Project-Full-Flow',
      'certification',
      'sim04-clean-tenants-2026-07-30.json',
    ),
    allowExisting: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--allow-existing') args.allowExisting = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--count') args.count = Number(argv[++i]);
    else if (arg.startsWith('--count=')) args.count = Number(arg.slice('--count='.length));
    else if (arg === '--prefix') args.prefix = argv[++i];
    else if (arg.startsWith('--prefix=')) args.prefix = arg.slice('--prefix='.length);
    else if (arg === '--output') args.output = argv[++i];
    else if (arg.startsWith('--output=')) args.output = arg.slice('--output='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(args.count) || args.count < 1) {
    throw new Error('--count must be a positive integer');
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(args.prefix)) {
    throw new Error('--prefix must be a lowercase slug prefix');
  }
  return args;
}

function slugFor(prefix, index) {
  return `${prefix}-${String(index).padStart(2, '0')}`;
}

function emailFor(slug) {
  return `${slug}@sim04.neurecore.test`;
}

function passwordFor(slug) {
  const digest = crypto.createHash('sha256').update(`${slug}:${process.env.SIM04_TENANT_PASSWORD_SALT ?? 'local'}`).digest('hex');
  return `${DEFAULT_PASSWORD_PREFIX}-${digest.slice(0, 16)}aA1!`;
}

async function getTier() {
  const preferred = await prisma.tier.findFirst({
    where: { slug: { in: ['professional', 'tier_pro', 'pro', 'business'] }, isActive: true },
    orderBy: { sortOrder: 'desc' },
  });
  if (preferred) return preferred;

  const fallback = await prisma.tier.findFirst({ where: { isDefault: true, isActive: true } });
  if (fallback) return fallback;

  throw new Error('No active/default tier found. Seed tiers before provisioning SIM-04 tenants.');
}

async function duplicateCounts(tenantId) {
  const customers = await prisma.customer.groupBy({
    by: ['name'],
    where: { tenantId },
    having: { name: { _count: { gt: 1 } } },
    _count: { name: true },
  });
  const projects = await prisma.project.groupBy({
    by: ['name'],
    where: { tenantId },
    having: { name: { _count: { gt: 1 } } },
    _count: { name: true },
  });
  const goals = await prisma.goal.groupBy({
    by: ['projectId', 'title'],
    where: { tenantId },
    having: { title: { _count: { gt: 1 } } },
    _count: { title: true },
  });

  return {
    customers: customers.length,
    projects: projects.length,
    goals: goals.length,
  };
}

async function createDepartments(tenantId) {
  const names = ['Client Accounting', 'Tax', 'Audit', 'Bookkeeping', 'Review'];
  const departments = [];
  for (const name of names) {
    const existing = await prisma.department.findFirst({ where: { tenantId, name } });
    if (existing) {
      departments.push(existing);
      continue;
    }
    departments.push(
      await prisma.department.create({
        data: {
          tenantId,
          name,
          description: `SIM-04 ${name} department`,
          metadata: { source: 'sim04-clean-tenant-provisioner' },
        },
      }),
    );
  }
  return departments;
}

async function certifiedAccountingTemplates(limit) {
  const templates = await prisma.agentTemplate.findMany({
    where: {
      tenantId: null,
      isPublic: true,
      enabled: true,
      deprecatedAt: null,
      config: {
        path: ['autonomousWorkLayer', 'status'],
        equals: 'certified',
      },
      AND: [
        {
          config: {
            path: ['autonomousWorkLayer', 'domain'],
            equals: INDUSTRY,
          },
        },
        {
          config: {
            path: ['autonomousWorkLayer', 'executionPlane'],
            equals: 'upstream-hermes',
          },
        },
      ],
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    take: limit,
  });

  if (templates.length > 0) return templates;

  return prisma.agentTemplate.findMany({
    where: {
      tenantId: null,
      enabled: true,
      deprecatedAt: null,
      OR: [
        { name: { contains: 'Accounting', mode: 'insensitive' } },
        { name: { contains: 'Bookkeeper', mode: 'insensitive' } },
        { name: { contains: 'Tax', mode: 'insensitive' } },
        { name: { contains: 'Audit', mode: 'insensitive' } },
      ],
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    take: limit,
  });
}

function matchingDepartmentId(templateName, departments) {
  const lower = templateName.toLowerCase();
  const match = departments.find((department) => {
    const dept = department.name.toLowerCase();
    return lower.includes(dept.split(' ')[0]) || dept.includes(lower.split(' ')[0]);
  });
  return match?.id ?? departments[0]?.id ?? null;
}

async function createAgents(tenantId, userId, departments, maxAgents) {
  const templates = await certifiedAccountingTemplates(Math.max(5, Math.min(maxAgents, 10)));
  if (templates.length === 0) {
    throw new Error('No accounting-capable AgentTemplate rows found. Run Phase 4 accounting activation first.');
  }

  const agents = [];
  for (const template of templates.slice(0, Math.max(5, Math.min(maxAgents, templates.length)))) {
    const existing = await prisma.agent.findFirst({
      where: { tenantId, templateId: template.id, name: template.name },
    });
    if (existing) {
      agents.push(existing);
      continue;
    }
    agents.push(
      await prisma.agent.create({
        data: {
          tenantId,
          createdById: userId,
          name: template.name,
          description: template.description,
          type: template.type,
          model: template.model,
          systemPrompt: template.systemPrompt,
          instructions: template.instructions,
          permissions: template.permissions,
          config: template.config,
          templateId: template.id,
          templateVersion: template.version,
          departmentId: matchingDepartmentId(template.name, departments),
          isActive: true,
          isSelected: true,
          availability: 'AVAILABLE',
        },
      }),
    );
  }
  return agents;
}

async function ensureFreshSlugs(slugs, emails, allowExisting) {
  const [existingTenants, existingUsers] = await Promise.all([
    prisma.tenant.findMany({ where: { slug: { in: slugs } }, select: { slug: true, id: true } }),
    prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true, id: true, tenantId: true } }),
  ]);

  if (!allowExisting && (existingTenants.length > 0 || existingUsers.length > 0)) {
    throw new Error(
      [
        'SIM-04 clean tenant provisioning refused to reuse existing records.',
        existingTenants.length ? `Existing tenant slugs: ${existingTenants.map((t) => t.slug).join(', ')}` : null,
        existingUsers.length ? `Existing user emails: ${existingUsers.map((u) => u.email).join(', ')}` : null,
        'Use a new --prefix for a genuinely fresh cohort, or pass --allow-existing only for local dry maintenance.',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
}

async function provisionTenant({ slug, index, tier }) {
  const email = emailFor(slug);
  const password = passwordFor(slug);
  const passwordHash = await bcrypt.hash(password, 12);

  const tenant = await prisma.tenant.create({
    data: {
      name: `SIM-04 Clean Tenant ${String(index).padStart(2, '0')}`,
      slug,
      status: 'ACTIVE',
      tierId: tier.id,
      industry: INDUSTRY,
      industryGroup: INDUSTRY_GROUP,
      timezone: 'UTC',
      currency: 'USD',
      metadata: {
        certification: 'SIM-04',
        cohort: DEFAULT_PREFIX,
        cleanTenant: true,
        provisionedAt: new Date().toISOString(),
      },
      settings: {
        certificationMode: true,
        autonomousWorkLayer: {
          domain: INDUSTRY,
          executionPlane: 'upstream-hermes',
        },
      },
    },
  });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'SIM04',
      lastName: `Tenant ${String(index).padStart(2, '0')}`,
      tenantId: tenant.id,
      role: 'ADMIN',
      isActive: true,
      isVerified: true,
      timezone: 'UTC',
      locale: 'en-US',
      metadata: {
        certification: 'SIM-04',
        cleanTenant: true,
      },
    },
  });

  const departments = await createDepartments(tenant.id);
  const agents = await createAgents(tenant.id, user.id, departments, tier.maxAgents ?? 10);
  const preRunDuplicateCounts = await duplicateCounts(tenant.id);

  return {
    runNumber: index,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    userId: user.id,
    email,
    password,
    tier: { id: tier.id, slug: tier.slug, name: tier.name, maxAgents: tier.maxAgents },
    industry: INDUSTRY,
    industryGroup: INDUSTRY_GROUP,
    departments: departments.map((department) => ({ id: department.id, name: department.name })),
    agents: agents.map((agent) => ({ id: agent.id, name: agent.name, templateId: agent.templateId })),
    preRunDuplicateCounts,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slugs = Array.from({ length: args.count }, (_, index) => slugFor(args.prefix, index + 1));
  const emails = slugs.map(emailFor);
  const output = path.resolve(args.output);

  if (args.dryRun) {
    const preview = {
      schemaVersion: 1,
      mode: 'DRY_RUN',
      count: args.count,
      slugs,
      emails,
      output,
    };
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  await ensureFreshSlugs(slugs, emails, args.allowExisting);
  const tier = await getTier();

  const tenants = [];
  for (let index = 1; index <= args.count; index += 1) {
    const slug = slugFor(args.prefix, index);
    const entry = await provisionTenant({ slug, index, tier });
    tenants.push(entry);
    console.log(`created ${entry.tenantSlug}: tenantId=${entry.tenantId} email=${entry.email}`);
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose: 'SIM-04 clean-tenant certification cohort',
    cohortPrefix: args.prefix,
    requiredRuns: args.count,
    reusedExistingRecords: false,
    tenants,
  };

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(manifest, null, 2));
  console.log(`manifest written: ${output}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
