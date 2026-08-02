/**
 * model-health.spec.ts — ModelHealthService unit coverage (P8 CR-AI-1204).
 *
 * Asserts the pure helper that buckets ExecutionAttempt rows into
 * per-model latency / error-rate / grade aggregates.
 */

import {
  computeModelHealthBuckets,
  grade,
  percentile,
} from '../model-health.service';

describe('ModelHealthService helpers (P8 CR-AI-1204)', () => {
  it('percentile returns null for empty array', () => {
    expect(percentile([], 0.95)).toBeNull();
  });

  it('percentile computes p95 correctly', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(arr, 0.95)).toBe(10);
  });

  it('grade returns UNKNOWN when no attempts', () => {
    expect(grade(0, 0)).toBe('UNKNOWN');
  });

  it('grade thresholds: healthy / degraded / unhealthy', () => {
    expect(grade(0.05, 100)).toBe('HEALTHY');
    expect(grade(0.1, 100)).toBe('DEGRADED');
    expect(grade(0.25, 100)).toBe('UNHEALTHY');
    expect(grade(0.9, 100)).toBe('UNHEALTHY');
  });

  it('buckets attempts per model and computes error rate', () => {
    const out = computeModelHealthBuckets([
      {
        modelVersion: 'gpt-4o',
        startedAt: new Date(0),
        endedAt: new Date(100),
        status: 'SUCCEEDED',
      },
      {
        modelVersion: 'gpt-4o',
        startedAt: new Date(0),
        endedAt: new Date(200),
        status: 'FAILED',
      },
      {
        modelVersion: 'claude-3',
        startedAt: new Date(0),
        endedAt: new Date(50),
        status: 'SUCCEEDED',
      },
    ]);
    expect(out.totalAttempts).toBe(3);
    expect(out.totalFailed).toBe(1);
    const gpt = out.models.find((m) => m.model === 'gpt-4o');
    expect(gpt?.attempts).toBe(2);
    expect(gpt?.failed).toBe(1);
    expect(gpt?.errorRate).toBeCloseTo(0.5);
    expect(gpt?.grade).toBe('UNHEALTHY');
  });

  it('treats missing timing as no-latency (avg/p95 null)', () => {
    const out = computeModelHealthBuckets([
      {
        modelVersion: 'm',
        startedAt: null,
        endedAt: null,
        status: 'SUCCEEDED',
      },
    ]);
    const m = out.models[0];
    expect(m.avgDurationMs).toBeNull();
    expect(m.p95DurationMs).toBeNull();
    expect(m.grade).toBe('HEALTHY');
  });
});
