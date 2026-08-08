/**
 * Phase 30 — Spend recording contract (CR-AI-1305).
 *
 * SOLID
 *   ISP — one method, separate from `IUsageReporter`. A consumer that
 *         only reads usage never gains the ability to write it.
 *   DIP — `CostCeilingService` depends on this abstraction, so spend
 *         can be persisted in production and captured in memory in
 *         the G30 gate.
 */

import type { SpendReport } from './ICostCeilingEnforcer';

export interface ISpendRecorder {
  record(report: SpendReport): Promise<void>;
}

/** DI token — the spend recorder. */
export const SPEND_RECORDER = Symbol('SpendRecorder');
