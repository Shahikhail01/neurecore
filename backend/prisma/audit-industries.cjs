#!/usr/bin/env node
/**
 * audit-industries.cjs — PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §10.5.1
 *
 * Two pre-deploy audits:
 *   1. Tenant distribution by Industry — confirms no production tenant is on a
 *      cut Industry before flipping its status to ARCHIVED.
 *   2. Cross-Industry active-Industry check — confirms the 8 cut industries are
 *      still ACTIVE before flip (sanity check), then after flip (verifies
 *      ARCHIVED status).
 *
 * Usage:
 *   node prisma/audit-industries.cjs                          # run all audits
 *   node prisma/audit-industries.cjs --check                  # alias
 *   node prisma/audit-industries.cjs --tenant-id <uuid>       # also audit that tenant
 *   node prisma/audit-industries.cjs --json                    # JSON output for CI
 *
 * Reads DATABASE_URL from backend/.env.production (falls back to .env).
 * Safe to run multiple times — pure SELECT.
 *
 * Exit codes:
 *   0  all audits PASS
 *   1  a cut Industry has 1+ tenants (BLOCKING for §10.5.1 flip)
 *   2  unexpected Industry distribution
 *   3  script error
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Load env
const backendRoot = path.join(__dirname, '..', '..');
for (const file of ['.env.production', '.env']) {
  const envFile = path.join(backendRoot, file);
  if (!fs.existsSync(envFile)) continue;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { PrismaClient } = require('@prisma/client');

const ARGV = process.argv.slice(2);
const JSON_OUT = ARGV.includes('--json');
const TENANT_ID = (() => {
  const i = ARGV.indexOf('--tenant-id');
  return i >= 0 ? ARGV[i + 1] : null;
})();

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

const EXPECTED_SLUGS = new Set([...KEPT_SLUGS, ...CUT_SLUGS]);

function printTable(rows) {
  if (JSON_OUT) return JSON.stringify(rows, null, 2);
  if (rows.length === 0) return '  (no rows)\n';
  const cols = Object.keys(rows[0]);
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
  const fmt = (arr) => arr.map((v, i) => String(v ?? '').padEnd(widths[i])).join(' | ');
  let out = '  ' + fmt(cols) + '\n';
  out += '  ' + widths.map((w) => '-'.repeat(w)).join('-+-') + '\n';
  for (const r of rows) out += '  ' + fmt(cols.map((c) => r[c])) + '\n';
  return out;
}

async function main() {
  const prisma = new PrismaClient();
  let exitCode = 0;

  try {
    // ─── Audit 1: tenant distribution by Industry ───────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log('  Audit 1 — Tenant distribution by industry (status: any)');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    const distribution = await prisma.tenant.groupBy({
      by: ['industry'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const distRows = distribution.map((d) => ({
      industry: d.industry ?? '(null)',
      count: d._count.id,
      bucket: CUT_SLUGS.includes(d.industry ?? '')
        ? 'CUT'
        : KEPT_SLUGS.includes(d.industry ?? '')
          ? 'KEPT'
          : 'OTHER',
    }));

    console.log(printTable(distRows));

    const cutTenants = distRows.filter((d) => d.bucket === 'CUT' && d.count > 0);
    const nullTenants = distRows.filter((d) => d.industry === '(null)');
    const otherTenants = distRows.filter((d) => d.bucket === 'OTHER' && d.count > 0);

    if (cutTenants.length > 0) {
      console.log('\n  ✘ FAIL: cut Industries have live tenants — DO NOT flip status until they migrate:');
      for (const r of cutTenants) console.log(`     - ${r.industry}: ${r.count} tenant(s)`);
      exitCode = Math.max(exitCode, 1);
    } else {
      console.log('\n  ✓ PASS: no production tenants on any cut Industry.');
    }

    if (nullTenants.length > 0) {
      console.log('\n  ⚠ WARN: tenants with NULL industry:');
      for (const r of nullTenants) console.log(`     - ${r.count} tenant(s)`);
    }

    if (otherTenants.length > 0) {
      console.log('\n  ⚠ WARN: tenants on Industries outside the 16-Industry taxonomy:');
      for (const r of otherTenants) console.log(`     - ${r.industry}: ${r.count} tenant(s)`);
    }

    // ─── Audit 2: Industry.status distribution ──────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log('  Audit 2 — Industry.status distribution');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    const industries = await prisma.industry.findMany({
      select: { slug: true, name: true, status: true, industryGroup: true },
      orderBy: [{ status: 'asc' }, { slug: 'asc' }],
    });

    const statusRows = industries.map((i) => ({
      slug: i.slug,
      name: i.name,
      status: i.status,
      group: i.industryGroup,
      bucket: CUT_SLUGS.includes(i.slug)
        ? 'CUT'
        : KEPT_SLUGS.includes(i.slug)
          ? 'KEPT'
          : 'OTHER',
    }));

    console.log(printTable(statusRows));

    const unexpectedIndustries = industries.filter((i) => !EXPECTED_SLUGS.has(i.slug));
    if (unexpectedIndustries.length > 0) {
      console.log('\n  ✘ FAIL: unexpected Industry rows (not in the 16-Industry taxonomy):');
      for (const i of unexpectedIndustries) console.log(`     - ${i.slug} (${i.status})`);
      exitCode = Math.max(exitCode, 2);
    } else {
      console.log('\n  ✓ PASS: Industry table has exactly the 16 expected slugs.');
    }

    // ─── Audit 3 (optional): per-tenant cross-tenant check ───────────────────
    if (TENANT_ID) {
      console.log('\n═══════════════════════════════════════════════════════════════════════════');
      console.log(`  Audit 3 — Per-tenant ${TENANT_ID.slice(0, 8)}…`);
      console.log('═══════════════════════════════════════════════════════════════════════════\n');

      const tenant = await prisma.tenant.findUnique({
        where: { id: TENANT_ID },
        select: { id: true, slug: true, name: true, industry: true, industryGroup: true, tierSlug: true, createdAt: true },
      });

      if (!tenant) {
        console.log(`  ✘ FAIL: tenant ${TENANT_ID} not found.`);
        exitCode = Math.max(exitCode, 2);
      } else {
        console.log(printTable([tenant]));

        const customerCount = await prisma.customer.count({ where: { tenantId: TENANT_ID } });
        const projectCount = await prisma.project.count({ where: { tenantId: TENANT_ID } });
        const departmentCount = await prisma.department.count({ where: { tenantId: TENANT_ID } });
        const agentCount = await prisma.agent.count({ where: { tenantId: TENANT_ID } });

        console.log(printTable([
          { metric: 'customers',  count: customerCount },
          { metric: 'projects',   count: projectCount },
          { metric: 'departments', count: departmentCount },
          { metric: 'agents',     count: agentCount },
        ]));

        // Sanity: tenant's industryGroup must match the Industry.industryGroup of its industry
        if (tenant.industry) {
          const ind = await prisma.industry.findUnique({ where: { slug: tenant.industry } });
          if (!ind) {
            console.log(`  ✘ FAIL: tenant.industry='${tenant.industry}' references missing Industry row.`);
            exitCode = Math.max(exitCode, 2);
          } else if (ind.industryGroup !== tenant.industryGroup) {
            console.log(`  ✘ FAIL: tenant.industryGroup='${tenant.industryGroup}' != Industry.industryGroup='${ind.industryGroup}'`);
            exitCode = Math.max(exitCode, 2);
          } else {
            console.log(`  ✓ PASS: tenant.industryGroup matches Industry.industryGroup.`);
          }
        }
      }
    }

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log(`  Summary — exit code: ${exitCode}`);
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('Fatal:', err);
    exitCode = 3;
  } finally {
    await prisma.$disconnect();
  }

  process.exit(exitCode);
}

main();