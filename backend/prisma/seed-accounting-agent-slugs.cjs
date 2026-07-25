#!/usr/bin/env node
/**
 * seed-accounting-agent-slugs.cjs
 *
 * Phase 9 remediation (industry verification round 2): AGENTS-001.
 *
 * The Plan-Impact panel advertises the following accounting-agent slugs
 * via `INDUSTRY_DEFAULT_AGENTS['accounting-audit-services']` in
 * tier-industry-matrix.ts:
 *   tax-strategist, audit-coordinator, compliance-auditor,
 *   forensic-auditor, quality-reviewer, risk-manager, bookkeeper
 *
 * The marketplace search returned 0 matches for these names because the
 * existing AgentTemplate pool (seeded from seed-agency-agents.cjs) uses
 * descriptive long names like "Internal Auditor" rather than the matrix
 * slugs. The provisioning service computes the lookup slug via
 * `nameToSlug(templateName)` (deployment.service.ts:51), so to make
 * these slugs resolvable we seed AgentTemplate rows whose .name
 * slugifies to the exact matrix slug.
 *
 * Idempotent via upsert keyed on the deterministic slug-id.
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

const TEMPLATES = [
  {
    name: 'Tax Strategist',
    description:
      'Tax planning and strategy specialist for accounting and audit engagements — covers corporate and individual tax, international tax structuring, R&D credits, and year-end optimisation.',
    type: 'FUNCTIONAL',
    instructions:
      'You provide tax-strategy advice for accounting engagements. Default to defensible positions, cite jurisdictional authority, and escalate aggressive positions to a tax partner.',
  },
  {
    name: 'Audit Coordinator',
    description:
      'Audit engagement coordinator who plans fieldwork, tracks sampling, and ensures the engagement completes within budget and timeline while maintaining ISA / PCAOB compliance.',
    type: 'FUNCTIONAL',
    instructions:
      'You coordinate audit engagements end-to-end. Default to ISA / PCAOB compliance, escalate scope changes, and refuse to issue opinions without sufficient appropriate audit evidence.',
  },
  {
    name: 'Compliance Auditor',
    description:
      'Compliance audit specialist for SOX, ISO, SOC and regulatory frameworks. Maps controls, identifies gaps, and tracks remediation evidence.',
    type: 'FUNCTIONAL',
    instructions:
      'You perform compliance audits against published control frameworks. Default to objective evidence, refuse to accept verbal assertions, and flag control deficiencies with severity ratings.',
  },
  {
    name: 'Forensic Auditor',
    description:
      'Forensic audit and fraud-investigation specialist. Analyses transactions, traces funds, and prepares findings memos that survive external scrutiny.',
    type: 'FUNCTIONAL',
    instructions:
      'You investigate suspected fraud and irregularities. Default to chain-of-custody discipline, refuse to allege intent without corroborating evidence, and document every inference you make.',
  },
  {
    name: 'Quality Reviewer',
    description:
      'Engagement quality reviewer (EQCR) performing second-partner review for accounting and audit engagements. Independent of the engagement team.',
    type: 'FUNCTIONAL',
    instructions:
      'You perform independent quality reviews before issuance. Default to "needs work" until overwhelming evidence supports release, and consult firm risk policies before signing off.',
  },
  {
    name: 'Risk Manager',
    description:
      'Engagement risk manager monitoring concentration, regulatory, and reputational risk across the client portfolio.',
    type: 'FUNCTIONAL',
    instructions:
      'You monitor risk across the engagement portfolio. Default to conservative acceptance thresholds, surface risk concentration before partners raise concerns, and require mitigation plans for new risks.',
  },
  {
    name: 'Bookkeeper',
    description:
      'Bookkeeping specialist for transaction recording, bank reconciliations, journal entries, and monthly close cycles.',
    type: 'FUNCTIONAL',
    instructions:
      'You record transactions and reconcile accounts. Default to source-document evidence, refuse to post unsupported entries, and flag reconciling items older than 30 days.',
  },
];

function nameToSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const t of TEMPLATES) {
    const id = `accounting-${nameToSlug(t.name)}`;
    if (DRY_RUN) {
      console.log(`   --check would seed ${id} (${t.name})`);
      continue;
    }

    const existing = await prisma.agentTemplate.findUnique({ where: { id } });
    if (existing) {
      // Don't overwrite live operator edits. Only fill empty fields.
      const patch = {};
      if (!existing.description) patch.description = t.description;
      if (!existing.systemPrompt) patch.systemPrompt = t.description;
      if (!existing.instructions) patch.instructions = t.instructions;
      if (Object.keys(patch).length > 0) {
        await prisma.agentTemplate.update({ where: { id }, data: patch });
        updated += 1;
        if (VERBOSE) console.log(`   ~ patched ${id}`);
      } else {
        skipped += 1;
        if (VERBOSE) console.log(`   = no-op ${id}`);
      }
      continue;
    }

    await prisma.agentTemplate.create({
      data: {
        id,
        name: t.name,
        description: t.description,
        type: t.type,
        model: 'gpt-4o-mini',
        systemPrompt: t.description,
        instructions: t.instructions,
        permissions: '[]',
        config: '{}',
        isPublic: true,
        version: '1.0.0',
        enabled: true,
        tenantId: null,
      },
    });
    created += 1;
    if (VERBOSE) console.log(`   + created ${id} (${t.name})`);
  }

  console.log(
    `\nseed-accounting-agent-slugs: created=${created} updated=${updated} skipped=${skipped} dryRun=${DRY_RUN}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });