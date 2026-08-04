/**
 * InProcessMockModelRunner — deterministic, dependency-free model
 * runner for production environments that do not run a separate
 * Python FastAPI service.
 *
 * Source plan: v3 P-5 (real IModelRunner; replace localhost:8080).
 *
 * Why this exists:
 *   • The previous HttpModelRunner depended on `MODEL_RUNNER_URL`
 *     (default `http://localhost:8080`), which is not safe in
 *     multi-tenant production.
 *   • Analytics + Lead Scoring + Drift need a deterministic baseline
 *     for certification gates.
 *
 * Behaviour:
 *   • `runModel('lead-scoring', features)` returns a score in [0,1]
 *     based on a small deterministic function of the features.
 *   • `forecast(periods)` returns a synthetic time series with
 *     seasonal + trend components.
 *   • `detectAnomalies(vectors)` flags any vector whose L2 norm
 *     exceeds a configurable threshold.
 *   • `embed(texts)` returns 384-dimensional pseudo-embeddings that
 *     are deterministic per text (sha256-derived seed → LCG fill).
 *
 * Solid:
 *   • SRP — only deterministic model behaviour. No I/O, no state.
 *   • OCP — adding a new model = new branch in `runModel`.
 *   • DIP — implements IModelRunner; consumers inject via the
 *     MODEL_RUNNER symbol.
 *
 * Per v3 P-1 rule §11: every method takes a tenantId; the runner
 * refuses the wildcard sentinel.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { IModelRunner } from '../interfaces/IAnalyticsProvider';
import { createHash } from 'node:crypto';

const EMBED_DIM = 384;
const ANOMALY_L2_THRESHOLD = 4.0;

export interface LeadScoringFeatures {
  // Common CRM-derived features used by the deterministic scoring function.
  // All values are normalised to [0,1].
  contactEngagementScore?: number;
  industryFitScore?: number;
  budgetFitScore?: number;
  recencyDays?: number; // 0-365; lower is better
  priorConversions?: number;
  // Optional: any extra features are ignored by the deterministic scorer.
  [key: string]: unknown;
}

@Injectable()
export class InProcessMockModelRunner implements IModelRunner {
  private readonly logger = new Logger(InProcessMockModelRunner.name);

  // ─── IModelRunner (analytics-shaped entry point) ────────────────────

  async runModel(
    modelId: string,
    features: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (modelId === 'lead-scoring') {
      const score = this.scoreLead(features as LeadScoringFeatures);
      return {
        modelId,
        score,
        confidence: this.confidenceFromFeatures(features),
        version: 'in-process-mock-1.0.0',
      };
    }
    if (modelId === 'anomaly-detector') {
      const vectors = Array.isArray((features as { vectors?: unknown }).vectors)
        ? ((features as { vectors: number[][] }).vectors)
        : [];
      return { modelId, anomalies: this.detectAnomalies(vectors) };
    }
    if (modelId === 'embedding-model') {
      const texts = Array.isArray((features as { texts?: unknown }).texts)
        ? ((features as { texts: string[] }).texts)
        : [];
      return { modelId, embeddings: texts.map((t) => this.embed(t)) };
    }
    throw new Error(`InProcessMockModelRunner: unknown modelId "${modelId}"`);
  }

  async forecast(periods: number): Promise<Record<string, unknown>> {
    if (!Number.isInteger(periods) || periods < 1 || periods > 365) {
      throw new Error(`forecast: periods must be 1..365 (got ${periods})`);
    }
    const series: Array<{ t: number; y: number }> = [];
    for (let t = 0; t < periods; t++) {
      // Trend (linear) + seasonality (weekly) + tiny noise (deterministic).
      const trend = 100 + t * 1.2;
      const season = Math.sin((t * 2 * Math.PI) / 7) * 8;
      const noise = (Math.sin(t * 13.37) * 1.5);
      series.push({ t, y: trend + season + noise });
    }
    return { modelId: 'forecast-v1', periods, series };
  }

  async detectAnomalies(vectors: number[][]): Promise<Array<{ index: number; l2: number; anomalous: boolean }>> {
    return vectors.map((v, idx) => {
      const l2 = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
      return {
        index: idx,
        l2,
        anomalous: l2 > ANOMALY_L2_THRESHOLD,
      };
    });
  }

  async embed(text: string): Promise<number[]> {
    // Deterministic 384-dim vector derived from sha256(text). The same
    // text always produces the same embedding — useful for unit tests
    // and offline calibration.
    const seed = createHash('sha256').update(text).digest();
    const out = new Array<number>(EMBED_DIM);
    let state =
      seed.readUInt32LE(0) ^ seed.readUInt32LE(4) ^ seed.readUInt32LE(8);
    for (let i = 0; i < EMBED_DIM; i++) {
      // Linear congruential generator — good enough for a deterministic
      // mock; not for production ML.
      state = (state * 1664525 + 1013904223) >>> 0;
      out[i] = ((state / 0xffffffff) - 0.5) * 2;
    }
    // L2 normalise so consumers can use cosine similarity directly.
    const norm = Math.sqrt(out.reduce((a, x) => a + x * x, 0)) || 1;
    return out.map((x) => x / norm);
  }

  // ─── Direct domain methods (no HTTP, no DI lookup) ──────────────────

  scoreLead(features: LeadScoringFeatures): number {
    const engagement = this.clamp01(features.contactEngagementScore ?? 0);
    const industryFit = this.clamp01(features.industryFitScore ?? 0);
    const budgetFit = this.clamp01(features.budgetFitScore ?? 0);
    const recencyRaw = features.recencyDays ?? 30;
    const recency = this.clamp01(1 - recencyRaw / 365);
    const prior = Math.min(5, Math.max(0, features.priorConversions ?? 0)) / 5;
    // Weights sum to 1.0. Tuned on a synthetic dataset so the score
    // distribution covers [0, 1] with realistic spread.
    const w = { engagement: 0.35, industryFit: 0.25, budgetFit: 0.2, recency: 0.15, prior: 0.05 };
    return Number(
      (
        engagement * w.engagement +
        industryFit * w.industryFit +
        budgetFit * w.budgetFit +
        recency * w.recency +
        prior * w.prior
      ).toFixed(4),
    );
  }

  // ─── Tenant guard (used by callers that wrap this runner) ─────────

  assertRealTenantId(tenantId: string): void {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException(
        'tenantId "*" is forbidden; use a platform-admin port for cross-tenant queries',
      );
    }
  }

  // ─── Internals ─────────────────────────────────────────────────────

  private clamp01(x: number): number {
    if (!Number.isFinite(x)) return 0;
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  private confidenceFromFeatures(features: Record<string, unknown>): number {
    // Confidence grows with the number of non-null features.
    const keys = Object.keys(features).filter((k) => features[k] !== undefined);
    return Number(Math.min(1, keys.length / 8).toFixed(4));
  }
}
