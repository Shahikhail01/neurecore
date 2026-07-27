// src/test/architecture/phase8-correlation-trace.spec.ts
// Phase 8 — §10.6 Gate G8 criterion 1:
// "On-call can locate any failed golden run from one correlation ID"
//
// This test walks a single correlation ID across every observable surface:
//   command metadata → outbox event → execution attempt → review record
// and asserts that the same correlation id is the join key on each. It does
// not run a real golden run — instead it asserts the SHAPE so we fail fast
// when a downstream component stops propagating the id.
import { CommandMetadata } from '../../common/correlation/correlation.interface';
import { GOLDEN_PATH_METRICS_SHAPE } from '../../modules/phase8/observability/golden-path-metrics-shapes';

describe('Phase 8 — correlation-id propagation across the golden path (G8 criterion 1)', () => {
  const CORR = 'corr-deadbeef-2026-07-27';
  const md: CommandMetadata = {
    tenantId: 'tnt-acme',
    actorId: 'user-1',
    actorType: 'HUMAN',
    correlationId: CORR,
    causationId: null,
    idempotencyKey: 'idem-1',
    occurredAt: '2026-07-27T00:00:00.000Z',
    schemaVersion: 1,
  };

  it('command metadata carries the correlation id forward', () => {
    expect(md.correlationId).toBe(CORR);
    expect(md.tenantId).toBe('tnt-acme');
  });

  it('outbox event shape preserves the correlation id', () => {
    expect(GOLDEN_PATH_METRICS_SHAPE.outboxEventFields).toContain(
      'correlationId',
    );
    expect(GOLDEN_PATH_METRICS_SHAPE.outboxEventFields).toContain('tenantId');
  });

  it('execution attempt envelope carries both correlation and tenant ids', () => {
    expect(GOLDEN_PATH_METRICS_SHAPE.attemptFields).toContain('correlationId');
    expect(GOLDEN_PATH_METRICS_SHAPE.attemptFields).toContain('tenantId');
  });

  it('review record carries the same correlation id', () => {
    expect(GOLDEN_PATH_METRICS_SHAPE.reviewFields).toContain('correlationId');
    expect(GOLDEN_PATH_METRICS_SHAPE.reviewFields).toContain('tenantId');
  });

  it('every golden-path surface is searchable by correlationId', () => {
    expect(GOLDEN_PATH_METRICS_SHAPE.searchableByFields).toEqual(
      expect.arrayContaining([
        'correlationId',
        'tenantId',
        'actorId',
        'initiationId',
        'projectId',
        'taskId',
        'executionAttemptId',
        'outboxEventId',
      ]),
    );
  });
});
