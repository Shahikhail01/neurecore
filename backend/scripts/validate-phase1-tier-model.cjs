const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function count(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const checks = [
    {
      name: 'tenants missing tier assignment',
      sql: 'SELECT COUNT(*)::int AS count FROM "tenants" WHERE "tierId" IS NULL',
      fatal: true,
    },
    {
      name: 'agents linked to missing departments',
      sql: `
        SELECT COUNT(*)::int AS count
        FROM "agents" a
        LEFT JOIN "departments" d ON d."id" = a."departmentId"
        WHERE a."departmentId" IS NOT NULL AND d."id" IS NULL
      `,
      fatal: true,
    },
    {
      name: 'agents linked to department in another tenant',
      sql: `
        SELECT COUNT(*)::int AS count
        FROM "agents" a
        JOIN "departments" d ON d."id" = a."departmentId"
        WHERE a."departmentId" IS NOT NULL AND a."tenantId" <> d."tenantId"
      `,
      fatal: true,
    },
    {
      name: 'departments with parent in another tenant',
      sql: `
        SELECT COUNT(*)::int AS count
        FROM "departments" child
        JOIN "departments" parent ON parent."id" = child."parentId"
        WHERE child."parentId" IS NOT NULL AND child."tenantId" <> parent."tenantId"
      `,
      fatal: true,
    },
    {
      name: 'departments linked to missing department templates',
      sql: `
        SELECT COUNT(*)::int AS count
        FROM "departments" d
        LEFT JOIN "department_templates" dt ON dt."id" = d."templateId"
        WHERE d."templateId" IS NOT NULL AND dt."id" IS NULL
      `,
      fatal: true,
    },
    {
      name: 'departments linked to missing tier department pools',
      sql: `
        SELECT COUNT(*)::int AS count
        FROM "departments" d
        LEFT JOIN "tier_department_pools" tdp ON tdp."id" = d."tierDepartmentPoolId"
        WHERE d."tierDepartmentPoolId" IS NOT NULL AND tdp."id" IS NULL
      `,
      fatal: true,
    },
    {
      name: 'departments linked to missing deployed-from tiers',
      sql: `
        SELECT COUNT(*)::int AS count
        FROM "departments" d
        LEFT JOIN "tiers" t ON t."id" = d."deployedFromTierId"
        WHERE d."deployedFromTierId" IS NOT NULL AND t."id" IS NULL
      `,
      fatal: true,
    },
    {
      name: 'agents linked to missing deployed-from tiers',
      sql: `
        SELECT COUNT(*)::int AS count
        FROM "agents" a
        LEFT JOIN "tiers" t ON t."id" = a."deployedFromTierId"
        WHERE a."deployedFromTierId" IS NOT NULL AND t."id" IS NULL
      `,
      fatal: true,
    },
  ];

  let hasFatal = false;

  for (const check of checks) {
    const result = await count(check.sql);
    const status = result === 0 ? 'PASS' : check.fatal ? 'FAIL' : 'WARN';
    console.log(`${status}: ${check.name} = ${result}`);
    if (check.fatal && result > 0) {
      hasFatal = true;
    }
  }

  if (hasFatal) {
    process.exitCode = 1;
    return;
  }

  console.log(
    'PASS: Phase 1 tier model validation checks completed successfully.',
  );
}

main()
  .catch((error) => {
    console.error('FAIL: validation script error');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
