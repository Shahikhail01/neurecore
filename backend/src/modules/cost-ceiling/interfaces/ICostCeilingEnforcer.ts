/**
 * Phase 30 — Cost ceiling enforcement contract (CR-AI-1305).
 *
 * The narrow surface the LLM call path depends on. `LlmModelRunner`
 * must not know how a ceiling is stored, evaluated or alerted — it
 * only needs to ask "may I spend this?" and to report what it spent.
 *
 * SOLID
 *   ISP — two methods, both on the call path. Configuration and
 *         dashboard reads live on `CostCeilingService`, which the
 *         runner never sees.
 *   DIP — the runner injects this token, so the analytics module has
 *         no compile-time dependency on the cost-ceiling internals.
 */

import type { CostProjection } from './ICeilingRule';

export interface CeilingAuthorizationRequest {
  readonly tenantId: string;
  readonly capability: string;
  readonly projection?: CostProjection;
  readonly actorUserId?: string;
}

export interface SpendReport {
  readonly tenantId: string;
  readonly capability: string;
  readonly costCents: number;
  readonly tokens: number;
}

export interface ICostCeilingEnforcer {
  /** Throws `CostCeilingExceededError` when any enabled ceiling is hit. */
  authorize(request: CeilingAuthorizationRequest): Promise<void>;
  /** Records realised spend so the next authorisation sees it. */
  reportSpend(report: SpendReport): Promise<void>;
}
