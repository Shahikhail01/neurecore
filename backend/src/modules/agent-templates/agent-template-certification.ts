import type { Prisma } from '@prisma/client';

export const AWL_CERTIFIED_DOMAIN = 'accounting-audit-services';
export const AWL_CERTIFIED_EXECUTION_PLANE = 'upstream-hermes';
export const AWL_CERTIFICATION_STATUS = 'certified';

export const AWL_PLATFORM_TEMPLATE_CERTIFICATION_WHERE = {
  config: {
    path: ['autonomousWorkLayer', 'status'],
    equals: AWL_CERTIFICATION_STATUS,
  },
  AND: [
    {
      config: {
        path: ['autonomousWorkLayer', 'domain'],
        equals: AWL_CERTIFIED_DOMAIN,
      },
    },
    {
      config: {
        path: ['autonomousWorkLayer', 'executionPlane'],
        equals: AWL_CERTIFIED_EXECUTION_PLANE,
      },
    },
  ],
} satisfies Prisma.AgentTemplateWhereInput;

export const AWL_CERTIFIED_PLATFORM_TEMPLATE_WHERE = {
  isPublic: true,
  tenantId: null,
  deprecatedAt: null,
  enabled: true,
  ...AWL_PLATFORM_TEMPLATE_CERTIFICATION_WHERE,
} satisfies Prisma.AgentTemplateWhereInput;

export function certifiedPlatformTemplateWhere(
  extra: Prisma.AgentTemplateWhereInput = {},
): Prisma.AgentTemplateWhereInput {
  const baseAnd = Array.isArray(AWL_CERTIFIED_PLATFORM_TEMPLATE_WHERE.AND)
    ? AWL_CERTIFIED_PLATFORM_TEMPLATE_WHERE.AND
    : [];
  const extraAnd = Array.isArray(extra.AND) ? extra.AND : [];

  return {
    ...AWL_CERTIFIED_PLATFORM_TEMPLATE_WHERE,
    ...extra,
    AND: [...baseAnd, ...extraAnd],
  };
}

export function tenantVisibleTemplateWhere(
  tenantId: string,
  extra: Prisma.AgentTemplateWhereInput = {},
): Prisma.AgentTemplateWhereInput {
  return {
    ...extra,
    OR: [
      { tenantId },
      certifiedPlatformTemplateWhere(),
    ],
  };
}
