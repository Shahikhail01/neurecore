/**
 * Phase 26 — IForecastSource.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §7 (P26).
 *
 * SOLID — ISP: each source exposes a single narrow method
 * (`load(tenantId, window)`) that returns a typed
 * `ForecastAggregate`. The orchestrator composes sources; no
 * source has to know about another.
 *
 * OCP: a new forecast source (e.g. a future SubscriptionMRR
 * source) = one implementation + one registry key. The
 * orchestrator and `ForecastProvider` are unchanged.
 *
 * LSP: every source substitutes `IForecastSource`. The orchestrator
 * is provider-agnostic.
 *
 * DIP: sources depend on injected `PrismaService` (or another
 * read-side seam). The orchestrator depends on the registry
 * through the `FORECAST_SOURCE_REGISTRY` token — not on the
 * sources directly.
 */

export interface ForecastSourceWindow {
  /** Window start (inclusive). */
  readonly from: Date;
  /** Window end (exclusive). */
  readonly to: Date;
}

export interface ForecastAggregate {
  readonly sourceId: string;
  readonly tenantId: string;
  readonly window: ForecastSourceWindow;
  readonly weightedTotal: number;
  readonly openCount: number;
  readonly byStage: ReadonlyArray<{
    readonly stage: string;
    readonly count: number;
    readonly sumAmount: number;
    readonly sumWeightedAmount: number;
  }>;
  readonly limitations: ReadonlyArray<string>;
}

export interface IForecastSource {
  readonly sourceId: string;
  /** Lower = earlier in composition order; ties broken by sourceId. */
  readonly priority: number;
  load(tenantId: string, window: ForecastSourceWindow): Promise<ForecastAggregate>;
}

/** DI token — the source registry (Map<sourceId, IForecastSource>). */
export const FORECAST_SOURCE_REGISTRY = Symbol('ForecastSourceRegistry');
/** DI token — a single source instance (multi-binding via `useFactory` + spread). */
export const FORECAST_SOURCE = Symbol('ForecastSource');
