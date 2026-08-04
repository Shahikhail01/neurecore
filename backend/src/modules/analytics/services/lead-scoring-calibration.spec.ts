/**
 * Lead Scoring Calibration — certification gate tests.
 *
 * Asserts:
 *   1. Report is generated with the expected shape.
 *   2. Bucket counts sum to dataset size.
 *   3. Monotonicity score is non-negative.
 *   4. Mean is in [0, 1].
 *   5. Two consecutive runs produce identical reports (deterministic).
 */

import { InProcessMockModelRunner } from './in-process-mock-model-runner';
import { LeadScoringCalibration } from './lead-scoring-calibration';

describe('LeadScoringCalibration', () => {
  let calibration: LeadScoringCalibration;

  beforeEach(() => {
    calibration = new LeadScoringCalibration(new InProcessMockModelRunner());
  });

  it('produces a calibration report with valid statistics', () => {
    const report = calibration.certify();
    expect(report.modelId).toBe('lead-scoring');
    expect(report.datasetSize).toBe(200);
    expect(report.mean).toBeGreaterThanOrEqual(0);
    expect(report.mean).toBeLessThanOrEqual(1);
    expect(report.stdDev).toBeGreaterThanOrEqual(0);
    expect(report.min).toBeGreaterThanOrEqual(0);
    expect(report.max).toBeLessThanOrEqual(1);
    expect(report.median).toBeGreaterThanOrEqual(0);
    expect(report.monotonicityScore).toBeGreaterThan(0);
    expect(
      report.bucketCounts.LOW +
        report.bucketCounts.MEDIUM +
        report.bucketCounts.HIGH,
    ).toBe(200);
    expect(report.generatedAt).toMatch(/T/);
  });

  it('is deterministic across two runs', () => {
    const a = calibration.certify();
    const b = calibration.certify();
    expect(a.mean).toBe(b.mean);
    expect(a.median).toBe(b.median);
    expect(a.stdDev).toBe(b.stdDev);
    expect(a.bucketCounts).toEqual(b.bucketCounts);
    expect(a.monotonicityScore).toBe(b.monotonicityScore);
  });

  it('covers all three buckets for the synthetic dataset', () => {
    const report = calibration.certify();
    // The synthetic dataset spans the full [0, 1] range, so all three
    // buckets should be populated.
    expect(report.bucketCounts.LOW).toBeGreaterThan(0);
    expect(report.bucketCounts.MEDIUM).toBeGreaterThan(0);
    expect(report.bucketCounts.HIGH).toBeGreaterThan(0);
  });
});
