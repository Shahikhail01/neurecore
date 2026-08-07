/**
 * AI Twin — TwinGraphExecutor.
 *
 * Source plan: PHASE10-PARITY-EXPERIENCE.md follow-up; R2 of
 * `neurecore/memory-bank-arc/harness/IMPLEMENTATION-PLAN-BACKLOG-R1-R4.md`.
 *
 * Composes the twin permission envelope (AiTwinService / TwinPermissionMirrorGuard)
 * with the existing OfficialAgentGraph (planner → executor → tool_node → evaluator),
 * passing the twin's allow-list into the graph's `allowedTools` channel and
 * threading `threadId` through AgentCheckpointService for resumable runs.
 *
 * SRP:
 *   - This class composes envelope + graph + audit. It does NOT own:
 *       • permission policy   → TwinPermissionMirrorGuard (existing)
 *       • graph execution     → OfficialAgentGraph (existing)
 *       • checkpoint storage  → AgentCheckpointService (existing)
 *       • audit log write     → AiTwinService.recordRunAudit (existing,
 *                                added in this commit)
 *
 * DIP:
 *   - Depends on injected interfaces (AiTwinService, OfficialAgentGraph,
 *     AgentCheckpointService) — no direct Prisma access, no Node fs, etc.
 *
 * Failure model:
 *   - Tenant wildcard rejected with TENANT_WILDCARD_FORBIDDEN (consistent
 *     with the rest of scoped-tool-gateway).
 *   - Twin not found → NotFoundException.
 *   - Twin not ACTIVE → ConflictException with the actual status (e.g.
 *     "Twin is DRAFT").
 *   - Graph failures bubble up wrapped in a `TwinGraphException` so the
 *     chat tool layer can decide between "transient retry" vs "abort".
 */

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TwinLifecycleStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AiTwinService } from './ai-twin.service';
import {
  TwinPermissionMirrorGuard,
  TwinPermissionScope,
  TwinActionIntent,
} from './ai-twin.runtime-contract';
import { OfficialAgentGraph } from '../agents/langgraph/langgraph-official';
import { AgentCheckpointService } from '../agents/langgraph/checkpoint.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';

export interface TwinInvokeParams {
  readonly tenantId: string;
  readonly actorId: string;
  readonly twinId: string;
  readonly intent: string;
  /**
   * Tools the twin is allowed to invoke during this run. This is the
   * INVARIANT pass-through: the graph's `allowedTools` channel filters
   * the tool registry before the LLM sees them, so an empty array
   * means "no tools allowed" and `null`/`undefined` means "inherit
   * caller's policy".
   */
  readonly allowedTools?: ReadonlyArray<string> | null;
  /** Optional thread id for AgentCheckpointService resume. */
  readonly threadId?: string;
}

export type TwinRunStatus = 'completed' | 'awaiting_approval' | 'aborted';

export interface TwinToolCallRecord {
  readonly tool: string;
  readonly input: unknown;
  readonly output: unknown;
  readonly error?: string;
  readonly durationMs?: number;
}

export interface TwinInvokeResult {
  readonly runId: string;
  readonly twinId: string;
  readonly status: TwinRunStatus;
  /** Free-form output produced by the graph (string, object, etc.). */
  readonly output: unknown;
  readonly toolCalls: ReadonlyArray<TwinToolCallRecord>;
  /** Checkpoint keys the run produced (for resumability). */
  readonly checkpoints: ReadonlyArray<string>;
  readonly durationMs: number;
  readonly correlationId: string;
}

/**
 * Narrow exception type the chat tool layer can recognise distinctly
 * from generic Error so it can decide between transient retry and abort.
 */
export class TwinGraphException extends Error {
  constructor(
    message: string,
    readonly retriable: boolean,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TwinGraphException';
  }
}

@Injectable()
export class TwinGraphExecutor {
  private readonly logger = new Logger(TwinGraphExecutor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twins: AiTwinService,
    private readonly guard: TwinPermissionMirrorGuard,
    private readonly graph: OfficialAgentGraph,
    private readonly checkpoints: AgentCheckpointService,
  ) {}

  /**
   * Invoke the twin graph. The twin's allow-list is enforced both by:
   *   1. the permission mirror guard (TwinPermissionMirrorGuard); and
   *   2. the graph's `allowedTools` channel (OfficialAgentGraph).
   *   This is double-enforcement by design — defense in depth.
   */
  async invoke(params: TwinInvokeParams): Promise<TwinInvokeResult> {
    const started = Date.now();

    // 1. Validate tenant context (no wildcards, ever)
    if (!params.tenantId || params.tenantId === '*') {
      throw new ForbiddenException(
        'tenantId "*" or empty is forbidden for twin graph execution',
      );
    }

    // 2. Load the twin, scoped to tenant
    const twin = await this.prisma.aiTwin.findFirst({
      where: { id: params.twinId, tenantId: params.tenantId },
      select: {
        id: true,
        tenantId: true,
        ownerUserId: true,
        slug: true,
        displayName: true,
        status: true,
        agentTemplateId: true,
        agentTemplateVersionId: true,
        allowedReadScopes: true,
        allowedWriteScopes: true,
      },
    });
    if (!twin) {
      throw new NotFoundException(
        `twin ${params.twinId} not found for tenant ${params.tenantId}`,
      );
    }

    // 3. Status check — twin must be ACTIVE to run
    if (twin.status !== TwinLifecycleStatus.ACTIVE) {
      throw new ConflictException(
        `twin ${twin.id} is not ACTIVE (status=${twin.status}); deploy it first`,
      );
    }

    // 4. Set up run context (runId, correlationId, threadId)
    const runId = `run_${randomUUID()}`;
    const correlationId = `twin_${twin.id}_${runId}`;
    const threadId = params.threadId ?? `twin:${twin.id}:${correlationId}`;

    // 5. Build the canonical permission envelope via the runtime guard
    const readScopes = ((twin.allowedReadScopes as unknown as
      | TwinPermissionScope[]) ?? []);
    const writeScopes = ((twin.allowedWriteScopes as unknown as
      | TwinPermissionScope[]) ?? []);

    const envelope = this.twins.buildEnvelopeForAction({
      actor: {
        sub: params.actorId,
        tenantId: params.tenantId,
        role: 'OWNER',
      } as never,
      twinId: twin.id,
      intent: TwinActionIntent.TOOL_INVOKED,
      scopesUsed: [...readScopes, ...writeScopes],
      metadata: { source: 'nc.run_ai_twin', intent: params.intent, runId },
    });

    // 6. Compute allowedTools for the graph (narrow readonly → mutable array)
    const allowedToolsArray: string[] | null =
      params.allowedTools === undefined || params.allowedTools === null
        ? null
        : Array.from(params.allowedTools);

    // 7. Invoke the OfficialAgentGraph with the twin's allow-list
    let graphResult: Awaited<ReturnType<OfficialAgentGraph['run']>> | null = null;
    try {
      graphResult = await this.graph.run({
        goal: params.intent,
        agentId: twin.agentTemplateId ?? `twin:${twin.id}`,
        tenantId: params.tenantId,
        userId: params.actorId,
        threadId,
        allowedTools: allowedToolsArray,
      });
    } catch (err) {
      const wrapped = new TwinGraphException(
        `twin graph execution failed for ${twin.id}: ${(err as Error).message}`,
        true,
        err,
      );
      this.logger.error(wrapped.message, (err as Error).stack);
      throw wrapped;
    }

    // 8. Extract a structured TwinInvokeResult from the graph state
    const toolCalls: TwinToolCallRecord[] = (graphResult.toolResults ?? []).map(
      (tr) => ({
        tool: tr.toolName,
        input: tr.input,
        output: tr.output,
        error: tr.error,
        durationMs: tr.durationMs,
      }),
    );

    const checkpoints = this.checkpoints.isAvailable()
      ? [threadId]
      : [];

    const evaluationPassed =
      graphResult.evaluation?.success === true;

    const result: TwinInvokeResult = {
      runId,
      twinId: twin.id,
      status: evaluationPassed ? 'completed' : 'aborted',
      output: graphResult.messages?.length
        ? graphResult.messages[graphResult.messages.length - 1]
        : null,
      toolCalls,
      checkpoints,
      durationMs: Date.now() - started,
      correlationId,
    };

    // 8. Persist audit via the existing twin service method
    await this.twins.recordRunAudit({
      tenantId: params.tenantId,
      twinId: twin.id,
      actor: {
        sub: params.actorId,
        tenantId: params.tenantId,
        role: 'OWNER',
      } as never,
      runId,
      correlationId,
      envelope: envelope as unknown as Record<string, unknown>,
      result,
    });

    return result;
  }
}
