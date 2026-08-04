/**
 * Lead Scoring — Certification Gate + Calibration Report.
 *
 * Source plan: v3 P-5 (real model runner + calibration + drift).
 *
 * This module produces a one-shot certification report for the Lead
 * Scoring model by running a synthetic dataset through the in-process
 * runner and computing distribution statistics.
 *
 * Solid:
 *   • SRP — only certification + calibration reporting.
 *   • OCP — adding a new model = new branch in `certify`.
 *
 * Tenant guard: certification runs only against the platform baseline
 * (no tenantId is accepted); per-tenant calibration lives in the
 * tenant-isolated calibration endpoint.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InProcessMockModelRunner } from './in-process-mock-model-runner';

export interface CalibrationRow {
  features: Record<string, number>;
  score: number;
  bucket: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface CalibrationReport {
  modelId: 'lead-scoring';
  runnerVersion: string;
  datasetSize: number;
  bucketCounts: { LOW: number; MEDIUM: number; HIGH: number };
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  median: number;
  monotonicityScore: number; // 0..1, higher = better
  generatedAt: string;
}

const SYNTHETIC_DATASET_SIZE = 200;

@Injectable()
export class LeadScoringCalibration {
  private readonly logger = new Logger(LeadScoringCalibration.name);

  constructor(private readonly runner: InProcessMockModelRunner) {}

  /**
   * Generate a synthetic dataset of features that mimics a realistic
   * lead distribution (skewed toward medium-engagement leads) and run
   * it through the in-process runner. Produces a calibration report.
   *
   * The synthetic dataset is deterministic — the same inputs always
   * produce the same scores, so the report is comparable across runs.
   */
  certify(): CalibrationReport {
    const rows: CalibrationRow[] = [];
    for (let i = 0; i < SYNTHETIC_DATASET_SIZE; i++) {
      const features = this.synthesizeFeatures(i);
      const score = this.runner.scoreLead(features);
      rows.push({ features, score, bucket: this.bucketize(score) });
    }

    const scores = rows.map((r) => r.score);
    const mean = this.mean(scores);
    const stdDev = this.stdDev(scores, mean);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const sorted = [...scores].sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

    const bucketCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    for (const r of rows) bucketCounts[r.bucket]++;

    // Monotonicity: do scores rise as engagement rises? Compare the score
    // ordering with the engagement-feature ordering.
    const orderedByEngagement = [...rows].sort(
      (a, b) =>
        b.features.contactEngagementScore -
        a.features.contactEngagementScore,
    );
    const scoreRanks = orderedByEngagement.map((r) => r.score);
    const monotonic = this.spearmanMonotonicity(scoreRanks);

    const report: CalibrationReport = {
      modelId: 'lead-scoring',
      runnerVersion: 'in-process-mock-1.0.0',
      datasetSize: SYNTHETIC_DATASET_SIZE,
      bucketCounts,
      mean: Number(mean.toFixed(4)),
      stdDev: Number(stdDev.toFixed(4)),
      min: Number(min.toFixed(4)),
      max: Number(max.toFixed(4)),
      median: Number(median.toFixed(4)),
      monotonicityScore: Number(monotonic.toFixed(4)),
      generatedAt: new Date().toISOString(),
    };
    this.logger.log(
      `calibration: mean=${report.mean} stdDev=${report.stdDev} ` +
        `monotonicity=${report.monotonicityScore} buckets=${JSON.stringify(report.bucketCounts)}`,
    );
    return report;
  }

  // ─── Internals ─────────────────────────────────────────────────────

  private synthesizeFeatures(seed: number) {
    // Deterministic pseudo-random per row. Same `seed` always yields the
    // same feature set — keeps calibration runs comparable.
    const rng = (n: number) => {
      const x = Math.sin(seed * 9301 + n * 49297) * 233280;
      return x - Math.floor(x);
    };
    return {
      contactEngagementScore: rng(1),
      industryFitScore: rng(2),
      budgetFitScore: rng(3),
      recencyDays: Math.floor(rng(4) * 365),
      priorConversions: Math.floor(rng(5) * 6),
    };
  }

  private bucketize(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (score < 0.33) return 'LOW';
    if (score < 0.66) return 'MEDIUM';
    return 'HIGH';
  }

  private mean(xs: number[]): number {
    return xs.reduce((a, x) => a + x, 0) / xs.length;
  }

  private stdDev(xs: number[], mu: number): number {
    const v = xs.reduce((a, x) => a + (x - mu) * (x - mu), 0) / xs.length;
    return Math.sqrt(v);
  }

  private spearmanMonotonicity(scoresInOrder: number[]): number {
    // Simple Spearman: rank-correlation between order position and value.
    const n = scoresInOrder.length;
    if (n < 2) return 1;
    // Ranks (1..n); ties broken by averaging.
    const sorted = scoresInOrder
      .map((v, i) => ({ v, i }))
      .sort((a, b) => a.v - b.v);
    const ranks = new Array<number>(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && sorted[j + 1].v === sorted[i].v) j++;
      const avgRank = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) ranks[sorted[k].i] = avgRank;
      i = j + 1;
    }
    // For "perfectly monotone decreasing sequence", rank[i] should
    // equal n - i + 1. Compute correlation.
    let sumDiff2 = 0;
    let sumIdx2 = 0;
    for (let idx = 0; idx < n; idx++) {
      const expectedRank = n - idx;
      const d = ranks[idx] - expectedRank;
      sumDiff2 += d * d;
      sumIdx2 += (idx + 1) * (idx + 1);
    }
    const denom = Math.sqrt(sumDiff2 * sumIdx2);
    if (denom === 0) return 1;
    return 1 - (6 * sumDiff2) / (n * (n * n - 1));
  }
}
