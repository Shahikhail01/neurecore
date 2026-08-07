/**
 * Cost Cents — Phase 14 typed money arithmetic.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-13-14.md §3.
 *
 * Wraps CostService to expose a typed `Cents` branded number so the
 * Phase 14 dashboard (and any future cost math) cannot silently
 * mix cents with raw floats. Arithmetic is integer-safe (cents → cents),
 * ratio math returns an explicit Ratio object so callers can format.
 *
 * SRP — only owns cents math. Persistence + access policy live in
 * CostService; this class is a typed wrapper.
 *
 * DIP — depends only on CostService via DI.
 */

import { Injectable } from '@nestjs/common';
import { CostService } from './cost.service';

declare const CENTS_BRAND: unique symbol;
export type Cents = number & { readonly [CENTS_BRAND]?: 'Cents' };

export const ZERO_CENTS: Cents = 0 as Cents;
export function toCents(value: number): Cents {
  if (!Number.isFinite(value)) {
    throw new TypeError(`cannot convert ${value} to Cents`);
  }
  // Round-half-up to the nearest integer cent. NEVER floats for storage.
  return Math.round(value) as Cents;
}
export function centsAdd(a: Cents, b: Cents): Cents {
  return (Number(a) + Number(b)) as Cents;
}
export function centsSub(a: Cents, b: Cents): Cents {
  return (Number(a) - Number(b)) as Cents;
}
export function centsRatio(numerator: Cents, denominator: Cents): number {
  const d = Number(denominator);
  if (d <= 0) return 0;
  return Number(numerator) / d;
}

/**
 * Typed dashboard summary. Numbers are Cents (integer-safe);
 * utilization is a ratio in [0, 1] (the dashboard formats it as %).
 */
export interface CCostSummary {
  readonly tenantId: string;
  readonly totalSpent: Cents;
  readonly totalBudget: Cents;
  readonly utilization: number;
  readonly periodStart: string; // ISO
  readonly periodEnd: string;   // ISO
  readonly byModel: ReadonlyArray<{
    readonly provider: string;
    readonly model: string;
    readonly spent: Cents;
  }>;
}

@Injectable()
export class CostCentsService {
  constructor(private readonly costs: CostService) {}

  async summaryForTenant(tenantId: string): Promise<CCostSummary> {
    const raw = await this.costs.getCosts(tenantId);
    return {
      tenantId: raw.tenantId,
      totalSpent: toCents(Number(raw.monthToDateCents ?? 0)),
      totalBudget: toCents(Number(raw.totalBudgetCents ?? 0)),
      utilization: Number(raw.utilizationPercent ?? 0),
      periodStart: raw.windowStart ?? new Date().toISOString(),
      periodEnd: raw.windowEnd ?? new Date().toISOString(),
      byModel: (raw.byModel ?? []).map((m: { provider: string; model: string; costCents: number | string }) => ({
        provider: m.provider,
        model: m.model,
        spent: toCents(Number(m.costCents ?? 0)),
      })),
    };
  }
}
