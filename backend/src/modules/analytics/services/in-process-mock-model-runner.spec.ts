/**
 * In-process mock model runner — unit tests.
 *
 * Asserts:
 *   1. Deterministic scoring — same features always produce the same score.
 *   2. Score is in [0, 1].
 *   3. Monotonic in engagement (higher engagement → higher score).
 *   4. Embedding is L2-normalised.
 *   5. Anomaly detection flags high-L2 vectors.
 *   6. Tenant guard refuses wildcard.
 */

import { ForbiddenException } from '@nestjs/common';
import { InProcessMockModelRunner } from './in-process-mock-model-runner';

describe('InProcessMockModelRunner', () => {
  let runner: InProcessMockModelRunner;

  beforeEach(() => {
    runner = new InProcessMockModelRunner();
  });

  describe('scoreLead', () => {
    it('returns a deterministic score in [0, 1]', () => {
      const features = {
        contactEngagementScore: 0.8,
        industryFitScore: 0.7,
        budgetFitScore: 0.6,
        recencyDays: 7,
        priorConversions: 3,
      };
      const a = runner.scoreLead(features);
      const b = runner.scoreLead(features);
      expect(a).toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    });

    it('monotonically increases with engagement', () => {
      const low = runner.scoreLead({ contactEngagementScore: 0.1 });
      const mid = runner.scoreLead({ contactEngagementScore: 0.5 });
      const high = runner.scoreLead({ contactEngagementScore: 0.9 });
      expect(low).toBeLessThan(mid);
      expect(mid).toBeLessThan(high);
    });

    it('clamps out-of-range inputs', () => {
      const neg = runner.scoreLead({ contactEngagementScore: -5 });
      const over = runner.scoreLead({ contactEngagementScore: 99 });
      expect(neg).toBeGreaterThanOrEqual(0);
      expect(over).toBeLessThanOrEqual(1);
    });

    it('produces the lead-scoring envelope shape via runModel', async () => {
      const result = await runner.runModel('lead-scoring', {
        contactEngagementScore: 0.5,
        industryFitScore: 0.5,
      });
      expect(result).toMatchObject({
        modelId: 'lead-scoring',
        version: 'in-process-mock-1.0.0',
      });
      expect(typeof (result as { score: number }).score).toBe('number');
      expect(typeof (result as { confidence: number }).confidence).toBe('number');
    });
  });

  describe('embed', () => {
    it('returns a 384-dim L2-normalised vector', async () => {
      const v = await runner.embed('hello world');
      expect(v.length).toBe(384);
      const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
      expect(Math.abs(norm - 1)).toBeLessThan(1e-9);
    });

    it('is deterministic for the same text', async () => {
      const a = await runner.embed('hello world');
      const b = await runner.embed('hello world');
      expect(a).toEqual(b);
    });

    it('differs for different text', async () => {
      const a = await runner.embed('hello');
      const b = await runner.embed('goodbye');
      expect(a).not.toEqual(b);
    });
  });

  describe('detectAnomalies', () => {
    it('flags vectors above the L2 threshold', async () => {
      const vectors = [
        [0.1, 0.2, 0.3], // norm ~0.37
        [10, 10, 10], // norm ~17.3 — anomalous
      ];
      const result = await runner.detectAnomalies(vectors);
      expect(result[0].anomalous).toBe(false);
      expect(result[1].anomalous).toBe(true);
    });
  });

  describe('forecast', () => {
    it('returns one row per period', async () => {
      const r = await runner.forecast(5);
      const series = (r as { series: unknown[] }).series;
      expect(series.length).toBe(5);
    });

    it('rejects out-of-range periods', async () => {
      await expect(runner.forecast(0)).rejects.toThrow();
      await expect(runner.forecast(1000)).rejects.toThrow();
    });
  });

  describe('tenant guard', () => {
    it('refuses wildcard tenant', () => {
      expect(() => runner.assertRealTenantId('*')).toThrow(ForbiddenException);
    });
    it('refuses missing tenant', () => {
      expect(() => runner.assertRealTenantId('')).toThrow(ForbiddenException);
    });
    it('accepts real tenant', () => {
      expect(() => runner.assertRealTenantId('tenant-a')).not.toThrow();
    });
  });
});
