#!/usr/bin/env npx ts-node --project tsconfig.json

import { PrismaClient } from '@prisma/client';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';

const prisma = new PrismaClient();

interface TemplateRow {
  id: string;
  name: string;
  type: string;
  model: string;
  isPublic: boolean;
  tenantId: string | null;
  deprecatedAt: string | null;
  enabled: boolean;
  domain: string | null;
  executionPlane: string | null;
  certificationStatus: string | null;
  naturalIdentity: string;
}

interface DomainBreakdown {
  domain: string;
  certified: number;
  shadow: number;
  deprecated: number;
  rows: number;
}

interface InventoryReport {
  generatedAt: string;
  totalRows: number;
  publicRows: number;
  tenantScopedRows: number;
  certifiedCount: number;
  shadowCount: number;
  deprecatedCount: number;
  perDomain: DomainBreakdown[];
  duplicateNaturalIdentities: { identity: string; count: number; rows: { id: string; name: string; domain: string | null }[] }[];
  allRows: TemplateRow[];
}

async function main(): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT
      id, name, type, model,
      "isPublic", "tenantId", "deprecatedAt", enabled,
      config->'autonomousWorkLayer'->>'domain' AS domain,
      config->'autonomousWorkLayer'->>'executionPlane' AS "executionPlane",
      config->'autonomousWorkLayer'->>'status' AS "certificationStatus"
    FROM agent_templates
    ORDER BY "isPublic" DESC, name ASC`,
  );

  const mapped: TemplateRow[] = rows.map((r) => {
    const domain = (r.domain as string) || null;
    const executionPlane = (r.executionPlane as string) || null;
    const certStatus = (r.certificationStatus as string) || null;
    const naturalIdentity = crypto
      .createHash('sha256')
      .update(`${r.name}|${r.type}|${r.model}|${r.isPublic}`)
      .digest('hex')
      .slice(0, 16);

    return {
      id: r.id as string,
      name: r.name as string,
      type: r.type as string,
      model: r.model as string,
      isPublic: r.isPublic as boolean,
      tenantId: (r.tenantId as string) || null,
      deprecatedAt: (r.deprecatedAt as string) || null,
      enabled: r.enabled as boolean,
      domain,
      executionPlane,
      certificationStatus: certStatus,
      naturalIdentity,
    };
  });

  const certifiedCount = mapped.filter(
    (r) => r.isPublic && !r.tenantId && !r.deprecatedAt && r.enabled && r.certificationStatus === 'certified',
  ).length;

  const shadowCount = mapped.filter(
    (r) =>
      r.isPublic &&
      !r.tenantId &&
      !r.deprecatedAt &&
      r.enabled &&
      r.certificationStatus !== 'certified',
  ).length;

  const deprecatedCount = mapped.filter((r) => r.deprecatedAt !== null).length;

  const domainMap = new Map<string, TemplateRow[]>();
  for (const r of mapped) {
    const key = r.domain || 'UNCATEGORIZED';
    if (!domainMap.has(key)) domainMap.set(key, []);
    domainMap.get(key)!.push(r);
  }

  const perDomain: DomainBreakdown[] = [];
  for (const [domain, dRows] of domainMap.entries()) {
    perDomain.push({
      domain,
      certified: dRows.filter(
        (r) => r.isPublic && !r.tenantId && !r.deprecatedAt && r.enabled && r.certificationStatus === 'certified',
      ).length,
      shadow: dRows.filter(
        (r) =>
          r.isPublic &&
          !r.tenantId &&
          !r.deprecatedAt &&
          r.enabled &&
          r.certificationStatus !== 'certified',
      ).length,
      deprecated: dRows.filter((r) => r.deprecatedAt !== null).length,
      rows: dRows.length,
    });
  }

  const idCounts = new Map<string, TemplateRow[]>();
  for (const r of mapped) {
    if (!idCounts.has(r.naturalIdentity)) idCounts.set(r.naturalIdentity, []);
    idCounts.get(r.naturalIdentity)!.push(r);
  }

  const duplicateNaturalIdentities: InventoryReport['duplicateNaturalIdentities'] = [];
  for (const [identity, matches] of idCounts.entries()) {
    if (matches.length > 1) {
      duplicateNaturalIdentities.push({
        identity,
        count: matches.length,
        rows: matches.map((m) => ({ id: m.id, name: m.name, domain: m.domain })),
      });
    }
  }

  const report: InventoryReport = {
    generatedAt: new Date().toISOString(),
    totalRows: mapped.length,
    publicRows: mapped.filter((r) => r.isPublic && !r.tenantId).length,
    tenantScopedRows: mapped.filter((r) => r.tenantId !== null).length,
    certifiedCount,
    shadowCount,
    deprecatedCount,
    perDomain: perDomain.sort((a, b) => b.rows - a.rows),
    duplicateNaturalIdentities,
    allRows: mapped,
  };

  const outDir = path.resolve(
    __dirname,
    '../../simulations/SIM-04-Accounting-Project-Full-Flow/certification',
  );
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, '2026-07-30-template-inventory.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Template inventory written to ${outPath}`);
  console.log(`Total: ${report.totalRows} | Certified: ${report.certifiedCount} | Shadow: ${report.shadowCount} | Deprecated: ${report.deprecatedCount}`);
  console.log(`Domains: ${report.perDomain.length} | Duplicates: ${report.duplicateNaturalIdentities.length}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
