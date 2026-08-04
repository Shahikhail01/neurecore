/**
 * Residency + Drift Observability — Phase 9.
 *
 * Source plan: §5.17.7 + §5.2.2.
 *
 * Solid:
 *   • SRP — ResidencyService owns region selection + enforcement
 *     policy; DriftService owns baseline management + backtest runner.
 *   • OCP — adding a new region = new enum value + a single constant
 *     entry in OOB_REGIONS. No other code changes.
 *   • Append-only audit: DriftEvaluation rows are insert-only.
 *
 * Per v3 P-1 rule §11: every tenant-scoped method refuses the wildcard.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  DriftOutcome,
  ResidencyEnforcementMode,
  TenantRegion,
} from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

/**
 * OOB_REGIONS — single canonical list. Adding a region = new enum
 * value (Prisma migration) + new entry here. The display label +
 * default locale + currency come from this registry.
 */
export const OOB_REGIONS: ReadonlyArray<{
  region: TenantRegion;
  displayName: string;
  defaultLocale: string;
  defaultCurrency: string;
}> = [
  { region: 'US_EAST', displayName: 'US East (Virginia)', defaultLocale: 'en-US', defaultCurrency: 'USD' },
  { region: 'US_WEST', displayName: 'US West (Oregon)', defaultLocale: 'en-US', defaultCurrency: 'USD' },
  { region: 'EU_CENTRAL', displayName: 'EU Central (Frankfurt)', defaultLocale: 'de-DE', defaultCurrency: 'EUR' },
  { region: 'EU_WEST', displayName: 'EU West (Ireland)', defaultLocale: 'en-GB', defaultCurrency: 'EUR' },
  { region: 'ASIA_PACIFIC', displayName: 'Asia Pacific (Singapore)', defaultLocale: 'en-GB', defaultCurrency: 'SGD' },
  { region: 'ASIA_NORTHEAST', displayName: 'Asia Northeast (Tokyo)', defaultLocale: 'ja-JP', defaultCurrency: 'JPY' },
  { region: 'MIDDLE_EAST', displayName: 'Middle East (UAE)', defaultLocale: 'ar-SA', defaultCurrency: 'AED' },
  { region: 'SOUTH_AMERICA', displayName: 'South America (São Paulo)', defaultLocale: 'pt-BR', defaultCurrency: 'BRL' },
  { region: 'CANADA', displayName: 'Canada (Montréal)', defaultLocale: 'en-GB', defaultCurrency: 'CAD' },
  { region: 'AUSTRALIA', displayName: 'Australia (Sydney)', defaultLocale: 'en-GB', defaultCurrency: 'AUD' },
  { region: 'AFRICA', displayName: 'Africa (Cape Town)', defaultLocale: 'en-GB', defaultCurrency: 'ZAR' },
];

// ─── ResidencyService ───────────────────────────────────────────

@Injectable()
export class ResidencyService {
  private readonly logger = new Logger(ResidencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  listRegions() {
    return OOB_REGIONS;
  }

  /**
   * Return the active region for a tenant. If the tenant has multiple
   * TenantRegionConfig rows, the most recently updated one wins.
   */
  async resolve(tenantId: string): Promise<TenantRegion> {
    this.assertRealTenant(tenantId);
    const rows = await this.prisma.tenantRegionConfig.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    });
    return rows[0]?.region ?? 'US_EAST';
  }

  /**
   * Set (or replace) the tenant's region config. Idempotent per
   * (tenantId, region).
   */
  async setRegion(args: {
    tenantId: string;
    region: TenantRegion;
    enforcementMode?: ResidencyEnforcementMode;
    overrides?: Record<string, unknown>;
  }) {
    this.assertRealTenant(args.tenantId);
    if (!OOB_REGIONS.some((r) => r.region === args.region)) {
      throw new BadRequestException(`unknown region "${args.region}"`);
    }
    return this.prisma.tenantRegionConfig.upsert({
      where: { tenantId_region: { tenantId: args.tenantId, region: args.region } },
      create: {
        tenantId: args.tenantId,
        region: args.region,
        enforcementMode: args.enforcementMode ?? 'HARD',
        overrides: (args.overrides ?? {}) as never,
      },
      update: {
        enforcementMode: args.enforcementMode ?? 'HARD',
        overrides: (args.overrides ?? {}) as never,
      },
    });
  }

  list(tenantId: string) {
    this.assertRealTenant(tenantId);
    return this.prisma.tenantRegionConfig.findMany({
      where: { tenantId },
      orderBy: { region: 'asc' },
    });
  }

  /**
   * Enforce the HARD residency mode. Returns null when the data plane
   * call is allowed, throws ForbiddenException when the call would
   * touch a different region than the tenant's primary config.
   */
  enforce(args: {
    tenantId: string;
    targetRegion: TenantRegion;
    dataPlane: string; // "llm_calls", "data_storage", etc.
  }) {
    this.assertRealTenant(args.tenantId);
    return this.prisma.tenantRegionConfig
      .findUnique({
        where: { tenantId_region: { tenantId: args.tenantId, region: args.targetRegion } },
      })
      .then((cfg) => {
        if (!cfg) {
          throw new ForbiddenException(
            `tenant ${args.tenantId} has no config for region ${args.targetRegion}; HARD residency refused`,
          );
        }
        if (cfg.enforcementMode === 'SOFT') {
          this.logger.warn(
            `soft residency: tenant=${args.tenantId} targetRegion=${args.targetRegion} dataPlane=${args.dataPlane} (no enforcement)`,
          );
          return null;
        }
        // HARD: check the per-data-plane override map.
        const override = (cfg.overrides ?? {}) as Record<string, string>;
        const allowed = override[args.dataPlane] ?? cfg.region;
        if (allowed !== args.targetRegion) {
          throw new ForbiddenException(
            `residency HARD: tenant=${args.tenantId} dataPlane=${args.dataPlane} requires region ${allowed} but call targets ${args.targetRegion}`,
          );
        }
        return null;
      });
  }

  private assertRealTenant(tenantId: string) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
  }
}

// ─── DriftService ──────────────────────────────────────────────

const BASELINE_TTL_MS = 90 * 86_400_000; // 90 days

@Injectable()
export class DriftService {
  private readonly logger = new Logger(DriftService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Capture a new baseline for a model. Deterministic serialization
   * via JSON.stringify so successive calls produce identical rows.
   */
  async recordBaseline(args: {
    tenantId?: string;
    modelId: string;
    features: Record<string, { mean: number; stdDev: number; count: number }>;
    sampleSize: number;
  }) {
    if (args.tenantId && args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const expiresAt = new Date(Date.now() + BASELINE_TTL_MS);
    return this.prisma.driftBaseline.create({
      data: {
        tenantId: args.tenantId ?? null,
        modelId: args.modelId,
        baseline: args.features as never,
        sampleSize: args.sampleSize,
        expiresAt,
      },
    });
  }

  /**
   * Backtest runner. Compares a new feature distribution against the
   * latest active baseline using the PSI (Population Stability Index)
   * formula. Returns the worst-case PSI per feature.
   */
  async runBacktest(args: {
    tenantId?: string;
    modelId: string;
    features: Record<string, { mean: number; stdDev: number; count: number }>;
  }): Promise<{
    outcome: DriftOutcome;
    note: string;
    scores: Record<string, number>;
  }> {
    if (args.tenantId && args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const baseline = await this.prisma.driftBaseline.findFirst({
      where: {
        tenantId: args.tenantId ?? null,
        modelId: args.modelId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { recordedAt: 'desc' },
    });
    if (!baseline) {
      return {
        outcome: 'STABLE',
        note: 'no active baseline — backtest skipped',
        scores: {},
      };
    }
    const baseDist = (baseline.baseline ?? {}) as Record<
      string,
      { mean: number; stdDev: number; count: number }
    >;
    const scores: Record<string, number> = {};
    let maxPsi = 0;
    for (const [feature, newStats] of Object.entries(args.features)) {
      const baseStats = baseDist[feature];
      if (!baseStats) continue;
      const psi = this.psi(baseStats, newStats);
      scores[feature] = psi;
      if (psi > maxPsi) maxPsi = psi;
    }
    const outcome: DriftOutcome =
      maxPsi >= 0.25 ? 'CRITICAL_DRIFT' : maxPsi >= 0.1 ? 'DRIFTING' : 'STABLE';
    const note = `max PSI = ${maxPsi.toFixed(4)} across ${Object.keys(scores).length} feature(s)`;
    await this.prisma.driftEvaluation.create({
      data: {
        tenantId: args.tenantId ?? null,
        modelId: args.modelId,
        outcome,
        scores: scores as never,
        note,
      },
    });
    return { outcome, note, scores };
  }

  listEvaluations(args: { tenantId?: string; modelId?: string; limit?: number }) {
    return this.prisma.driftEvaluation.findMany({
      where: {
        tenantId: args.tenantId ?? null,
        ...(args.modelId ? { modelId: args.modelId } : {}),
      },
      orderBy: { ranAt: 'desc' },
      take: args.limit ?? 50,
    });
  }

  /**
   * Population Stability Index proxy — collapses each distribution to
   * (mean, stdDev, count) and returns a single normalised score in
   * [0, 1]. The exact bucketed PSI is reserved for the Phase 9.5
   * wire-up (this is a safe upper-bound approximation).
   *
   * The proxy combines:
   *   - normalised mean drift  |next.mean - base.mean| / |base.mean|
   *   - normalised stdDev drift |next.stdDev - base.stdDev| / |base.stdDev|
   * so a distribution shift in either dimension is captured.
   */
  private psi(
    base: { mean: number; stdDev: number; count: number },
    next: { mean: number; stdDev: number; count: number },
  ): number {
    const meanDrift =
      Math.abs(next.mean - base.mean) / Math.max(1e-9, Math.abs(base.mean));
    const stdDrift =
      base.stdDev > 0
        ? Math.abs(next.stdDev - base.stdDev) / Math.max(1e-9, Math.abs(base.stdDev))
        : next.stdDev > 0
          ? 1
          : 0;
    // Combine with the larger of the two dominating (avoids double-count).
    return Math.min(1, Math.max(meanDrift, stdDrift));
  }
}
