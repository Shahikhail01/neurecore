import { GoldenPathMetricsService } from './golden-path-metrics.service';
import { Registry } from 'prom-client';

describe('GoldenPathMetricsService (Phase 8 — §10.2 metrics catalog)', () => {
  it('builds the full golden-path catalog on init()', () => {
    const metricsService = { registry: new Registry() };
    const svc = new GoldenPathMetricsService(
      metricsService as unknown as ConstructorParameters<
        typeof GoldenPathMetricsService
      >[0],
    );
    svc.onModuleInit();
    const m = svc.metrics_;
    // Spot-check every group in the catalog so a missing entry fails fast.
    expect(m.initiationsCreated).toBeDefined();
    expect(m.initiationsApproved).toBeDefined();
    expect(m.initiationsFailed).toBeDefined();
    expect(m.projectCommandSuccess).toBeDefined();
    expect(m.projectCommandDuplicateSuppressed).toBeDefined();
    expect(m.outboxEventAgeSeconds).toBeDefined();
    expect(m.outboxBacklogSize).toBeDefined();
    expect(m.eventProcessingLatencySeconds).toBeDefined();
    expect(m.jobRetries).toBeDefined();
    expect(m.jobDeadLetters).toBeDefined();
    expect(m.automationCompletionRate).toBeDefined();
    expect(m.assignmentSuccess).toBeDefined();
    expect(m.assignmentFailure).toBeDefined();
    expect(m.executionQueueTimeSeconds).toBeDefined();
    expect(m.executionDurationSeconds).toBeDefined();
    expect(m.attemptSuccess).toBeDefined();
    expect(m.attemptRetry).toBeDefined();
    expect(m.attemptFailure).toBeDefined();
    expect(m.needsInput).toBeDefined();
    expect(m.needsReview).toBeDefined();
    expect(m.approval).toBeDefined();
    expect(m.revisionRequested).toBeDefined();
    expect(m.toolFailure).toBeDefined();
    expect(m.tokenUsage).toBeDefined();
    expect(m.estimatedCost).toBeDefined();
    expect(m.socketReconnect).toBeDefined();
    expect(m.socketError).toBeDefined();
    expect(m.sessionRefreshFailure).toBeDefined();
  });

  it('exposes the Prometheus text format via toExpositionFormat()', async () => {
    const registry = new Registry();
    const metricsService = {
      registry,
      toExpositionFormat: async () => registry.metrics(),
    };
    const svc = new GoldenPathMetricsService(
      metricsService as unknown as ConstructorParameters<
        typeof GoldenPathMetricsService
      >[0],
    );
    svc.onModuleInit();
    const m = svc.metrics_;
    m.attemptSuccess.inc({ result: 'success' });
    m.attemptSuccess.inc({ result: 'success' });
    m.attemptFailure.inc({ classification: 'TRANSIENT_INFRASTRUCTURE' });

    const out = await svc.toExpositionFormat();
    expect(out).toContain('attempt_success_total');
    expect(out).toContain('attempt_failure_total');
    expect(out).toContain('result="success"');
    expect(out).toContain('classification="TRANSIENT_INFRASTRUCTURE"');
  });

  it('returns an empty string when the metrics service is absent', async () => {
    const svc = new GoldenPathMetricsService();
    const out = await svc.toExpositionFormat();
    expect(out).toBe('');
  });
});
