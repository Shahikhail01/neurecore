/**
 * Phase 30 — Alert sink contract (CR-AI-1305).
 *
 * SOLID
 *   ISP — one method. Evaluation never writes; alerting never
 *         decides.
 *   OCP — a new destination (audit log, pager, webhook) is a new sink
 *         implementation; `CostCeilingService` is untouched.
 */

import type { CeilingEvaluation } from './ICeilingRule';

export interface CostAlertEvent {
  readonly tenantId: string;
  readonly capability: string;
  readonly evaluation: CeilingEvaluation;
  readonly actorUserId?: string;
}

export interface IAlertSink {
  alert(event: CostAlertEvent): Promise<void>;
}
