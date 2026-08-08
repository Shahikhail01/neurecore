/**
 * Phase 30 — Sliding request-rate window (CR-AI-1305).
 *
 * A trailing 60-second, per-tenant request counter used by the
 * `REQUESTS_PER_MINUTE` ceiling. It is deliberately in-process and
 * monotonic-clock free of IO: rate control must not add a network
 * round-trip to every LLM call.
 *
 * Timestamps are pruned on read, so memory is bounded by the number
 * of tenants that called within the window.
 *
 * SOLID
 *   SRP — owns ONLY the sliding window.
 *   DIP — the clock is injected, so the G30 gate can advance time
 *         deterministically instead of sleeping.
 */

import { Injectable } from '@nestjs/common';

export const RATE_WINDOW_MS = 60_000;

export type Clock = () => number;

@Injectable()
export class RequestRateWindow {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly now: Clock = () => Date.now()) {}

  /** Requests observed for the tenant within the trailing window. */
  count(tenantId: string): number {
    return this.prune(tenantId).length;
  }

  /** Record one request and return the new count (including it). */
  record(tenantId: string): number {
    const kept = this.prune(tenantId);
    kept.push(this.now());
    this.hits.set(tenantId, kept);
    return kept.length;
  }

  reset(tenantId?: string): void {
    if (tenantId) this.hits.delete(tenantId);
    else this.hits.clear();
  }

  private prune(tenantId: string): number[] {
    const cutoff = this.now() - RATE_WINDOW_MS;
    const kept = (this.hits.get(tenantId) ?? []).filter((t) => t > cutoff);
    this.hits.set(tenantId, kept);
    return kept;
  }
}
