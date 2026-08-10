/**
 * LegacyAgentDispatchAdapter — Phase 8.1 compatibility adapter.
 *
 * Rewires the legacy `/agents/:id/dispatch` and `/agents/:id/task` execution
 * entry points onto the canonical `AIEmployeeCore` so that a dispatched task
 * becomes a governed, idempotent WorkRun instead of the legacy synthetic
 * local completion.
 *
 * SOLID:
 *  - SRP: this adapter only converts a legacy dispatch call into a canonical
 *    core start. It does not execute, plan, or persist anything itself.
 *  - DIP: it depends only on `AI_EMPLOYEE_CORE`, never on the legacy executor,
 *    Prisma, or a concrete runtime.
 *
 * Fire-and-forget policy (plan §8.1): the durable creation is awaited so a
 * confirmed `workRunId` is returned (HTTP 202), and only the *execution* is
 * fired without blocking the response. This removes the unconfirmed
 * fire-and-forget that previously created no durable artifact at all.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { AI_EMPLOYEE_CORE } from '../ai-employee-core.tokens';
import type {
  IAIEmployeeCore,
  StartEmployeeRunInput,
} from '../contracts/ai-employee-core.interface';

export interface LegacyDispatchResult {
  readonly workRunId: string;
  readonly status: string;
  readonly created: boolean;
}

export interface LegacyCancelResult {
  readonly cancelledRunIds: readonly string[];
}

@Injectable()
export class LegacyAgentDispatchAdapter {
  private readonly logger = new Logger(LegacyAgentDispatchAdapter.name);

  constructor(
    @Inject(AI_EMPLOYEE_CORE) private readonly core: IAIEmployeeCore,
  ) {}

  /**
   * Start a canonical Employee WorkRun for a dispatched task. Returns durably
   * with a workRunId and kicks off execution without blocking the caller.
   */
  async dispatchTask(
    taskId: string,
    agentId: string,
    tenantId: string,
    requestedByActorId: string,
  ): Promise<LegacyDispatchResult> {
    const input: StartEmployeeRunInput = {
      tenantId,
      employeeId: agentId,
      requestedBy: { actorId: requestedByActorId, actorType: 'HUMAN' },
      objective: `Execute assigned task ${taskId}`,
      context: { taskId },
      trigger: { type: 'TASK', sourceId: taskId },
      idempotencyKey: `legacy-dispatch:${tenantId}:${taskId}:${agentId}`,
    };
    const { run, created } = await this.core.startDurable(input);
    if (created) {
      // Durable create is confirmed; only the execution is fire-and-forget.
      void this.core.executeRun(tenantId, run.id).catch((err) => {
        this.logger.error(
          `Legacy dispatch executeRun failed for run ${run.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    }
    return { workRunId: run.id, status: run.status, created };
  }

  /** Cancel all non-terminal WorkRuns associated with the task. */
  async cancelTask(
    tenantId: string,
    taskId: string,
  ): Promise<LegacyCancelResult> {
    const runs = await this.core.list(tenantId, { taskId });
    const terminal = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);
    const cancelledRunIds: string[] = [];
    for (const run of runs) {
      if (terminal.has(run.status)) continue;
      await this.core.cancel(tenantId, run.id, 'cancelled via legacy adapter');
      cancelledRunIds.push(run.id);
    }
    return { cancelledRunIds };
  }
}
