import { RecommendationService } from '../../analytics/services/recommendation.service';
import type { WorkRunView } from '../../work-runtime/contracts/work-runtime.interface';
import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { FeatureSnapshotRepository } from '../../analytics/services/featureSnapshot.repository';
import type { CalibratedAnalyticsProvider } from '../../analytics/providers/calibrated.provider';
import type { IWorkRuntime } from '../../work-runtime/contracts/work-runtime.interface';
import type { Recommendation } from '../interfaces';

function buildSnapshotRepo(
  rows: Array<{
    id: string;
    tenantId: string;
    subjectType: string;
    subjectId: string;
    featuresJson: Record<string, unknown>;
    modelId: string | null;
    modelVersion: string | null;
    snapshotHash: string;
    recordedAt: Date;
  }>,
): Pick<FeatureSnapshotRepository, 'listRecent'> {
  return {
    listRecent: jest
      .fn()
      .mockImplementation(async (tenantId: string) =>
        rows.filter((r) => r.tenantId === tenantId),
      ),
  };
}

function buildPrisma(
  model: { id: string; version: string } | null,
): Pick<PrismaService, 'analyticsModel'> {
  return {
    analyticsModel: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          model,
        ) as unknown as PrismaService['analyticsModel']['findFirst'],
    },
  } as unknown as Pick<PrismaService, 'analyticsModel'>;
}

function buildCalibrated(
  score: unknown,
): Pick<CalibratedAnalyticsProvider, 'score'> {
  return {
    score: jest.fn().mockResolvedValue(score),
  };
}

function buildWorkRuntime(run?: WorkRunView): Pick<IWorkRuntime, 'createRun'> {
  return {
    createRun: jest.fn().mockResolvedValue(
      run ?? {
        id: 'run-1',
        tenantId: 'tenant-A',
        actorId: 'actor-1',
        actorType: 'HUMAN',
        status: 'CREATED',
        request: '',
        currentStepIndex: 0,
        planVersion: 0,
        summary: null,
        failureCode: null,
        failureReason: null,
        createdAt: new Date().toISOString(),
      },
    ),
  };
}

const baseInput = {
  tenantId: 'tenant-A',
  context: { subjectType: 'project', subjectId: 'proj-1' },
};

const freshSnapshot = (id: string, tenantId: string, recordedAt: Date) => ({
  id,
  tenantId,
  subjectType: 'project',
  subjectId: 'proj-1',
  featuresJson: { revenue: 100 },
  modelId: 'model-1',
  modelVersion: 'v1',
  snapshotHash: 'h' + id,
  recordedAt,
});

const highConfidence = {
  score: 0.85,
  confidence: 0.9,
  modelId: 'model-1',
  modelVersion: 'v1',
  featureCount: 1,
  source: 'linear' as const,
  basis: ['ok'],
};

describe('RecommendationService', () => {
  it('produces ranked actions for a tenant with fresh snapshots', async () => {
    const now = new Date();
    const repo = buildSnapshotRepo([
      freshSnapshot('snap-1', 'tenant-A', now),
      freshSnapshot('snap-2', 'tenant-A', new Date(now.getTime() - 60_000)),
    ]);
    const prisma = buildPrisma({ id: 'model-1', version: 'v1' });
    const calibrated = buildCalibrated(highConfidence);

    const service = new RecommendationService(
      prisma as unknown as PrismaService,
      repo as unknown as FeatureSnapshotRepository,
      calibrated as unknown as CalibratedAnalyticsProvider,
      buildWorkRuntime() as unknown as IWorkRuntime,
    );
    const recs: Recommendation[] = await service.recommend(baseInput);

    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(3);
    for (const r of recs) {
      expect(r.tenantId).toBe('tenant-A');
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.reasoning.length).toBeGreaterThan(0);
      expect(r.supportingEvidence.length).toBeGreaterThan(0);
      expect(r.supportingEvidence[0].tenantId).toBe('tenant-A');
      expect(r.expiresAt).toMatch(/T/);
      expect(r.policyRequirements).toContain('tenant.context.snapshot');
      expect(r.rankedAction?.effect).toBe('INTERNAL_WRITE');
    }
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].confidence).toBeGreaterThanOrEqual(recs[i].confidence);
    }
  });

  it('returns [] when there are no snapshots for the subject', async () => {
    const repo = buildSnapshotRepo([]);
    const prisma = buildPrisma({ id: 'model-1', version: 'v1' });
    const calibrated = buildCalibrated(highConfidence);

    const service = new RecommendationService(
      prisma as unknown as PrismaService,
      repo as unknown as FeatureSnapshotRepository,
      calibrated as unknown as CalibratedAnalyticsProvider,
      buildWorkRuntime() as unknown as IWorkRuntime,
    );
    const recs = await service.recommend(baseInput);

    expect(recs).toEqual([]);
    expect(calibrated.score).not.toHaveBeenCalled();
  });

  it('returns [] when no analytics model is registered', async () => {
    const now = new Date();
    const repo = buildSnapshotRepo([freshSnapshot('snap-1', 'tenant-A', now)]);
    const prisma = buildPrisma(null);
    const calibrated = buildCalibrated(highConfidence);

    const service = new RecommendationService(
      prisma as unknown as PrismaService,
      repo as unknown as FeatureSnapshotRepository,
      calibrated as unknown as CalibratedAnalyticsProvider,
      buildWorkRuntime() as unknown as IWorkRuntime,
    );
    const recs = await service.recommend(baseInput);

    expect(recs).toEqual([]);
  });

  it('selectAndStart calls WorkRuntime.createRun with the right tenantId', async () => {
    const now = new Date();
    const repo = buildSnapshotRepo([freshSnapshot('snap-1', 'tenant-A', now)]);
    const prisma = buildPrisma({ id: 'model-1', version: 'v1' });
    const calibrated = buildCalibrated(highConfidence);
    const fakeRun: WorkRunView = {
      id: 'run-1',
      tenantId: 'tenant-A',
      actorId: 'actor-1',
      actorType: 'HUMAN',
      status: 'CREATED',
      request: '',
      currentStepIndex: 0,
      planVersion: 0,
      summary: null,
      failureCode: null,
      failureReason: null,
      createdAt: new Date().toISOString(),
    };
    const wr = buildWorkRuntime(fakeRun);

    const service = new RecommendationService(
      prisma as unknown as PrismaService,
      repo as unknown as FeatureSnapshotRepository,
      calibrated as unknown as CalibratedAnalyticsProvider,
      wr as unknown as IWorkRuntime,
    );
    const recs = await service.recommend(baseInput);
    expect(recs.length).toBeGreaterThan(0);

    const started = await service.selectAndStart(recs[0], 'actor-1');
    expect(started.id).toBe('run-1');
    expect(wr.createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-A',
        actorId: 'actor-1',
        actorType: 'HUMAN',
      }),
    );
  });
});
