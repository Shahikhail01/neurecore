import {
  AWL_CERTIFICATION_STATUS,
  AWL_CERTIFIED_DOMAIN,
  AWL_CERTIFIED_EXECUTION_PLANE,
  certifiedPlatformTemplateWhere,
  tenantVisibleTemplateWhere,
} from './agent-template-certification';

describe('Agent template certification filter', () => {
  it('requires accounting-domain upstream Hermes certification for platform templates', () => {
    expect(certifiedPlatformTemplateWhere()).toEqual({
      isPublic: true,
      tenantId: null,
      deprecatedAt: null,
      enabled: true,
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
    });
  });

  it('preserves extra filters without relaxing certification requirements', () => {
    expect(certifiedPlatformTemplateWhere({ type: 'FUNCTIONAL' as never })).toMatchObject({
      type: 'FUNCTIONAL',
      isPublic: true,
      tenantId: null,
      enabled: true,
    });
  });

  it('keeps tenant templates visible while quarantining uncertified platform templates', () => {
    expect(tenantVisibleTemplateWhere('tenant-1', { type: 'CORE' as never })).toMatchObject({
      type: 'CORE',
      OR: [
        { tenantId: 'tenant-1' },
        expect.objectContaining({
          isPublic: true,
          tenantId: null,
          enabled: true,
        }),
      ],
    });
  });
});
