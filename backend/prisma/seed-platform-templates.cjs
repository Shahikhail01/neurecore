#!/usr/bin/env node
/**
 * seed-platform-templates.cjs
 *
 * Stage 1 Phase 1A — Seeds universal baseline tenant templates
 * (`tenantId = null`, `industrySlug = null`).
 *
 * Every tenant — regardless of industry — gets these as a starting
 * floor. Industry-specific seeders (e.g. seed-financial-compliance-templates.cjs)
 * overlay on top keyed by `(tenantId, slug, templateType)`.
 *
 * Covers the 6 templateType values in the TenantTemplate enum.
 * Each entry is a small, sensible default that:
 *   - works with no industry context
 *   - resolves the "Restore System Defaults" empty-state
 *     in `/settings/templates` for tenants created without an industry
 *   - is idempotent on (tenantId=null, slug, templateType)
 *
 * Flags:
 *   --check      Dry run; prints what would be seeded without writing.
 *   --verbose    Log every row.
 */

'use strict';

const fs = require('fs');
const path = require('path');

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
const VERBOSE = process.argv.includes('--verbose');

/**
 * SRP: this seeder owns the universal baseline. Industry-specific
 * seeds live in their own files. Adding a new TemplateType value
 * requires updating both this list and the Prisma schema.
 */
const TEMPLATES = [
  // ──────────────────────────────────────────────
  // CUSTOMER_LIFECYCLE — generic 5-stage pipeline
  // ──────────────────────────────────────────────
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'generic-customer-lifecycle',
    name: 'Generic Customer Lifecycle',
    description: 'Default 5-stage pipeline suitable for any industry: lead → prospect → active → dormant → archived.',
    industrySlug: null,
    config: {
      stages: [
        { key: 'lead', label: 'Lead', order: 1 },
        { key: 'prospect', label: 'Prospect', order: 2 },
        { key: 'active', label: 'Active', order: 3 },
        { key: 'dormant', label: 'Dormant', order: 4 },
        { key: 'archived', label: 'Archived', order: 5 },
      ],
      defaultStage: 'lead',
      customerFieldDefinitions: [],
    },
  },
  // ──────────────────────────────────────────────
  // AGENT_ROLE — baseline executive
  // ──────────────────────────────────────────────
  {
    templateType: 'AGENT_ROLE',
    slug: 'tenant-owner',
    name: 'Tenant Owner',
    description: 'Default owner role — escalates approvals, signs off deliverables, owns the customer relationship.',
    industrySlug: null,
    config: {
      systemPrompt:
        'You are the tenant owner. Review every inbound task, delegate to specialist agents, and surface anything that needs human approval.',
      kpis: [
        { name: 'Approvals resolved', target: '24h SLA' },
        { name: 'Escalations acknowledged', target: '<1h' },
      ],
      permissions: [],
      tools: [],
    },
  },
  // ──────────────────────────────────────────────
  // ROUTINE — daily hygiene
  // ──────────────────────────────────────────────
  {
    templateType: 'ROUTINE',
    slug: 'daily-hygiene',
    name: 'Daily Hygiene',
    description: 'Every-morning sanity check: run inactivity sweep, summarise activity, alert on stuck work.',
    industrySlug: null,
    config: {
      trigger: { kind: 'cron', cron: '0 6 * * *', timezone: 'UTC' },
      actions: [{ kind: 'workflow', workflowId: 'morning-sweep' }],
      channels: ['inbox', 'mission-feed'],
    },
  },
  // ──────────────────────────────────────────────
  // REPORT — weekly activity summary
  // ──────────────────────────────────────────────
  {
    templateType: 'REPORT',
    slug: 'weekly-activity-summary',
    name: 'Weekly Activity Summary',
    description: 'Auto-generated weekly report of agents, tasks, customers, and approvals.',
    industrySlug: null,
    config: {
      metrics: [
        { key: 'agents_active', label: 'Active agents' },
        { key: 'tasks_completed', label: 'Tasks completed' },
        { key: 'customers_active', label: 'Active customers' },
        { key: 'approvals_pending', label: 'Pending approvals' },
      ],
      period: 'weekly',
      outputFormat: 'pdf',
    },
  },
  // ──────────────────────────────────────────────
  // TASK_TEMPLATE — onboarding checklist
  // ──────────────────────────────────────────────
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'tenant-onboarding-checklist',
    name: 'Tenant Onboarding Checklist',
    description: 'Default checklist applied to every new project: workspace setup → first customer → first project → first invoice.',
    industrySlug: null,
    config: {
      tasks: [
        { name: 'Set up workspace', durationMinutes: 30, role: 'OWNER' },
        { name: 'Add first customer', durationMinutes: 15, role: 'OWNER' },
        { name: 'Create first project', durationMinutes: 30, role: 'OWNER' },
        { name: 'Configure first agent', durationMinutes: 45, role: 'ADMIN' },
        { name: 'Send first invoice', durationMinutes: 20, role: 'ADMIN' },
      ],
    },
  },
  // ──────────────────────────────────────────────
  // DEPARTMENT_DEFAULT — minimal 3-department starter
  // ──────────────────────────────────────────────
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'generic-department-structure',
    name: 'Generic Department Structure',
    description: 'Default 3-department starter for any industry: Operations, Customer Success, Finance.',
    industrySlug: null,
    config: {
      departments: [
        { name: 'Operations', headAgentType: 'FUNCTIONAL' },
        { name: 'Customer Success', headAgentType: 'FUNCTIONAL' },
        { name: 'Finance', headAgentType: 'FUNCTIONAL' },
      ],
    },
  },
];

async function seedTemplates() {
  console.log(
    `\n→ seed-platform-templates.cjs (universal baseline; industrySlug=null)` +
      (DRY_RUN ? ' [DRY RUN]' : '') +
      (VERBOSE ? ' [VERBOSE]' : ''),
  );
  console.log(`  Templates in payload: ${TEMPLATES.length}\n`);

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const t of TEMPLATES) {
    const existing = await prisma.tenantTemplate.findFirst({
      where: {
        tenantId: null,
        slug: t.slug,
        templateType: t.templateType,
      },
    });

    if (existing) {
      if (VERBOSE) console.log(`  SKIP  ${t.templateType} / ${t.slug} (exists: ${existing.id})`);
      skipped++;

      const configChanged = JSON.stringify(existing.config) !== JSON.stringify(t.config);
      const nameChanged = existing.name !== t.name;
      const descChanged = (existing.description || '') !== (t.description || '');

      if (configChanged || nameChanged || descChanged) {
        if (!DRY_RUN) {
          await prisma.tenantTemplate.update({
            where: { id: existing.id },
            data: {
              name: t.name,
              description: t.description,
              config: t.config,
            },
          });
        }
        if (configChanged) console.log(`  UPDATE config  ${t.templateType} / ${t.slug}`);
        if (nameChanged) console.log(`  UPDATE name    ${t.templateType} / ${t.slug}`);
        updated++;
      }
      continue;
    }

    if (VERBOSE) console.log(`  CREATE ${t.templateType} / ${t.slug}`);

    if (!DRY_RUN) {
      await prisma.tenantTemplate.create({
        data: {
          tenantId: null,
          slug: t.slug,
          name: t.name,
          description: t.description,
          templateType: t.templateType,
          industrySlug: t.industrySlug,
          config: t.config,
          isActive: true,
          version: 1,
        },
      });
    }
    created++;
  }

  console.log(
    `\nDone. created=${created} skipped=${skipped} updated=${updated} total=${TEMPLATES.length}` +
      (DRY_RUN ? ' (dry run — no changes written)' : ''),
  );
}

seedTemplates()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
