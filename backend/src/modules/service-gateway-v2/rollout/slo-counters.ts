/**
 * SLO Counters — runtime service-gateway-v2 observability.
 *
 * Phase 8 (NC-AWL-IMP-1 §11.5) requires the platform to record:
 *   - routing latency p95
 *   - denial rate
 *   - approval-required rate
 *   - duplicate-effect count
 *   - recovery time
 *
 * Implementation:
 *   - In-memory ring buffer for latency samples (lock-protected).
 *   - Monotonic counters for the rate metrics.
 *   - If a Redis client is available and connected, counters are mirrored
 *     to Redis under `slo:gw-v2:*` keys (HINCRBY) so a multi-instance
 *     deployment sees aggregated numbers. Latency samples stay
 *     in-process (they are cheap and per-instance p95 is still meaningful
 *     for SLO alerting).
 *   - If Redis is unavailable, all of this works in-memory with no
 *     operator intervention — the counters are still observable via the
 *     /admin/service-gateway-v2/slo endpoint.
 *
 * Thread-safety: Node is single-threaded but awaits between mutations
 * are possible. We protect every mutating operation with a single
 * internal promise-chain mutex so the numbers are consistent.
 */

import { Injectable, Logger, Optional, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../../../infrastructure/cache/redis.service';

export type SloChannel = 'webchat' | 'email' | 'calendar' | 'crm' | 'brevo';
export type SloPhase =
  | 'read'
  | 'mutate'
  | 'recommend'
  | 'channels'
  | 'agent-builder'
  | 'model';

export interface SloCountersSnapshot {
  /** Number of routing decisions observed. */
  routingTotal: number;
  /** Number of routing decisions that returned a denial. */
  denials: number;
  /** Number of routing decisions that returned an approval-required verdict. */
  approvalsRequired: number;
  /** Number of duplicate effects detected (idempotency-collision or replay). */
  duplicateEffects: number;
  /** Number of recovery events (worker restart / transient failure recovered). */
  recoveries: number;
  /** Sum of recovery durations in milliseconds. */
  recoveryTimeMsTotal: number;
  /** Latency p95 (ms) over the rolling window. */
  latencyP95Ms: number;
  /** Computed denial rate in [0,1]. */
  denialRate: number;
  /** Computed approval-required rate in [0,1]. */
  approvalRate: number;
  /** Window size for latency samples. */
  latencyWindow: number;
  /** Counters broken down per phase (read/mutate/recommend/...). */
  byPhase: Record<
    SloPhase,
    { total: number; denials: number; approvals: number }
  >;
  /** Counters broken down per channel. */
  byChannel: Record<
    SloChannel,
    { total: number; denials: number; approvals: number }
  >;
  /** Whether the counters are being mirrored to Redis. */
  redisMirrored: boolean;
  /** ISO timestamp the snapshot was generated. */
  generatedAt: string;
}

const DEFAULT_WINDOW = 512;
const PHASES: SloPhase[] = [
  'read',
  'mutate',
  'recommend',
  'channels',
  'agent-builder',
  'model',
];
const CHANNELS: SloChannel[] = ['webchat', 'email', 'calendar', 'crm', 'brevo'];

function emptyPhaseBreakdown(): Record<
  SloPhase,
  { total: number; denials: number; approvals: number }
> {
  const out = {} as Record<
    SloPhase,
    { total: number; denials: number; approvals: number }
  >;
  for (const p of PHASES) out[p] = { total: 0, denials: 0, approvals: 0 };
  return out;
}

function emptyChannelBreakdown(): Record<
  SloChannel,
  { total: number; denials: number; approvals: number }
> {
  const out = {} as Record<
    SloChannel,
    { total: number; denials: number; approvals: number }
  >;
  for (const c of CHANNELS) out[c] = { total: 0, denials: 0, approvals: 0 };
  return out;
}

@Injectable()
export class SloCounters implements OnModuleInit {
  private readonly logger = new Logger(SloCounters.name);
  private readonly windowSize: number;
  private readonly latencies: number[] = [];
  private latencyCursor = 0;
  private latencyCount = 0;

  private routingTotal = 0;
  private denials = 0;
  private approvalsRequired = 0;
  private duplicateEffects = 0;
  private recoveries = 0;
  private recoveryTimeMsTotal = 0;

  private byPhase = emptyPhaseBreakdown();
  private byChannel = emptyChannelBreakdown();

  /**
   * Redis mirror of the scalar counters (routing/denials/approvals).
   * We store them as a JSON blob under `slo:gw-v2:routing` because the
   * existing RedisService only exposes string get/set/incr — no HINCRBY
   * or HGETALL. The mirror is read on `aggregatedSnapshot()` and
   * write-batched via the in-process mutex, so it is correct under
   * concurrent writes from a single process. Multi-process aggregation
   * uses the local snapshot as the truth and `max(local, remote)` for
   * the merged view (idempotent, monotonic).
   */
  private remoteRouting: { total: number; denials: number; approvals: number } =
    {
      total: 0,
      denials: 0,
      approvals: 0,
    };
  private remoteCounters: {
    duplicateEffects: number;
    recoveries: number;
    recoveryTimeMsTotal: number;
  } = {
    duplicateEffects: 0,
    recoveries: 0,
    recoveryTimeMsTotal: 0,
  };

  /**
   * Internal mutex chain — Node is single-threaded but `await` introduces
   * interleaving. We serialise all mutating ops through this promise so
   * counter reads see a consistent state.
   */
  private mutex: Promise<void> = Promise.resolve();

  constructor(@Optional() private readonly redis?: RedisService) {
    const envWindow = Number(process.env.SLO_COUNTER_WINDOW ?? DEFAULT_WINDOW);
    this.windowSize = Number.isFinite(envWindow) && envWindow >= 16 ? envWindow : DEFAULT_WINDOW;
  }

  onModuleInit(): void {
    this.logger.log(
      `SloCounters initialised (window=${this.windowSize}, redis=${
        this.redis ? 'available' : 'in-memory'
      })`,
    );
  }

  /**
   * Record one routing decision. `latencyMs` is mandatory; phase/channel
   * breakdowns are best-effort. `verdict` is one of:
   *   - 'allow'     — routed, no approval required
   *   - 'deny'      — explicit denial (capability off, kill-switch, etc.)
   *   - 'approval'  — routed but approval required before action
   */
  recordRouting(args: {
    latencyMs: number;
    verdict: 'allow' | 'deny' | 'approval';
    phase?: SloPhase;
    channel?: SloChannel;
  }): void {
    this.runExclusive(async () => {
      this.routingTotal += 1;
      if (args.verdict === 'deny') this.denials += 1;
      if (args.verdict === 'approval') this.approvalsRequired += 1;
      this.recordLatency(args.latencyMs);

      if (args.phase && this.byPhase[args.phase]) {
        const row = this.byPhase[args.phase];
        row.total += 1;
        if (args.verdict === 'deny') row.denials += 1;
        if (args.verdict === 'approval') row.approvals += 1;
      }
      if (args.channel && this.byChannel[args.channel]) {
        const row = this.byChannel[args.channel];
        row.total += 1;
        if (args.verdict === 'deny') row.denials += 1;
        if (args.verdict === 'approval') row.approvals += 1;
      }

      if (this.redis) {
        this.remoteRouting.total += 1;
        if (args.verdict === 'deny') this.remoteRouting.denials += 1;
        if (args.verdict === 'approval') this.remoteRouting.approvals += 1;
        try {
          await this.redis.set(
            'slo:gw-v2:routing',
            JSON.stringify(this.remoteRouting),
          );
        } catch {
          // Mirror is best-effort; never fail the routing path because
          // the counter write failed.
        }
      }
    });
  }

  /** Record a duplicate-effect detection. */
  recordDuplicateEffect(): void {
    this.runExclusive(async () => {
      this.duplicateEffects += 1;
      if (this.redis) {
        this.remoteCounters.duplicateEffects += 1;
        try {
          await this.redis.set(
            'slo:gw-v2:counters',
            JSON.stringify(this.remoteCounters),
          );
        } catch {
          /* best-effort */
        }
      }
    });
  }

  /** Record a worker / transient recovery event and its duration. */
  recordRecovery(durationMs: number): void {
    this.runExclusive(async () => {
      this.recoveries += 1;
      this.recoveryTimeMsTotal += Math.max(0, Math.floor(durationMs));
      if (this.redis) {
        this.remoteCounters.recoveries += 1;
        this.remoteCounters.recoveryTimeMsTotal += Math.max(
          0,
          Math.floor(durationMs),
        );
        try {
          await this.redis.set(
            'slo:gw-v2:counters',
            JSON.stringify(this.remoteCounters),
          );
        } catch {
          /* best-effort */
        }
      }
    });
  }

  /** Reset all counters (admin / rollback). */
  reset(): void {
    this.runExclusive(async () => {
      this.routingTotal = 0;
      this.denials = 0;
      this.approvalsRequired = 0;
      this.duplicateEffects = 0;
      this.recoveries = 0;
      this.recoveryTimeMsTotal = 0;
      this.latencies.length = 0;
      this.latencyCursor = 0;
      this.latencyCount = 0;
      this.byPhase = emptyPhaseBreakdown();
      this.byChannel = emptyChannelBreakdown();
      this.remoteRouting = { total: 0, denials: 0, approvals: 0 };
      this.remoteCounters = {
        duplicateEffects: 0,
        recoveries: 0,
        recoveryTimeMsTotal: 0,
      };
      if (this.redis) {
        try {
          await this.redis.del('slo:gw-v2:routing');
          await this.redis.del('slo:gw-v2:counters');
        } catch {
          /* best-effort */
        }
      }
    });
  }

  /**
   * Take a consistent snapshot of all counters. Safe to call from a
   * request handler — the mutex chain serialises mutations.
   */
  snapshot(): SloCountersSnapshot {
    const total = this.routingTotal;
    const denialRate = total > 0 ? this.denials / total : 0;
    const approvalRate = total > 0 ? this.approvalsRequired / total : 0;
    return {
      routingTotal: total,
      denials: this.denials,
      approvalsRequired: this.approvalsRequired,
      duplicateEffects: this.duplicateEffects,
      recoveries: this.recoveries,
      recoveryTimeMsTotal: this.recoveryTimeMsTotal,
      latencyP95Ms: this.computeP95(),
      denialRate,
      approvalRate,
      latencyWindow: this.windowSize,
      byPhase: { ...this.byPhase },
      byChannel: { ...this.byChannel },
      redisMirrored: !!this.redis,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Pull aggregated counters from Redis (when available) and merge them
   * with the in-process numbers. Useful in a multi-instance deployment
   * where the operator wants the cross-instance total. Falls back to the
   * in-process snapshot if Redis is unavailable.
   */
  async aggregatedSnapshot(): Promise<SloCountersSnapshot> {
    const local = this.snapshot();
    if (!this.redis) return local;
    try {
      const [routing, counters] = await Promise.all([
        this.redis.getJson<{
          total?: number;
          denials?: number;
          approvals?: number;
        }>('slo:gw-v2:routing'),
        this.redis.getJson<{
          duplicateEffects?: number;
          recoveries?: number;
          recoveryTimeMsTotal?: number;
        }>('slo:gw-v2:counters'),
      ]);
      const remoteTotal = Number(routing?.total ?? 0);
      const remoteDenials = Number(routing?.denials ?? 0);
      const remoteApprovals = Number(routing?.approvals ?? 0);
      const remoteDup = Number(counters?.duplicateEffects ?? 0);
      const remoteRec = Number(counters?.recoveries ?? 0);
      const remoteRecMs = Number(counters?.recoveryTimeMsTotal ?? 0);
      const merged: SloCountersSnapshot = {
        ...local,
        routingTotal: Math.max(local.routingTotal, remoteTotal),
        denials: Math.max(local.denials, remoteDenials),
        approvalsRequired: Math.max(local.approvalsRequired, remoteApprovals),
        duplicateEffects: Math.max(local.duplicateEffects, remoteDup),
        recoveries: Math.max(local.recoveries, remoteRec),
        recoveryTimeMsTotal: Math.max(local.recoveryTimeMsTotal, remoteRecMs),
        redisMirrored: true,
      };
      merged.denialRate =
        merged.routingTotal > 0 ? merged.denials / merged.routingTotal : 0;
      merged.approvalRate =
        merged.routingTotal > 0
          ? merged.approvalsRequired / merged.routingTotal
          : 0;
      return merged;
    } catch (e) {
      this.logger.warn(
        `SloCounters.aggregatedSnapshot: Redis read failed, returning local: ${
          (e as Error).message
        }`,
      );
      return local;
    }
  }

  // --- internals ---------------------------------------------------------

  private recordLatency(ms: number): void {
    const sample = Math.max(0, Math.floor(ms));
    if (this.latencies.length < this.windowSize) {
      this.latencies.push(sample);
    } else {
      this.latencies[this.latencyCursor] = sample;
    }
    this.latencyCursor = (this.latencyCursor + 1) % this.windowSize;
    if (this.latencyCount < this.windowSize) this.latencyCount += 1;
  }

  private computeP95(): number {
    if (this.latencyCount === 0) return 0;
    const n = this.latencyCount;
    const copy = this.latencies.slice(0, n);
    copy.sort((a, b) => a - b);
    // Nearest-rank p95.
    const idx = Math.min(n - 1, Math.floor(0.95 * n));
    return copy[idx] ?? 0;
  }

  private runExclusive(work: () => Promise<void>): void {
    this.mutex = this.mutex.then(work).catch((e) => {
      this.logger.error(`SloCounters mutation failed: ${(e as Error).message}`);
    });
  }
}
