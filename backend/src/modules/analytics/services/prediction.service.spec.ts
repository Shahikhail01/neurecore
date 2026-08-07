/**
 * Phase 19 — PredictionService spec (CR-AI-1002).
 *
 * Validates: abstention envelopes + deterministic rule baseline + tenant
 * scope. The LLM-backed path is Phase 21 — this spec covers the
 * deterministic contract.
 */

import { PredictionService, PREDICTION_QUALITY } from './prediction.service';
import { PredictionTenantScopeError } from './prediction.service';

function makeStub(opts: {
  modelFound?: boolean;
  snapshotCount?: number;
  snapshotAgeHours?: number;
  scoreConfidence?: number;
}) {
  const snapshotCount = opts.snapshotCount ?? PREDICTION_QUALITY.MIN_EVIDENCE_COUNT + 1;
  const ageHours = opts.snapshotAgeHours ?? 1;
  const recent = Array.from({ length: snapshotCount }, (_, i) => ({
    id: `s-${i}`,
    tenantId: 'tenant-A',
    subjectType: 'lead',
    subjectId: 'l-1',
    modelId: 'm-1',
    modelVersion: '1.0.0',
    features: { requested_demo: 1 },
    featuresJson: { requested_demo: 1 },
    recordedAt: new Date(Date.now() - ageHours * 3600 * 1000),
    createdAt: new Date(Date.now() - ageHours * 3600 * 1000),
  }));
  const model = opts.modelFound === false
    ? null
    : {
        id: 'm-1',
        kind: 'lead',
        version: '1.0.0',
        weights: { requested_demo: 0.4, lead_source_referral: 0.3 },
        metadata: {
          lifecycle: {
            stages: [
              { stage: 'gated-production', status: 'COMPLETE' },
              { stage: 'monitoring', status: 'IN_PROGRESS' },
            ],
          },
        },
        tenantId: 'tenant-A',
      };
  return {
    prisma: {
      featureSnapshot: {
        count: async () => snapshotCount,
        findFirst: async () => ({
          createdAt: new Date(Date.now() - ageHours * 3600 * 1000),
        }),
      },
      analyticsModel: {
        findFirst: async () => model,
      },
      analyticsModelVersion: {
        create: async () => undefined,
      },
    },
    snapshots: {
      listRecent: async () => recent,
      getLatest: async () => recent[0] ?? null,
    },
    calibrated: {
      score: async () => ({
        score: 0.5,
        value: 0.5,
        confidence: opts.scoreConfidence ?? PREDICTION_QUALITY.MIN_CONFIDENCE,
        factors: [],
        limitations: [],
        basis: ['heuristic'],
        source: 'heuristic',
      }),
    },
  };
}

describe('Phase 19 — PredictionService (CR-AI-1002)', () => {
  it('refuses wildcard tenantId', async () => {
    const stub = makeStub({});
    const svc = new PredictionService(stub.prisma as never, stub.snapshots as never, stub.calibrated as never);
    await expect(
      svc.predict({
        tenantId: '*',
        modelId: 'm-1',
        modelVersion: '1.0.0',
        subject: { type: 'lead', id: 'l-1' },
        features: { requested_demo: 1 },
        predictionType: 'lead_score',
      }),
    ).rejects.toThrow(PredictionTenantScopeError);
  });

  it('abstains when the model does not exist', async () => {
    const stub = makeStub({ modelFound: false });
    const svc = new PredictionService(stub.prisma as never, stub.snapshots as never, stub.calibrated as never);
    const out = await svc.predict({
      tenantId: 't',
      modelId: 'm-1',
      modelVersion: '1.0.0',
      subject: { type: 'lead', id: 'l-1' },
      features: { requested_demo: 1 },
      predictionType: 'lead_score',
    });
    expect(out.confidence).toBe(0);
    expect(out.model.id).toBe('abstain');
    expect(out.explanation.some((e) => e.includes('abstain'))).toBe(true);
  });

  it('abstains when evidence count is below the minimum', async () => {
    const stub = makeStub({ snapshotCount: 1 });
    const svc = new PredictionService(stub.prisma as never, stub.snapshots as never, stub.calibrated as never);
    const out = await svc.predict({
      tenantId: 't',
      modelId: 'm-1',
      modelVersion: '1.0.0',
      subject: { type: 'lead', id: 'l-1' },
      features: { requested_demo: 1 },
      predictionType: 'lead_score',
    });
    expect(out.confidence).toBe(0);
    expect(out.model.id).toBe('abstain');
    expect(out.explanation.some((e) => e.includes('no feature snapshot') || e.includes('insufficient'))).toBe(true);
  });

  it('abstains when the snapshot is stale', async () => {
    const stub = makeStub({ snapshotAgeHours: 100 });
    const svc = new PredictionService(stub.prisma as never, stub.snapshots as never, stub.calibrated as never);
    const out = await svc.predict({
      tenantId: 't',
      modelId: 'm-1',
      modelVersion: '1.0.0',
      subject: { type: 'lead', id: 'l-1' },
      features: { requested_demo: 1 },
      predictionType: 'lead_score',
    });
    expect(out.confidence).toBe(0);
    expect(out.model.id).toBe('abstain');
    expect(out.explanation.some((e) => e.includes('stale'))).toBe(true);
  });

  it('predicts when the surface is healthy', async () => {
    const stub = makeStub({ scoreConfidence: PREDICTION_QUALITY.MIN_CONFIDENCE + 0.1 });
    const svc = new PredictionService(stub.prisma as never, stub.snapshots as never, stub.calibrated as never);
    const out = await svc.predict({
      tenantId: 't',
      modelId: 'm-1',
      modelVersion: '1.0.0',
      subject: { type: 'lead', id: 'l-1' },
      features: { requested_demo: 1, lead_source_referral: 1 },
      predictionType: 'lead_score',
    });
    expect(out.confidence).toBeGreaterThan(0);
    expect(out.model.id).toBe('m-1');
    expect(out.value).toBe(0.5);
  });
});
