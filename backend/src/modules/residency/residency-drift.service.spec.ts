/**
 * Residency + Drift — unit tests.
 */

import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ResidencyService,
  DriftService,
  OOB_REGIONS,
} from './residency-drift.service';

function mockPrisma() {
  return {
    tenantRegionConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    driftBaseline: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    driftEvaluation: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;
}

describe('OOB_REGIONS registry', () => {
  it('ships 11 OOB regions', () => {
    expect(OOB_REGIONS.length).toBe(11);
  });
  it('every region has display name + locale + currency', () => {
    for (const r of OOB_REGIONS) {
      expect(r.displayName.length).toBeGreaterThan(0);
      expect(r.defaultLocale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(r.defaultCurrency.length).toBe(3);
    }
  });
});

describe('ResidencyService', () => {
  let svc: ResidencyService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new ResidencyService(prisma);
  });

  it('resolve falls back to US_EAST when no config', async () => {
    prisma.tenantRegionConfig.findMany.mockResolvedValue([]);
    expect(await svc.resolve('tenant-a')).toBe('US_EAST');
  });

  it('resolve returns the most-recently-updated region', async () => {
    prisma.tenantRegionConfig.findMany.mockResolvedValue([
      { region: 'EU_CENTRAL', updatedAt: new Date() },
    ]);
    expect(await svc.resolve('tenant-a')).toBe('EU_CENTRAL');
  });

  it('resolve refuses wildcard', async () => {
    await expect(svc.resolve('*')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('setRegion rejects unknown region', async () => {
    await expect(
      svc.setRegion({ tenantId: 'tenant-a', region: 'MARS' as never }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('setRegion upserts with HARD enforcement default', async () => {
    prisma.tenantRegionConfig.upsert.mockResolvedValue({});
    await svc.setRegion({ tenantId: 'tenant-a', region: 'EU_WEST' });
    expect(prisma.tenantRegionConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_region: { tenantId: 'tenant-a', region: 'EU_WEST' } },
        create: expect.objectContaining({ enforcementMode: 'HARD' }),
        update: expect.objectContaining({ enforcementMode: 'HARD' }),
      }),
    );
  });

  it('setRegion refuses wildcard', async () => {
    await expect(
      svc.setRegion({ tenantId: '*', region: 'US_EAST' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('enforce', () => {
    it('refuses when no config exists for the target region', async () => {
      prisma.tenantRegionConfig.findUnique.mockResolvedValue(null);
      await expect(
        svc.enforce({ tenantId: 'tenant-a', targetRegion: 'EU_WEST', dataPlane: 'llm_calls' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('SOFT mode logs but does not refuse', async () => {
      prisma.tenantRegionConfig.findUnique.mockResolvedValue({
        region: 'US_EAST',
        enforcementMode: 'SOFT',
        overrides: {},
      });
      await expect(
        svc.enforce({ tenantId: 'tenant-a', targetRegion: 'EU_WEST', dataPlane: 'llm_calls' }),
      ).resolves.toBeNull();
    });

    it('HARD mode refuses cross-region call', async () => {
      prisma.tenantRegionConfig.findUnique.mockResolvedValue({
        region: 'US_EAST',
        enforcementMode: 'HARD',
        overrides: {},
      });
      await expect(
        svc.enforce({ tenantId: 'tenant-a', targetRegion: 'EU_WEST', dataPlane: 'llm_calls' }),
      ).rejects.toThrow(/residency HARD/);
    });

    it('HARD mode honours per-data-plane override', async () => {
      prisma.tenantRegionConfig.findUnique.mockResolvedValue({
        region: 'US_EAST',
        enforcementMode: 'HARD',
        overrides: { llm_calls: 'US_WEST' },
      });
      // llm_calls is overridden to US_WEST — call to US_WEST must be allowed.
      await expect(
        svc.enforce({ tenantId: 'tenant-a', targetRegion: 'US_WEST', dataPlane: 'llm_calls' }),
      ).resolves.toBeNull();
      // But data_storage still pinned to US_EAST.
      await expect(
        svc.enforce({ tenantId: 'tenant-a', targetRegion: 'EU_WEST', dataPlane: 'data_storage' }),
      ).rejects.toThrow(/residency HARD/);
    });
  });
});

describe('DriftService', () => {
  let svc: DriftService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new DriftService(prisma);
  });

  it('recordBaseline stores the row with a 90-day TTL', async () => {
    prisma.driftBaseline.create.mockResolvedValue({});
    await svc.recordBaseline({
      modelId: 'lead-scoring',
      features: { engagement: { mean: 0.5, stdDev: 0.1, count: 100 } },
      sampleSize: 100,
    });
    expect(prisma.driftBaseline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelId: 'lead-scoring',
          expiresAt: expect.any(Date),
        }),
      }),
    );
  });

  it('runBacktest returns STABLE when no active baseline exists', async () => {
    prisma.driftBaseline.findFirst.mockResolvedValue(null);
    const out = await svc.runBacktest({
      modelId: 'lead-scoring',
      features: { engagement: { mean: 0.5, stdDev: 0.1, count: 50 } },
    });
    expect(out.outcome).toBe('STABLE');
    expect(out.note).toContain('no active baseline');
  });

  it('runBacktest flags CRITICAL_DRIFT when mean shifts > 25%', async () => {
    prisma.driftBaseline.findFirst.mockResolvedValue({
      baseline: { engagement: { mean: 0.5, stdDev: 0.1, count: 100 } },
    });
    prisma.driftEvaluation.create.mockResolvedValue({});
    const out = await svc.runBacktest({
      modelId: 'lead-scoring',
      features: { engagement: { mean: 1.0, stdDev: 0.1, count: 50 } },
    });
    expect(out.outcome).toBe('CRITICAL_DRIFT');
    expect(out.scores.engagement).toBeGreaterThanOrEqual(0.25);
  });

  it('runBacktest flags DRIFTING when mean shifts 10–25%', async () => {
    prisma.driftBaseline.findFirst.mockResolvedValue({
      baseline: { engagement: { mean: 0.5, stdDev: 0.1, count: 100 } },
    });
    prisma.driftEvaluation.create.mockResolvedValue({});
    const out = await svc.runBacktest({
      modelId: 'lead-scoring',
      features: { engagement: { mean: 0.6, stdDev: 0.1, count: 50 } },
    });
    expect(out.outcome).toBe('DRIFTING');
  });

  it('runBacktest returns STABLE for identical distribution', async () => {
    prisma.driftBaseline.findFirst.mockResolvedValue({
      baseline: { engagement: { mean: 0.5, stdDev: 0.1, count: 100 } },
    });
    prisma.driftEvaluation.create.mockResolvedValue({});
    const out = await svc.runBacktest({
      modelId: 'lead-scoring',
      features: { engagement: { mean: 0.5, stdDev: 0.1, count: 100 } },
    });
    expect(out.outcome).toBe('STABLE');
  });

  it('runBacktest persists the evaluation row when a baseline exists', async () => {
    prisma.driftBaseline.findFirst.mockResolvedValue({
      baseline: { engagement: { mean: 0.5, stdDev: 0.1, count: 100 } },
    });
    prisma.driftEvaluation.create.mockResolvedValue({});
    await svc.runBacktest({
      modelId: 'lead-scoring',
      features: { engagement: { mean: 0.5, stdDev: 0.1, count: 100 } },
    });
    expect(prisma.driftEvaluation.create).toHaveBeenCalled();
  });

  it('runBacktest does NOT persist when no baseline (skip case)', async () => {
    prisma.driftBaseline.findFirst.mockResolvedValue(null);
    await svc.runBacktest({
      modelId: 'lead-scoring',
      features: { engagement: { mean: 0.5, stdDev: 0.1, count: 50 } },
    });
    expect(prisma.driftEvaluation.create).not.toHaveBeenCalled();
  });

  it('runBacktest refuses wildcard tenant', async () => {
    await expect(
      svc.runBacktest({
        tenantId: '*',
        modelId: 'lead-scoring',
        features: {},
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
