/**
 * Phase 30 — Usage reporting contract (CR-AI-1305).
 *
 * SOLID
 *   ISP — one method. A ceiling rule never sees this contract; only
 *         the service does.
 *   DIP — the service depends on this abstraction, so ceilings can be
 *         evaluated against a real `CostRecord` aggregate in
 *         production and against a literal snapshot in the G30 gate.
 */

import type { CostUsageSnapshot } from './ICeilingRule';

export interface IUsageReporter {
  snapshot(tenantId: string): Promise<CostUsageSnapshot>;
}
