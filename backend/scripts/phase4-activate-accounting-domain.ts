import { PrismaClient } from '@prisma/client';
import {
  AWL_CERTIFICATION_STATUS,
  AWL_CERTIFIED_DOMAIN,
  AWL_CERTIFIED_EXECUTION_PLANE,
  certifiedPlatformTemplateWhere,
} from '../src/modules/agent-templates/agent-template-certification';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const candidates = await prisma.agentTemplate.findMany({
    where: {
      tenantId: null,
      isPublic: true,
      deprecatedAt: null,
      enabled: true,
      OR: [
        { id: { startsWith: 'accounting-' } },
        { id: 'specialized-specialized-chief-of-staff' },
      ],
    },
    select: { id: true, name: true, type: true },
    orderBy: { name: 'asc' },
  });

  if (candidates.length < 1) {
    throw new Error('No Phase 4 accounting template candidates found');
  }

  let updated = 0;
  if (APPLY) {
    updated = await prisma.$executeRaw`
      update agent_templates
      set config = jsonb_set(
        case
          when jsonb_typeof(config::jsonb) = 'object' then config::jsonb
          else '{}'::jsonb
        end,
        '{autonomousWorkLayer}',
        jsonb_build_object(
          'status', ${AWL_CERTIFICATION_STATUS},
          'domain', ${AWL_CERTIFIED_DOMAIN},
          'executionPlane', ${AWL_CERTIFIED_EXECUTION_PLANE},
          'certifiedAt', '2026-07-29T00:00:00.000Z',
          'gate', 'nc_certify_toolset(accounting)'
        ),
        true
      )
      where "tenantId" is null
        and "isPublic" = true
        and "deprecatedAt" is null
        and enabled = true
        and (id like 'accounting-%' or id = 'specialized-specialized-chief-of-staff')
    `;
  }

  const certifiedCount = await prisma.agentTemplate.count({
    where: certifiedPlatformTemplateWhere(),
  });

  console.log(JSON.stringify({
    action: 'phase4_activate_accounting_domain',
    applied: APPLY,
    candidateCount: candidates.length,
    updated,
    certifiedCount,
    candidates,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
