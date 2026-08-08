/**
 * Phase 23 — AgentRuntime implementation.
 *
 * Orchestrates a run:
 *   1. Resolve intent → agentId (Router).
 *   2. Open run record (Store).
 *   3. Invoke the matching executor.
 *   4. Persist evidence chain (Store + AuditSink).
 *   5. Close the run.
 *
 * Never bypasses permissions: every mutating write the executor
 * performs goes through SkillRegistry which enforces tenant scope.
 *
 * SOLID — SRP: orchestration only.
 * SOLID — DIP: depends on injected interfaces, never on Prisma or LLM
 *   directly.
 * SOLID — OCP: a 7th agent = one executor + one registry key, zero
 *   changes here.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TenantContext } from '../../../common/context/tenant-context';
import {
  AgentRegistry,
  type AgentId,
} from '../../agent-templates/agents.registry';
import {
  AgentClarificationRequiredError,
  AgentNotRegisteredError,
  AgentUnsupportedIntentError,
} from '../errors';
import type {
  AgentRunRequest,
  AgentRunResult,
  AgentRunEvidence,
  AgentRunStatus,
  IAgentExecutor,
  IAgentRouter,
  IAgentRunStore,
  IAgentRuntime,
} from '../interfaces/agent-runtime.interface';
import {
  AGENT_EXECUTORS,
  AGENT_REGISTRY,
  AGENT_ROUTER,
  AGENT_RUN_STORE,
  AUDIT_SINK,
  TENANT_SCOPE,
} from '../agent-runtime.tokens';
import type { AuditSink } from './audit-sink';

export const AGENT_RUNTIME = Symbol('AGENT_RUNTIME');

@Injectable()
export class AgentRuntime implements IAgentRuntime {
  private readonly logger = new Logger(AgentRuntime.name);
  private readonly executors = new Map<AgentId, IAgentExecutor>();

  constructor(
    @Inject(AGENT_ROUTER) private readonly router: IAgentRouter,
    @Inject(AGENT_RUN_STORE) private readonly store: IAgentRunStore,
    @Inject(AGENT_REGISTRY) private readonly registry: AgentRegistry,
    @Inject(AUDIT_SINK) private readonly audit: AuditSink,
    @Inject(TENANT_SCOPE)
    private readonly assertTenant: (tenantId: unknown) => string,
    @Inject(AGENT_EXECUTORS) executors: ReadonlyArray<IAgentExecutor>,
  ) {
    for (const exec of executors ?? []) {
      this.executors.set(exec.agentId, exec);
      this.logger.log(
        `agent-runtime: registered executor ${exec.agentId} (skills=${exec.skillKeys.join(',')})`,
      );
    }
  }

  /**
   * Static factory for tests / certification runner that don't run
   * the full Nest lifecycle.
   */
  static create(args: {
    router: IAgentRouter;
    store: IAgentRunStore;
    registry: AgentRegistry;
    audit: AuditSink;
    assertTenant: (tenantId: unknown) => string;
    executors: ReadonlyArray<IAgentExecutor>;
  }): IAgentRuntime {
    const runtime = new AgentRuntime(
      args.router,
      args.store,
      args.registry,
      args.audit,
      args.assertTenant,
      args.executors,
    );
    return runtime;
  }

  async run(
    req: AgentRunRequest,
    tenantCtx: TenantContext,
  ): Promise<AgentRunResult> {
    const tenantId = this.assertTenant(tenantCtx.tenantId);

    const route = this.router.resolve(req.intent, req.agentId);

    const startedAt = new Date();
    let record = await this.store.create({
      tenantId,
      agentId: route.agentId,
      intent: req.intent,
      actorUserId: tenantCtx.actorUserId,
      conversationId: req.conversationId,
      status: 'RUNNING',
      finalOutput: undefined,
      clarificationPrompt: undefined,
      clarificationSuggestions: [],
      evidence: [],
    });

    try {
      const executor = this.executors.get(route.agentId);
      if (!executor) {
        throw new AgentNotRegisteredError(route.agentId);
      }
      const outcome = await executor.execute({
        tenantId,
        actorUserId: tenantCtx.actorUserId,
        actorRole: tenantCtx.actorRole,
        intent: req.intent,
        message: req.message,
        conversationId: req.conversationId,
        skillInputs: req.skillInputs,
        explicitSkillKey: req.explicitSkillKey,
      });
      const evidence: ReadonlyArray<AgentRunEvidence> = [
        {
          skillKey: outcome.skillKey,
          confidence: outcome.confidence,
          citationsCount: outcome.citationsCount,
          durationMs: outcome.durationMs,
        },
      ];
      const status: AgentRunStatus = outcome.requiresApproval
        ? 'APPROVAL_REQUIRED'
        : 'COMPLETED';
      record = await this.store.update(
        record.id,
        {
          status,
          finalOutput: outcome.output,
          evidence: [...evidence],
        },
        tenantId,
      );
      await this.audit.record(record);
      await this.audit.evidence(record.id, evidence);
      return this.toResult(record, evidence, startedAt);
    } catch (err: unknown) {
      const status = this.classifyFailure(err);
      record = await this.store.update(
        record.id,
        {
          status,
          finalOutput:
            err instanceof Error ? err.message : 'unknown runtime error',
          clarificationPrompt:
            err instanceof AgentClarificationRequiredError
              ? err.message
              : undefined,
          clarificationSuggestions:
            err instanceof AgentClarificationRequiredError
              ? [...err.suggestions]
              : [],
        },
        tenantId,
      );
      await this.audit.record(record);
      if (status === 'CLARIFICATION_REQUIRED') {
        const clarification =
          err instanceof AgentClarificationRequiredError
            ? { prompt: err.message, suggestions: err.suggestions }
            : { prompt: 'Clarification required', suggestions: [] };
        return this.toResult(record, [], startedAt, clarification);
      }
      throw err;
    }
  }

  async get(runId: string, tenantCtx: TenantContext): Promise<AgentRunResult> {
    const tenantId = this.assertTenant(tenantCtx.tenantId);
    const record = await this.store.get(runId, tenantId);
    return this.toResult(record, record.evidence, new Date(record.createdAt));
  }

  async list(
    tenantCtx: TenantContext,
    opts?: { agentId?: AgentId; limit?: number },
  ): Promise<ReadonlyArray<AgentRunResult>> {
    const tenantId = this.assertTenant(tenantCtx.tenantId);
    const records = await this.store.list(tenantId, opts);
    return records.map((r) =>
      this.toResult(r, r.evidence, new Date(r.createdAt)),
    );
  }

  private classifyFailure(err: unknown): AgentRunStatus {
    if (err instanceof AgentClarificationRequiredError)
      return 'CLARIFICATION_REQUIRED';
    if (err instanceof AgentUnsupportedIntentError) return 'FAILED';
    if (err instanceof AgentNotRegisteredError) return 'FAILED';
    return 'FAILED';
  }

  private toResult(
    record: {
      id: string;
      agentId: string;
      status: AgentRunStatus;
      finalOutput: string | null;
      clarificationPrompt: string | null;
      clarificationSuggestions: ReadonlyArray<string>;
    },
    evidence: ReadonlyArray<AgentRunEvidence>,
    startedAt: Date,
    clarification?: { prompt: string; suggestions: ReadonlyArray<string> },
  ): AgentRunResult {
    return {
      runId: record.id,
      agentId: record.agentId as AgentId,
      status: record.status,
      finalOutput: record.finalOutput ?? undefined,
      clarification: clarification ?? {
        prompt: record.clarificationPrompt ?? '',
        suggestions: record.clarificationSuggestions,
      },
      evidence,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
    };
  }
}
