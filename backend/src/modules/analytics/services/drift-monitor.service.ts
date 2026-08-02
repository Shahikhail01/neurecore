/**
 * DriftMonitorService — Phase 5 P5
 *
 * Scheduled (manual + cron-friendly) drift check that emits a
 * `model-health event` for the Command Center to consume.
 *
 * Two detectors run side-by-side:
 *   - Population stability index (PSI) over the latest feature
 *     snapshots vs the platform baseline.
 *   - Score distribution shift comparing the most recent prediction
 *     snapshots to the baseline distribution.
 *
 * Drift is reported per model and per (tenant, subjectType) bucket.
 * No drift threshold means "no signal"; a clear `severity` band
 * (low / medium / high) drives the model-health event.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export type DriftSeverity = 'low' | 'medium' | 'high' | 'insufficient-data';

export interface DriftReport {
  readonly modelId: string;
  readonly modelName: string;
  readonly tenantId: string;
  readonly featurePsi: ReadonlyArray<{
    name: string;
    psi: number;
    severity: DriftSeverity;
  }>;
  readonly scoreShift: number;
  readonly severity: DriftSeverity;
  readonly samples: number;
  readonly checkedAt: string;
}

const PSI_LOW = 0.1;
const PSI_MEDIUM = 0.2;
const SHIFT_LOW = 0.05;
const SHIFT_MEDIUM = 0.1;
const MIN_SAMPLES = 5;

@Injectable()
export class DriftMonitorService {
  private readonly logger = new Logger(DriftMonitorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run a drift check over the most-recent snapshots (per modelId).
   * Persists a JSON `metadata.drift[]` row on the AnalyticsModel and
   * returns a typed report for the dashboard.
   */
  async checkModel(modelId: string, tenantId: string): Promise<DriftReport> {
    const snapshots = await this.prisma.featureSnapshot.findMany({
      where: { tenantId, modelId },
      orderBy: { recordedAt: 'desc' },
      take: 30,
    });
    if (snapshots.length < MIN_SAMPLES) {
      return {
        modelId,
        modelName: modelId,
        tenantId,
        featurePsi: [],
        scoreShift: 0,
        severity: 'insufficient-data',
        samples: snapshots.length,
        checkedAt: new Date().toISOString(),
      };
    }
    const featureKeys = this.collectKeys(snapshots);
    const baselineFeatures = this.partition(
      snapshots,
      Math.floor(snapshots.length / 2),
    );
    const currentFeatures = this.partition(snapshots, 0);

    const featurePsi = featureKeys.map((name) => ({
      name,
      psi: round(this.psi(baselineFeatures, currentFeatures, name), 4),
      severity: this.severityFor(
        this.psi(baselineFeatures, currentFeatures, name),
        PSI_LOW,
        PSI_MEDIUM,
      ),
    }));
    const scoreShift = round(
      this.scoreShift(baselineFeatures, currentFeatures),
      4,
    );
    const severity = this.combinedSeverity(featurePsi, scoreShift);

    const model = await this.prisma.analyticsModel.findFirst({
      where: { id: modelId, OR: [{ tenantId }, { tenantId: null }] },
    });
    if (model) {
      const existing = ((model.metadata ?? {}) as { driftReports?: unknown })
        .driftReports;
      const prior: unknown[] = Array.isArray(existing)
        ? (existing as unknown[])
        : [];
      const next: unknown[] = [
        {
          checkedAt: new Date().toISOString(),
          featurePsi,
          scoreShift,
          severity,
        },
        ...prior,
      ].slice(0, 30);
      await this.prisma.analyticsModel.update({
        where: { id: model.id },
        data: {
          metadata: {
            ...((model.metadata ?? {}) as Record<string, unknown>),
            driftReports: next,
          } as never,
        },
      });
    }

    return {
      modelId,
      modelName: model?.name ?? modelId,
      tenantId,
      featurePsi,
      scoreShift,
      severity,
      samples: snapshots.length,
      checkedAt: new Date().toISOString(),
    };
  }

  async checkAllForTenant(tenantId: string): Promise<DriftReport[]> {
    const models = await this.prisma.analyticsModel.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
    });
    const reports: DriftReport[] = [];
    for (const m of models) {
      reports.push(await this.checkModel(m.id, tenantId));
    }
    return reports;
  }

  private collectKeys(
    snapshots: ReadonlyArray<{ featuresJson: unknown }>,
  ): string[] {
    const keys = new Set<string>();
    for (const s of snapshots) {
      const f = s.featuresJson;
      if (f && typeof f === 'object') {
        for (const k of Object.keys(f as Record<string, unknown>)) {
          keys.add(k);
        }
      }
    }
    return Array.from(keys);
  }

  private partition<T>(arr: readonly T[], start: number): T[] {
    return arr.slice(start);
  }

  private psi(
    baseline: ReadonlyArray<unknown>,
    current: ReadonlyArray<unknown>,
    feature: string,
  ): number {
    const base = baseline.map((s) => this.numFeature(s, feature));
    const curr = current.map((s) => this.numFeature(s, feature));
    const bins = 8;
    const all: number[] = base.concat(curr);
    if (all.length === 0) return 0;
    const min = Math.min(...all);
    const max = Math.max(...all);
    if (min === max) return 0;
    const step = (max - min) / bins;
    const baseHist: number[] = new Array<number>(bins).fill(0);
    const currHist: number[] = new Array<number>(bins).fill(0);
    for (const v of base) {
      const idx = this.bin(v, min, step, bins);
      baseHist[idx] = (baseHist[idx] ?? 0) + 1;
    }
    for (const v of curr) {
      const idx = this.bin(v, min, step, bins);
      currHist[idx] = (currHist[idx] ?? 0) + 1;
    }
    let psi = 0;
    for (let i = 0; i < bins; i += 1) {
      const b = Math.max(baseHist[i] / Math.max(base.length, 1), 0.0001);
      const c = Math.max(currHist[i] / Math.max(curr.length, 1), 0.0001);
      psi += (b - c) * Math.log(b / c);
    }
    return Math.abs(psi);
  }

  private scoreShift(
    baseline: ReadonlyArray<unknown>,
    current: ReadonlyArray<unknown>,
  ): number {
    if (baseline.length === 0 || current.length === 0) return 0;
    const mean = (vs: ReadonlyArray<unknown>): number => {
      const nums = vs.map((v) => this.numFeature(v, '__score__'));
      if (nums.length === 0) return 0;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    };
    return mean(current) - mean(baseline);
  }

  private bin(v: number, min: number, step: number, bins: number): number {
    const idx = Math.floor((v - min) / step);
    return Math.max(0, Math.min(bins - 1, idx));
  }

  private numFeature(snapshot: unknown, key: string): number {
    if (!snapshot || typeof snapshot !== 'object') return 0;
    const f = (snapshot as { featuresJson?: unknown }).featuresJson;
    if (!f || typeof f !== 'object') return 0;
    const v = (f as Record<string, unknown>)[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }

  private severityFor(
    value: number,
    low: number,
    medium: number,
  ): DriftSeverity {
    if (value >= medium) return 'high';
    if (value >= low) return 'medium';
    return 'low';
  }

  private combinedSeverity(
    featurePsi: ReadonlyArray<{ psi: number; severity: DriftSeverity }>,
    scoreShift: number,
  ): DriftSeverity {
    let highCount = 0;
    let mediumCount = 0;
    for (const f of featurePsi) {
      if (f.severity === 'high') highCount++;
      if (f.severity === 'medium') mediumCount++;
    }
    if (highCount > 0 || Math.abs(scoreShift) >= SHIFT_MEDIUM) return 'high';
    if (mediumCount > 0 || Math.abs(scoreShift) >= SHIFT_LOW) return 'medium';
    return 'low';
  }
}

function round(v: number, places: number): number {
  const p = 10 ** places;
  return Math.round(v * p) / p;
}
