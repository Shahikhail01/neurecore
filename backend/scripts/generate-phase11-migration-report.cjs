const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const outputPath = path.resolve(
  __dirname,
  '../../PHASE_11_MIGRATION_REPORT.json',
);

async function count(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return Number(rows[0]?.count ?? 0);
}

async function sample(sql) {
  return prisma.$queryRawUnsafe(sql);
}

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      tenants: await count('SELECT COUNT(*)::int AS count FROM "tenants"'),
      agents: await count('SELECT COUNT(*)::int AS count FROM "agents"'),
      departments: await count(
        'SELECT COUNT(*)::int AS count FROM "departments"',
      ),
      tiers: await count('SELECT COUNT(*)::int AS count FROM "tiers"'),
    },
    checks: {
      tenantsWithoutValidTier: {
        count: await count(`
          SELECT COUNT(*)::int AS count
          FROM "tenants" t
          LEFT JOIN "tiers" tier ON tier."id" = t."tierId"
          WHERE t."tierId" IS NULL OR tier."id" IS NULL
        `),
        samples: await sample(`
          SELECT t."id", t."name", t."slug", t."tierId"
          FROM "tenants" t
          LEFT JOIN "tiers" tier ON tier."id" = t."tierId"
          WHERE t."tierId" IS NULL OR tier."id" IS NULL
          ORDER BY t."createdAt" ASC
          LIMIT 25
        `),
      },
      agentsWithoutValidTenantLinkage: {
        count: await count(`
          SELECT COUNT(*)::int AS count
          FROM "agents" a
          LEFT JOIN "tenants" t ON t."id" = a."tenantId"
          LEFT JOIN "departments" d ON d."id" = a."departmentId"
          WHERE t."id" IS NULL
             OR (a."departmentId" IS NOT NULL AND d."id" IS NULL)
             OR (a."departmentId" IS NOT NULL AND a."tenantId" <> d."tenantId")
        `),
        samples: await sample(`
          SELECT a."id", a."name", a."tenantId", a."departmentId", d."tenantId" AS "departmentTenantId"
          FROM "agents" a
          LEFT JOIN "tenants" t ON t."id" = a."tenantId"
          LEFT JOIN "departments" d ON d."id" = a."departmentId"
          WHERE t."id" IS NULL
             OR (a."departmentId" IS NOT NULL AND d."id" IS NULL)
             OR (a."departmentId" IS NOT NULL AND a."tenantId" <> d."tenantId")
          ORDER BY a."createdAt" ASC
          LIMIT 25
        `),
      },
      departmentsWithInconsistentParentRelations: {
        count: await count(`
          SELECT COUNT(*)::int AS count
          FROM "departments" child
          LEFT JOIN "departments" parent ON parent."id" = child."parentId"
          WHERE child."parentId" IS NOT NULL
            AND (parent."id" IS NULL OR child."tenantId" <> parent."tenantId")
        `),
        samples: await sample(`
          SELECT child."id", child."name", child."tenantId", child."parentId", parent."tenantId" AS "parentTenantId"
          FROM "departments" child
          LEFT JOIN "departments" parent ON parent."id" = child."parentId"
          WHERE child."parentId" IS NOT NULL
            AND (parent."id" IS NULL OR child."tenantId" <> parent."tenantId")
          ORDER BY child."createdAt" ASC
          LIMIT 25
        `),
      },
      resourcesThatCannotBeMappedAutomatically: {
        agents: {
          count: await count(`
            SELECT COUNT(*)::int AS count
            FROM "agents" a
            JOIN "tenants" t ON t."id" = a."tenantId"
            LEFT JOIN "tier_agent_pools" tap
              ON tap."tierId" = t."tierId"
             AND tap."templateId" = a."templateId"
            WHERE a."templateId" IS NOT NULL
              AND a."tierAgentPoolId" IS NULL
              AND tap."id" IS NULL
          `),
          samples: await sample(`
            SELECT a."id", a."name", a."tenantId", t."tierId", a."templateId"
            FROM "agents" a
            JOIN "tenants" t ON t."id" = a."tenantId"
            LEFT JOIN "tier_agent_pools" tap
              ON tap."tierId" = t."tierId"
             AND tap."templateId" = a."templateId"
            WHERE a."templateId" IS NOT NULL
              AND a."tierAgentPoolId" IS NULL
              AND tap."id" IS NULL
            ORDER BY a."createdAt" ASC
            LIMIT 25
          `),
        },
        departments: {
          count: await count(`
            SELECT COUNT(*)::int AS count
            FROM "departments" d
            JOIN "tenants" t ON t."id" = d."tenantId"
            LEFT JOIN "tier_department_pools" tdp
              ON tdp."tierId" = t."tierId"
             AND tdp."departmentTemplateId" = d."templateId"
            WHERE d."templateId" IS NOT NULL
              AND d."tierDepartmentPoolId" IS NULL
              AND tdp."id" IS NULL
          `),
          samples: await sample(`
            SELECT d."id", d."name", d."tenantId", t."tierId", d."templateId"
            FROM "departments" d
            JOIN "tenants" t ON t."id" = d."tenantId"
            LEFT JOIN "tier_department_pools" tdp
              ON tdp."tierId" = t."tierId"
             AND tdp."departmentTemplateId" = d."templateId"
            WHERE d."templateId" IS NOT NULL
              AND d."tierDepartmentPoolId" IS NULL
              AND tdp."id" IS NULL
            ORDER BY d."createdAt" ASC
            LIMIT 25
          `),
        },
      },
    },
    migrationExceptions: {
      unmappableAgentTemplatesByTemplate: await sample(`
        SELECT
          a."templateId",
          at."name" AS "templateName",
          COUNT(*)::int AS "agentCount",
          COUNT(DISTINCT a."tenantId")::int AS "tenantCount"
        FROM "agents" a
        JOIN "tenants" t ON t."id" = a."tenantId"
        LEFT JOIN "tier_agent_pools" tap
          ON tap."tierId" = t."tierId"
         AND tap."templateId" = a."templateId"
        LEFT JOIN "agent_templates" at ON at."id" = a."templateId"
        WHERE a."templateId" IS NOT NULL
          AND a."tierAgentPoolId" IS NULL
          AND tap."id" IS NULL
        GROUP BY a."templateId", at."name"
        ORDER BY COUNT(*) DESC, at."name" ASC
      `),
      unmappableAgentTemplatesByTenant: await sample(`
        SELECT
          a."tenantId",
          tenant."name" AS "tenantName",
          tenant."tierId",
          COUNT(*)::int AS "agentCount"
        FROM "agents" a
        JOIN "tenants" tenant ON tenant."id" = a."tenantId"
        LEFT JOIN "tier_agent_pools" tap
          ON tap."tierId" = tenant."tierId"
         AND tap."templateId" = a."templateId"
        WHERE a."templateId" IS NOT NULL
          AND a."tierAgentPoolId" IS NULL
          AND tap."id" IS NULL
        GROUP BY a."tenantId", tenant."name", tenant."tierId"
        ORDER BY COUNT(*) DESC, tenant."name" ASC
      `),
    },
    lineageBackfill: {
      departmentsMissingLineage: {
        count: await count(`
          SELECT COUNT(*)::int AS count
          FROM "departments"
          WHERE "templateId" IS NULL
            AND "tierDepartmentPoolId" IS NULL
            AND "deployedFromTierId" IS NULL
        `),
        note: 'Legacy live departments without lineage remain explicitly nullable and require no destructive backfill.',
      },
      agentsMissingDeployTierDespitePool: {
        count: await count(`
          SELECT COUNT(*)::int AS count
          FROM "agents"
          WHERE "tierAgentPoolId" IS NOT NULL
            AND "deployedFromTierId" IS NULL
        `),
        note: 'Template-backed agents with tier pool ancestry should normally carry deployedFromTierId after rollout.',
      },
      departmentsMissingDeployTierDespitePool: {
        count: await count(`
          SELECT COUNT(*)::int AS count
          FROM "departments"
          WHERE "tierDepartmentPoolId" IS NOT NULL
            AND "deployedFromTierId" IS NULL
        `),
        note: 'Template-backed departments with tier pool ancestry should normally carry deployedFromTierId after rollout.',
      },
    },
    notes: [
      'Tenant tier mapping is already handled by prior tier backfill migrations; this report verifies no remaining unmapped tenants.',
      'Phase 11 focuses on safe reporting and verification before any destructive cleanup.',
      'Resources listed under migrationExceptions require product or tenancy review before they can be assigned to a tier pool automatically.',
    ],
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

  const fatalCounts = [
    report.checks.tenantsWithoutValidTier.count,
    report.checks.agentsWithoutValidTenantLinkage.count,
    report.checks.departmentsWithInconsistentParentRelations.count,
    report.lineageBackfill.agentsMissingDeployTierDespitePool.count,
    report.lineageBackfill.departmentsMissingDeployTierDespitePool.count,
  ];

  const manualReviewCounts = [
    report.checks.resourcesThatCannotBeMappedAutomatically.agents.count,
    report.checks.resourcesThatCannotBeMappedAutomatically.departments.count,
  ];

  console.log(`WROTE: ${outputPath}`);
  console.log(
    `SUMMARY: tenants=${report.summary.tenants}, agents=${report.summary.agents}, departments=${report.summary.departments}, tiers=${report.summary.tiers}`,
  );
  console.log(
    `CHECKS: invalidTenants=${report.checks.tenantsWithoutValidTier.count}, invalidAgents=${report.checks.agentsWithoutValidTenantLinkage.count}, invalidDepartments=${report.checks.departmentsWithInconsistentParentRelations.count}, unmappableAgents=${report.checks.resourcesThatCannotBeMappedAutomatically.agents.count}, unmappableDepartments=${report.checks.resourcesThatCannotBeMappedAutomatically.departments.count}`,
  );

  if (fatalCounts.some((countValue) => countValue > 0)) {
    process.exitCode = 1;
    console.error(
      'FAIL: Phase 11 migration report detected unresolved migration issues.',
    );
    return;
  }

  if (manualReviewCounts.some((countValue) => countValue > 0)) {
    console.log(
      'WARN: Phase 11 migration report completed with manual-review exceptions. See migrationExceptions in the generated report.',
    );
    return;
  }

  console.log(
    'PASS: Phase 11 migration report completed with no unresolved migration issues.',
  );
}

main()
  .catch((error) => {
    console.error('FAIL: Phase 11 migration report error');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
