const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const STARTER_TIER_ID = 'tier_starter';
const EXCEPTION_TIER_ID = 'tier_starter_ops';
const EXCEPTION_TIER_SLUG = 'starter-ops';
const EXCEPTION_TIER_NAME = 'Starter Ops';
const REPORT_PATH = path.resolve(
  __dirname,
  '../../PHASE_11_MIGRATION_REPORT.json',
);

async function main() {
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const exceptionTenants =
    report?.migrationExceptions?.unmappableAgentTemplatesByTenant ?? [];
  const exceptionTemplates =
    report?.migrationExceptions?.unmappableAgentTemplatesByTemplate ?? [];

  if (exceptionTenants.length === 0 || exceptionTemplates.length === 0) {
    console.log(
      'SKIP: No Phase 11 exception tenants found in the migration report.',
    );
    return;
  }

  const starterTier = await prisma.tier.findUnique({
    where: { id: STARTER_TIER_ID },
  });

  if (!starterTier) {
    throw new Error(`Starter tier ${STARTER_TIER_ID} not found`);
  }

  const exceptionTier = await prisma.tier.upsert({
    where: { id: EXCEPTION_TIER_ID },
    update: {
      name: EXCEPTION_TIER_NAME,
      slug: EXCEPTION_TIER_SLUG,
      description:
        'Starter-derived legacy operations tier for tenants carrying operational planning templates outside the default starter model.',
      isActive: true,
      isDefault: false,
      sortOrder: starterTier.sortOrder + 1,
      monthlyPrice: starterTier.monthlyPrice,
      yearlyPrice: starterTier.yearlyPrice,
      currency: starterTier.currency,
      maxUsers: starterTier.maxUsers,
      maxAgents: starterTier.maxAgents,
      maxStorageGB: starterTier.maxStorageGB,
      maxApiCalls: starterTier.maxApiCalls,
      maxConversationMessages: starterTier.maxConversationMessages,
      maxFileSizeMB: starterTier.maxFileSizeMB,
      allowCustomBranding: starterTier.allowCustomBranding,
      allowApiAccess: starterTier.allowApiAccess,
      allowSso: starterTier.allowSso,
      allowAuditExport: starterTier.allowAuditExport,
    },
    create: {
      id: EXCEPTION_TIER_ID,
      name: EXCEPTION_TIER_NAME,
      slug: EXCEPTION_TIER_SLUG,
      description:
        'Starter-derived legacy operations tier for tenants carrying operational planning templates outside the default starter model.',
      isActive: true,
      isDefault: false,
      sortOrder: starterTier.sortOrder + 1,
      monthlyPrice: starterTier.monthlyPrice,
      yearlyPrice: starterTier.yearlyPrice,
      currency: starterTier.currency,
      maxUsers: starterTier.maxUsers,
      maxAgents: starterTier.maxAgents,
      maxStorageGB: starterTier.maxStorageGB,
      maxApiCalls: starterTier.maxApiCalls,
      maxConversationMessages: starterTier.maxConversationMessages,
      maxFileSizeMB: starterTier.maxFileSizeMB,
      allowCustomBranding: starterTier.allowCustomBranding,
      allowApiAccess: starterTier.allowApiAccess,
      allowSso: starterTier.allowSso,
      allowAuditExport: starterTier.allowAuditExport,
    },
  });

  const templateIds = exceptionTemplates.map((template) => template.templateId);
  const templates = await prisma.agentTemplate.findMany({
    where: { id: { in: templateIds } },
    select: { id: true, name: true },
  });
  const templateMap = new Map(
    templates.map((template) => [template.id, template]),
  );

  for (const [index, templateId] of templateIds.entries()) {
    const template = templateMap.get(templateId);
    if (!template) {
      throw new Error(`Agent template ${templateId} not found`);
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO "tier_agent_pools" (
        "id",
        "tierId",
        "templateId",
        "slot",
        "slotType",
        "isRequired",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text,
        '${exceptionTier.id}',
        '${templateId}',
        ${index + 1},
        'CHOICE',
        false,
        NOW(),
        NOW()
      )
      ON CONFLICT ("tierId", "templateId") DO UPDATE
      SET
        "slot" = EXCLUDED."slot",
        "slotType" = EXCLUDED."slotType",
        "isRequired" = EXCLUDED."isRequired",
        "updatedAt" = NOW()
    `);
  }

  const tenantIds = exceptionTenants.map((tenant) => tenant.tenantId);

  const reassignedTenants = await prisma.tenant.updateMany({
    where: { id: { in: tenantIds } },
    data: { tierId: exceptionTier.id },
  });

  const poolEntries = await prisma.$queryRawUnsafe(`
    SELECT "id", "templateId"
    FROM "tier_agent_pools"
    WHERE "tierId" = '${exceptionTier.id}'
  `);
  const poolIdByTemplateId = new Map(
    poolEntries.map((entry) => [entry.templateId, entry.id]),
  );

  let relinkedAgents = 0;

  for (const templateId of templateIds) {
    const poolId = poolIdByTemplateId.get(templateId);
    if (!poolId) {
      throw new Error(
        `Tier pool entry missing after upsert for template ${templateId}`,
      );
    }

    const result = await prisma.agent.updateMany({
      where: {
        tenantId: { in: tenantIds },
        templateId,
      },
      data: {
        tierAgentPoolId: poolId,
        deployedFromTierId: exceptionTier.id,
      },
    });

    relinkedAgents += result.count;
  }

  console.log(
    JSON.stringify(
      {
        createdOrUpdatedTier: {
          id: exceptionTier.id,
          slug: exceptionTier.slug,
          name: exceptionTier.name,
        },
        poolTemplates: templates.map((template) => template.name),
        reassignedTenants: reassignedTenants.count,
        relinkedAgents,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('FAIL: Phase 11 exception tenant reassignment error');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
