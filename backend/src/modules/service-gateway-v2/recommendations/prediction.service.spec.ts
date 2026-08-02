import { PredictionService } from '../../analytics/services/prediction.service';
import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { FeatureSnapshotRepository } from '../../analytics/services/featureSnapshot.repository';
import type { CalibratedAnalyticsProvider } from '../../analytics/providers/calibrated.provider';

function buildPrisma(): Pick<PrismaService, 'analyticsModel'> {
  return {
    analyticsModel: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          null,
        ) as unknown as PrismaService['analyticsModel']['findFirst'],
    },
  } as unknown as Pick<PrismaService, 'analyticsModel'>;
}

const freshSnapshot = (
  id: string,
  recordedAt: Date,
  modelId: string | null,
) => ({
  id,
  tenantId: 'tenant-A',
  subjectType: 'project',
  subjectId: 'proj-1',
  featuresJson: { revenue: 100, churn: 0.05 },
  modelId,
  modelVersion: modelId ? 'v1' : null,
  snapshotHash: 'abc123',
  recordedAt,
});

const baseInput = {
  tenantId: 'tenant-A',
  subject: { type: 'project', id: 'proj-1' },
  predictionType: 'churn',
};

describe('PredictionService', () => {
  it('returns a Prediction with provenance when snapshot is valid', async () => {
    const now = new Date();
    const listRecent = jest
      .fn()
      .mockResolvedValue([
        freshSnapshot('snap-1', now, 'model-1'),
        freshSnapshot('snap-2', new Date(now.getTime() - 60_000), 'model-1'),
        freshSnapshot('snap-3', new Date(now.getTime() - 120_000), 'model-1'),
      ]);
    const score = jest.fn().mockResolvedValue({
      score: 0.8,
      confidence: 0.9,
      modelId: 'model-1',
      modelVersion: 'v1',
      featureCount: 2,
      source: 'linear',
      basis: ['matched 2 features'],
    });
    const service = new PredictionService(
      buildPrisma() as unknown as PrismaService,
      { listRecent } as unknown as FeatureSnapshotRepository,
      { score } as unknown as CalibratedAnalyticsProvider,
    );

    const result = await service.predict(baseInput);

    expect(result.value).toBe(0.8);
    expect(result.confidence).toBe(0.9);
    expect(result.featureSnapshotId).toBe('snap-1');
    expect(result.model).toEqual({ id: 'model-1', version: 'v1' });
    expect(result.explanation).toEqual(
      expect.arrayContaining([expect.stringMatching(/model: model-1@v1/)]),
    );
    expect(result.tenantId).toBe('tenant-A');
    expect(result.id).toMatch(/^pred-snap-1-/);
  });

  it('abstains when there is no feature snapshot', async () => {
    const listRecent = jest.fn().mockResolvedValue([]);
    const score = jest.fn();
    const service = new PredictionService(
      buildPrisma() as unknown as PrismaService,
      { listRecent } as unknown as FeatureSnapshotRepository,
      { score } as unknown as CalibratedAnalyticsProvider,
    );

    const result = await service.predict(baseInput);

    expect(result.value).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.explanation[0]).toMatch(/abstain: no feature snapshot/);
    expect(score).not.toHaveBeenCalled();
  });

  it('abstains when the latest snapshot is older than the staleness window', async () => {
    const stale = new Date(Date.now() - 30 * 3600 * 1000);
    const listRecent = jest
      .fn()
      .mockResolvedValue([
        freshSnapshot('snap-1', stale, 'model-1'),
        freshSnapshot('snap-2', new Date(stale.getTime() - 60_000), 'model-1'),
        freshSnapshot('snap-3', new Date(stale.getTime() - 120_000), 'model-1'),
      ]);
    const service = new PredictionService(
      buildPrisma() as unknown as PrismaService,
      { listRecent } as unknown as FeatureSnapshotRepository,
      { score: jest.fn() } as unknown as CalibratedAnalyticsProvider,
    );

    const result = await service.predict(baseInput);

    expect(result.value).toBeNull();
    expect(result.explanation[0]).toMatch(/abstain: snapshot stale/);
  });

  it('abstains when there are fewer than MIN_EVIDENCE_COUNT snapshots', async () => {
    const now = new Date();
    const listRecent = jest
      .fn()
      .mockResolvedValue([freshSnapshot('snap-1', now, 'model-1')]);
    const service = new PredictionService(
      buildPrisma() as unknown as PrismaService,
      { listRecent } as unknown as FeatureSnapshotRepository,
      { score: jest.fn() } as unknown as CalibratedAnalyticsProvider,
    );

    const result = await service.predict(baseInput);

    expect(result.value).toBeNull();
    expect(result.explanation[0]).toMatch(/abstain: insufficient evidence/);
  });

  it('abstains when the calibrated score has low confidence', async () => {
    const now = new Date();
    const listRecent = jest
      .fn()
      .mockResolvedValue([
        freshSnapshot('snap-1', now, 'model-1'),
        freshSnapshot('snap-2', new Date(now.getTime() - 60_000), 'model-1'),
        freshSnapshot('snap-3', new Date(now.getTime() - 120_000), 'model-1'),
      ]);
    const score = jest.fn().mockResolvedValue({
      score: 0.4,
      confidence: 0.3,
      modelId: 'model-1',
      modelVersion: 'v1',
      featureCount: 2,
      source: 'linear',
      basis: ['low confidence'],
    });
    const service = new PredictionService(
      buildPrisma() as unknown as PrismaService,
      { listRecent } as unknown as FeatureSnapshotRepository,
      { score } as unknown as CalibratedAnalyticsProvider,
    );

    const result = await service.predict(baseInput);

    expect(result.value).toBeNull();
    expect(result.explanation[0]).toMatch(/abstain: low confidence/);
  });

  it('never reads a snapshot belonging to another tenant', async () => {
    const listRecent = jest
      .fn()
      .mockImplementation(async (tenantId: string) => {
        if (tenantId !== 'tenant-A') return [];
        const now = new Date();
        return [
          freshSnapshot('snap-A1', now, 'model-1'),
          freshSnapshot('snap-A2', new Date(now.getTime() - 60_000), 'model-1'),
          freshSnapshot(
            'snap-A3',
            new Date(now.getTime() - 120_000),
            'model-1',
          ),
        ];
      });
    const score = jest.fn().mockResolvedValue({
      score: 0.7,
      confidence: 0.8,
      modelId: 'model-1',
      modelVersion: 'v1',
      featureCount: 2,
      source: 'linear',
      basis: ['ok'],
    });
    const service = new PredictionService(
      buildPrisma() as unknown as PrismaService,
      { listRecent } as unknown as FeatureSnapshotRepository,
      { score } as unknown as CalibratedAnalyticsProvider,
    );

    const a = await service.predict({ ...baseInput, tenantId: 'tenant-A' });
    expect(a.value).toBe(0.7);

    const b = await service.predict({ ...baseInput, tenantId: 'tenant-B' });
    expect(b.value).toBeNull();
    expect(b.explanation[0]).toMatch(/abstain: no feature snapshot/);
    const calledTenants = listRecent.mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );
    expect(calledTenants).toEqual(['tenant-A', 'tenant-B']);
  });
});
