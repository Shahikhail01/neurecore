import { TenantFlagsService, FeatureFlag } from './tenant-flags.service';
import type { PrismaService } from '../../infrastructure/database/prisma.service';

describe('TenantFlagsService', () => {
  let prisma: {
    tenantFeatureFlagOverride: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    featureFlagAuditLog: {
      create: jest.Mock;
    };
  };
  let service: TenantFlagsService;

  beforeEach(() => {
    prisma = {
      tenantFeatureFlagOverride: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue(undefined),
      },
      featureFlagAuditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    service = new TenantFlagsService(prisma as unknown as PrismaService);
  });

  it('returns the default value when no tenant override exists', async () => {
    prisma.tenantFeatureFlagOverride.findUnique.mockResolvedValue(null);

    await expect(
      service.isEnabled(FeatureFlag.CANONICAL_INITIATION, 'tenant-1'),
    ).resolves.toBe(false);

    expect(prisma.tenantFeatureFlagOverride.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_flagKey: {
          tenantId: 'tenant-1',
          flagKey: FeatureFlag.CANONICAL_INITIATION,
        },
      },
    });
  });

  it('returns and caches a tenant override', async () => {
    prisma.tenantFeatureFlagOverride.findUnique.mockResolvedValue({
      enabled: true,
    });

    await expect(
      service.isEnabled(FeatureFlag.CANONICAL_INITIATION, 'tenant-1'),
    ).resolves.toBe(true);
    await expect(
      service.isEnabled(FeatureFlag.CANONICAL_INITIATION, 'tenant-1'),
    ).resolves.toBe(true);

    expect(prisma.tenantFeatureFlagOverride.findUnique).toHaveBeenCalledTimes(1);
  });

  it('persists overrides, writes an audit record, and invalidates cache', async () => {
    prisma.tenantFeatureFlagOverride.findUnique
      .mockResolvedValueOnce({ enabled: false })
      .mockResolvedValueOnce({ enabled: true });

    await service.setOverride(
      FeatureFlag.CANONICAL_INITIATION,
      'tenant-1',
      true,
      'actor-1',
    );

    expect(prisma.tenantFeatureFlagOverride.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_flagKey: {
          tenantId: 'tenant-1',
          flagKey: FeatureFlag.CANONICAL_INITIATION,
        },
      },
      create: {
        tenantId: 'tenant-1',
        flagKey: FeatureFlag.CANONICAL_INITIATION,
        enabled: true,
        setByActorId: 'actor-1',
        version: 1,
      },
      update: {
        enabled: true,
        setByActorId: 'actor-1',
        version: { increment: 1 },
      },
    });
    expect(prisma.featureFlagAuditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        flagKey: FeatureFlag.CANONICAL_INITIATION,
        action: 'OVERRIDE_UPDATED',
        actorId: 'actor-1',
        oldValue: false,
        newValue: true,
      },
    });

    await expect(
      service.isEnabled(FeatureFlag.CANONICAL_INITIATION, 'tenant-1'),
    ).resolves.toBe(true);
  });

  it('can invalidate the cache for a single tenant', async () => {
    prisma.tenantFeatureFlagOverride.findUnique
      .mockResolvedValueOnce({ enabled: true })
      .mockResolvedValueOnce({ enabled: false });

    await expect(
      service.isEnabled(FeatureFlag.CANONICAL_INITIATION, 'tenant-1'),
    ).resolves.toBe(true);

    await service.invalidateCache('tenant-1');

    await expect(
      service.isEnabled(FeatureFlag.CANONICAL_INITIATION, 'tenant-1'),
    ).resolves.toBe(false);

    expect(prisma.tenantFeatureFlagOverride.findUnique).toHaveBeenCalledTimes(2);
  });
});
