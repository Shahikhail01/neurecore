/**
 * AgentRunCompatAdapter — Phase 8.2 compatibility adapter.
 *
 * Translates the Phase-23 `AgentRunRequest`/`AgentRunResult` contract onto the
 * canonical `AIEmployeeCore` so `/agents/:id/run`, `/agent-runtime/run`, and the
 * chat `/agent` surface can be routed through the Work Runtime.
 *
 * SOLID:
 *  - SRP: only translates the legacy agent-run request into a canonical
 *    Employee run and maps the canonical view back to an agent-run-compatible
 *    result. It does not plan, execute, or persist anything itself.
 *  - DIP: depends only on `AI_EMPLOYEE_CORE`.
 *  - LSP: a non-terminal canonical state maps to an honest paused/failed view;
 *    it is never reported as a synthetic success.
 *
 * Cutover note (plan §8.2 / §12): this adapter provides the compatibility
 * translation. Actual route cutover is opt-in behind the
 * `ai_employee_core.legacy_adapter.enabled` feature flag and requires mapping a
 * static catalog role to a concrete tenant Employee; `AgentRun` rows continue to
 * be written until response compatibility is proven (Phase 11 retirement).
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { AI_EMPLOYEE_CORE } from '../ai-employee-core.tokens';
import type { IAIEmployeeCore } from '../contracts/ai-employee-core.interface';
import type { EmployeeRunView } from '../contracts/employee-run.types';

export type AgentRunCompatStatus =
  | 'COMPLETED'
  | 'APPROVAL_REQUIRED'
  | 'CLARIFICATION_REQUIRED'
  | 'FAILED';

export interface AgentRunCompatResult {
  readonly runId: string;
  readonly status: AgentRunCompatStatus;
  readonly reply: string;
  readonly approvalId: string | null;
}

export interface AgentRunCompatRequest {
  readonly tenantId: string;
  /** The tenant Employee (Agent UUID) that executes the run. */
  readonly employeeId: string;
  readonly actorUserId: string;
  readonly actorRole: string;
  readonly objective: string;
  readonly context?: {
    readonly projectId?: string;
    readonly customerId?: string;
    readonly taskId?: string;
    readonly threadId?: string;
    readonly includeCapabilities?: readonly string[];
  };
  readonly trigger?: {
    readonly type: 'USER' | 'TASK' | 'SCHEDULE' | 'EVENT' | 'MISSION';
    readonly sourceId?: string;
  };
  readonly idempotencyKey: string;
}

@Injectable()
export class AgentRunCompatAdapter {
  private readonly logger = new Logger(AgentRunCompatAdapter.name);

  constructor(
    @Inject(AI_EMPLOYEE_CORE) private readonly core: IAIEmployeeCore,
  ) {}

  async run(req: AgentRunCompatRequest): Promise<AgentRunCompatResult> {
    const { run, created } = await this.core.startDurable({
      tenantId: req.tenantId,
      employeeId: req.employeeId,
      requestedBy: { actorId: req.actorUserId, actorType: 'HUMAN' },
      objective: req.objective,
      context: req.context,
      trigger: req.trigger ?? { type: 'USER' },
      idempotencyKey: req.idempotencyKey,
    });
    const view = created
      ? await this.core.executeRun(req.tenantId, run.id)
      : run;
    return this.map(view);
  }

  private map(view: EmployeeRunView): AgentRunCompatResult {
    switch (view.status) {
      case 'COMPLETED':
        return {
          runId: view.id,
          status: 'COMPLETED',
          reply: view.summary ?? 'Completed',
          approvalId: null,
        };
      case 'WAITING_FOR_APPROVAL':
        return {
          runId: view.id,
          status: 'APPROVAL_REQUIRED',
          reply: 'This action requires human approval before it can continue.',
          approvalId: view.approvalId,
        };
      case 'PAUSED':
        return {
          runId: view.id,
          status: 'CLARIFICATION_REQUIRED',
          reply: 'Additional input is required before this run can continue.',
          approvalId: null,
        };
      case 'CANCELLED':
        return {
          runId: view.id,
          status: 'FAILED',
          reply: 'The run was cancelled.',
          approvalId: null,
        };
      case 'FAILED':
        return {
          runId: view.id,
          status: 'FAILED',
          reply: view.failure?.reason ?? 'The run failed.',
          approvalId: null,
        };
      default:
        this.logger.warn(
          `AgentRunCompatAdapter: run ${view.id} left in non-terminal state ${view.status}; reporting as clarification.`,
        );
        return {
          runId: view.id,
          status: 'CLARIFICATION_REQUIRED',
          reply: 'The run has not reached a terminal state yet.',
          approvalId: null,
        };
    }
  }
}
