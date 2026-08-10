/**
 * WorkRuntimeService — the governed runtime orchestrator (ADR-003).
 *
 * Deterministic control flow: createRun → assemble context (Context Plane) →
 * plan (planner) → validate → persist steps → per-step [governance → approval
 * pause | execute] → verify → audit. Emits lifecycle events via the Event
 * Fabric. Consumes org context ONLY through the Context Plane. Executes ONLY
 * registered tools. Never makes autonomous business decisions.
 *
 * Fail-safe: unknown tools, malformed plans, missing identity, tenant mismatch,
 * stale/expired approvals → safe stop (FAILED/PAUSED), never permissive default.
 */

import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONTEXT_PLANE } from '../../context-plane/contracts/context-plane.interface';
import type { IOrganizationalContextPlane } from '../../context-plane/contracts/context-plane.interface';
import { EVENT_TRANSPORT } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import { ApprovalsService } from '../../governance/services/approvals.service';
import {
  TOOL_REGISTRY,
  WORK_PLANNER,
  RUNTIME_GOVERNANCE,
  type StepWithResult,
} from '../contracts/work-runtime.interface';
import type {
  CreateAndRunParams,
  IToolRegistry,
  IWorkPlanner,
  IWorkRuntime,
  IRuntimeGovernanceEvaluator,
  WorkRunStepView,
  WorkRunView,
  WorkPlan,
} from '../contracts/work-runtime.interface';
import { WorkRunRepository } from '../repository/work-run.repository';
import { WorkRunContextRepository } from '../persistence/work-run-context.repository';
import { ToolExecutor } from '../executor/tool-executor.service';

@Injectable()
export class WorkRuntimeService implements IWorkRuntime {
  private readonly logger = new Logger(WorkRuntimeService.name);

  constructor(
    private readonly repo: WorkRunRepository,
    private readonly contextRepo: WorkRunContextRepository,
    @Inject(CONTEXT_PLANE)
    private readonly contextPlane: IOrganizationalContextPlane,
    @Inject(WORK_PLANNER) private readonly planner: IWorkPlanner,
    @Inject(TOOL_REGISTRY) private readonly tools: IToolRegistry,
    @Inject(RUNTIME_GOVERNANCE)
    private readonly governance: IRuntimeGovernanceEvaluator,
    private readonly executor: ToolExecutor,
    private readonly approvals: ApprovalsService,
    @Inject(EVENT_TRANSPORT)
    private readonly transport: IEnterpriseEventTransport,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────

  async createRun(params: CreateAndRunParams): Promise<WorkRunView> {
    this.assertEmployeeRunMetadata(params);
    // 1. Assemble authorized org context (fail-safe DENIED if identity unresolved).
    // Context Plane resolves HUMAN vs AI_AGENT identity; SYSTEM actors are treated
    // as AI_AGENT for context resolution purposes.
    const contextActorType =
      params.actorType === 'HUMAN' ? 'HUMAN' : 'AI_AGENT';
    const assembled = await this.contextPlane.assemble({
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorType: contextActorType,
      scope: {
        projectId: params.scope?.projectId,
        customerId: params.scope?.customerId,
        includeCapabilities: params.scope?.includeCapabilities,
      },
    });

    // Provenance-only snapshot (no sensitive dumps).
    const provenance: Record<string, unknown> = {};
    for (const [cap, ctx] of Object.entries(assembled.capabilities)) {
      provenance[cap] = {
        provider: ctx.provider,
        access: ctx.authorization.access,
        policySource: ctx.authorization.policySource,
        fetchedAt: ctx.fetchedAt,
        unavailable: ctx.unavailable ?? false,
      };
    }

    const createInput = {
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorType: params.actorType,
      hermesAgentId: params.hermesAgentId ?? null,
      employeeId: params.employeeId ?? null,
      requestedByActorId: params.requestedByActorId ?? null,
      taskId: params.taskId ?? null,
      triggerType: params.triggerType ?? 'USER',
      triggerSourceId: params.triggerSourceId ?? null,
      idempotencyKey: params.idempotencyKey ?? null,
      parentRunId: params.parentRunId ?? null,
      workspaceId: params.workspaceId ?? null,
      threadId: params.threadId ?? null,
      request: params.request,
      contextProvenance: provenance,
    };
    const creation = params.idempotencyKey
      ? await this.repo.createOrGetByIdempotencyKey({
          ...createInput,
          idempotencyKey: params.idempotencyKey,
          employeeId: params.employeeId!,
          requestedByActorId: params.requestedByActorId!,
        })
      : { run: await this.repo.createRun(createInput), created: true };
    const run = creation.run;

    // Replays return the canonical row before snapshots, events, planning, or
    // effects can be duplicated. Phase 3 owns create-and-execute orchestration.
    if (!creation.created) return this.toRunView(run, true);

    const organizationSummary = this.summarize(assembled);
    organizationSummary._request = {
      projectId: params.scope?.projectId ?? null,
      customerId: params.scope?.customerId ?? null,
      taskId: params.taskId ?? null,
      fileIds: params.scope?.fileIds ?? [],
    };
    const policySource = Object.values(assembled.capabilities)
      .map((ctx) => ctx.authorization.policySource)
      .sort()
      .join(',');
    await this.contextRepo.save({
      workRunId: run.id,
      tenantId: params.tenantId,
      actorType: params.actorType,
      actorId: params.actorId,
      authority: assembled.authContext.effectiveAuthority,
      governanceBlocked: assembled.authContext.governanceBlocked,
      organizationSummary,
      policySource,
      planVersion: '1.0.0',
      toolRegistrationsVersion: '1.0.0',
    });
    await this.publish(
      'enterprise.workrun.context.snapshotted',
      run.id,
      params.tenantId,
      { runId: run.id, policySource },
      'context',
      0,
    );

    await this.publish('enterprise.workrun.created', run.id, params.tenantId, {
      runId: run.id,
      actorId: params.actorId,
      employeeId: params.employeeId ?? null,
    });

    return this.toRunView(run);
  }

  async execute(runId: string, tenantId: string): Promise<WorkRunView> {
    const run = await this.repo.findRun(runId, tenantId);
    if (!run) throw new Error('run not found for tenant'); // tenant isolation
    if (['COMPLETED', 'CANCELLED', 'FAILED'].includes(run.status)) {
      return this.toRunView(run);
    }

    const snapshot = await this.contextRepo.loadByRunId(tenantId, runId);
    if (!snapshot) return this.contextSnapshotBreach(runId, tenantId);
    const authority = snapshot.authority;
    const organizationSummary = snapshot.organizationSummary as Record<
      string,
      unknown
    >;

    // ── PLAN ──────────────────────────────────────────────────────────────
    if (run.status === 'CREATED') {
      await this.repo.updateRun(runId, tenantId, run.version, {
        status: 'PLANNING',
        startedAt: new Date(),
      });
      await this.publish('enterprise.workrun.started', runId, tenantId, {
        runId,
      });

      const authorizedTools = this.tools.listForAuthority(authority);
      let plan: WorkPlan;
      try {
        plan = await this.planner.plan({
          tenantId,
          actorId: run.actorId,
          request: run.request,
          authorizedTools,
          organizationSummary,
        });
      } catch (e) {
        return this.fail(
          runId,
          tenantId,
          'PLANNER_FAILED',
          e instanceof Error ? e.message : String(e),
        );
      }

      // Persist steps in sequence order.
      let seq = 1;
      for (const s of plan.steps) {
        const tool = this.tools.get(s.toolName);
        if (!tool) {
          return this.fail(
            runId,
            tenantId,
            'UNKNOWN_TOOL',
            `plan referenced unregistered tool ${s.toolName}`,
          );
        }
        await this.repo.createStep({
          runId,
          tenantId,
          sequence: seq,
          toolName: s.toolName,
          capability: tool.capability,
          operationType: tool.effect,
          input: s.input,
          idempotencyKey: `${tenantId}:${runId}:${s.id}:0`,
        });
        seq++;
      }

      const cur = await this.repo.findRun(runId, tenantId);
      await this.repo.updateRun(runId, tenantId, cur!.version, {
        status: 'PLANNED',
        plan,
        planVersion: 1,
      });
      await this.publish('enterprise.workrun.planned', runId, tenantId, {
        runId,
        stepCount: plan.steps.length,
      });
    }

    // ── RUN STEPS ─────────────────────────────────────────────────────────
    return this.runSteps(runId, tenantId);
  }

  async resume(runId: string, tenantId: string): Promise<WorkRunView> {
    const run = await this.repo.findRun(runId, tenantId);
    if (!run) throw new Error('run not found for tenant');
    if (run.status !== 'WAITING_FOR_APPROVAL' && run.status !== 'PAUSED') {
      return this.toRunView(run); // nothing to resume
    }
    const snapshot = await this.contextRepo.loadByRunId(tenantId, runId);
    if (!snapshot) return this.contextSnapshotBreach(runId, tenantId);
    await this.publish('enterprise.workrun.resumed', runId, tenantId, {
      runId,
    });
    return this.runSteps(runId, tenantId);
  }

  async cancel(
    runId: string,
    tenantId: string,
    reason: string,
  ): Promise<WorkRunView> {
    const run = await this.repo.findRun(runId, tenantId);
    if (!run) throw new Error('run not found for tenant');
    if (['COMPLETED', 'CANCELLED', 'FAILED'].includes(run.status))
      return this.toRunView(run);
    await this.repo.updateRun(runId, tenantId, run.version, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      failureReason: reason,
    });
    await this.publish('enterprise.workrun.cancelled', runId, tenantId, {
      runId,
      reason,
    });
    const after = await this.repo.findRun(runId, tenantId);
    return this.toRunView(after ?? run);
  }

  async getRun(runId: string, tenantId: string): Promise<WorkRunView | null> {
    const run = await this.repo.findRun(runId, tenantId);
    return run ? this.toRunView(run) : null;
  }

  async listRuns(
    tenantId: string,
    filter?: {
      employeeId?: string;
      status?: WorkRunView['status'];
      taskId?: string;
    },
  ): Promise<WorkRunView[]> {
    const runs = await this.repo.listRuns(tenantId, filter);
    return runs.map((run) => this.toRunView(run));
  }

  async getSteps(runId: string, tenantId: string): Promise<WorkRunStepView[]> {
    const steps = await this.repo.listSteps(runId, tenantId);
    return steps.map((s) => this.toStepView(s));
  }

  async getStepResults(
    runId: string,
    tenantId: string,
  ): Promise<StepWithResult[]> {
    const steps = await this.repo.listSteps(runId, tenantId);
    return steps.map((s) => ({
      ...this.toStepView(s),
      result: (s.result as Record<string, unknown> | null) ?? null,
    }));
  }

  // ── Step execution loop ───────────────────────────────────────────────────

  private async runSteps(
    runId: string,
    tenantId: string,
  ): Promise<WorkRunView> {
    const snapshot = await this.contextRepo.loadByRunId(tenantId, runId);
    if (!snapshot) return this.contextSnapshotBreach(runId, tenantId);
    const authority = snapshot.authority;
    const governanceBlocked = snapshot.governanceBlocked;
    const steps = await this.repo.listSteps(runId, tenantId);
    const runNow = await this.repo.findRun(runId, tenantId);
    await this.repo.updateRun(runId, tenantId, runNow!.version, {
      status: 'RUNNING',
    });

    for (const step of steps) {
      if (['SUCCEEDED', 'SKIPPED', 'CANCELLED', 'DENIED'].includes(step.status))
        continue;

      const tool = this.tools.get(step.toolName);
      if (!tool) {
        return this.fail(
          runId,
          tenantId,
          'UNKNOWN_TOOL',
          `step tool ${step.toolName} not registered`,
        );
      }

      // If this step already has a pending approval, check its state.
      if (step.status === 'WAITING_FOR_APPROVAL') {
        const decision = await this.checkApproval(
          step.approvalId,
          tenantId,
          runId,
          step.id,
          tool,
          step.input as Record<string, unknown>,
          snapshot.planVersion,
          snapshot.toolRegistrationsVersion,
        );
        if (decision === 'PENDING') {
          return this.pause(runId, tenantId); // still waiting
        }
        if (decision === 'REJECTED') {
          await this.repo.updateStep(step.id, tenantId, {
            status: 'DENIED',
            governanceReason: 'approval rejected',
          });
          return this.fail(
            runId,
            tenantId,
            'APPROVAL_REJECTED',
            `step ${step.sequence} approval rejected`,
          );
        }
        // APPROVED → re-evaluate governance before executing (context may have changed).
        await this.repo.updateStep(step.id, tenantId, { status: 'APPROVED' });
      }

      // Idempotency: if this business effect already succeeded, skip.
      if (step.idempotencyKey) {
        const done = await this.repo.findSucceededByIdempotencyKey(
          step.idempotencyKey,
          tenantId,
        );
        if (done && done.id !== step.id) {
          await this.repo.updateStep(step.id, tenantId, {
            status: 'SKIPPED',
            governanceReason: 'duplicate idempotency key already succeeded',
          });
          continue;
        }
      }

      // Governance evaluation (skip re-deny for already-approved steps but still gate).
      if (step.status !== 'APPROVED') {
        await this.repo.updateStep(step.id, tenantId, { status: 'VALIDATING' });
        const gov = await this.governance.evaluateStep({
          tenantId,
          actorId: (await this.repo.findRun(runId, tenantId))!.actorId,
          effectiveAuthority: authority,
          governanceBlocked,
          tool,
          input: step.input as Record<string, unknown>,
        });
        await this.repo.updateStep(step.id, tenantId, {
          governanceDecision: gov.outcome,
          governanceReason: gov.reason,
          policySource: gov.policySource,
        });

        if (gov.outcome === 'DENY') {
          await this.repo.updateStep(step.id, tenantId, { status: 'DENIED' });
          return this.fail(
            runId,
            tenantId,
            'GOVERNANCE_DENIED',
            `step ${step.sequence}: ${gov.reason}`,
          );
        }

        if (gov.outcome === 'REQUIRE_APPROVAL') {
          const canonicalInputHash = this.canonicalInputHash(
            step.input as Record<string, unknown>,
          );
          const approval = await this.approvals.create({
            title: `Work Runtime step: ${step.toolName}`,
            resourceType: 'WORK_RUN_STEP',
            resourceId: step.id,
            payload: {
              runId,
              sequence: step.sequence,
              toolName: step.toolName,
              canonicalInputHash,
              policyVersion: gov.policyVersion,
              toolRegistrationsVersion: gov.toolRegistrationsVersion,
            },
            tenantId,
            requestedById: (await this.repo.findRun(runId, tenantId))!.actorId,
          });
          await this.repo.updateStep(step.id, tenantId, {
            status: 'WAITING_FOR_APPROVAL',
            approvalId: (approval as { id: string }).id,
          });
          await this.publish(
            'enterprise.workrun.approval.requested',
            runId,
            tenantId,
            {
              runId,
              stepId: step.id,
              approvalId: (approval as { id: string }).id,
            },
          );
          return this.pause(runId, tenantId);
        }
      }

      // ── EXECUTE (ALLOW or APPROVED) ───────────────────────────────────────
      const claimed = await this.repo.claimStep(step.id, tenantId, [
        'PENDING',
        'VALIDATING',
        'APPROVED',
      ]);
      if (!claimed) {
        // Another worker claimed it; skip to avoid duplicate execution.
        continue;
      }
      await this.publish(
        'enterprise.workrun.step.started',
        runId,
        tenantId,
        { runId, stepId: step.id },
        step.id,
        step.attemptCount,
      );

      const run = await this.repo.findRun(runId, tenantId);
      const result = await this.executor.execute(
        tool,
        step.input as Record<string, unknown>,
        {
          tenantId,
          actorId: run!.actorId,
          actorType: run!.actorType as 'HUMAN' | 'AI_AGENT' | 'SYSTEM',
          runId,
          stepId: step.id,
        },
      );

      if (result.ok) {
        await this.repo.updateStep(step.id, tenantId, {
          status: 'SUCCEEDED',
          result: result.data ?? {},
          completedAt: new Date(),
        });
        await this.publish(
          'enterprise.workrun.step.succeeded',
          runId,
          tenantId,
          { runId, stepId: step.id },
          step.id,
          step.attemptCount,
        );
      } else {
        const attempt = step.attemptCount + 1;
        await this.repo.updateStep(step.id, tenantId, {
          attemptCount: attempt,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        });
        if (result.retryable && attempt < tool.maxRetries) {
          // Reset to PENDING for a bounded retry on the next execute() pass.
          await this.repo.updateStep(step.id, tenantId, { status: 'PENDING' });
          return this.pause(runId, tenantId, 'retry pending');
        }
        await this.repo.updateStep(step.id, tenantId, {
          status: 'FAILED',
          completedAt: new Date(),
        });
        await this.publish(
          'enterprise.workrun.step.failed',
          runId,
          tenantId,
          {
            runId,
            stepId: step.id,
            errorCode: result.errorCode,
          },
          step.id,
          attempt,
        );
        return this.fail(
          runId,
          tenantId,
          result.errorCode ?? 'STEP_FAILED',
          result.errorMessage ?? 'step failed',
        );
      }
    }

    // All steps done → complete.
    const finalRun = await this.repo.findRun(runId, tenantId);
    const summary = this.buildSummary(
      await this.repo.listSteps(runId, tenantId),
    );
    await this.repo.updateRun(runId, tenantId, finalRun!.version, {
      status: 'COMPLETED',
      completedAt: new Date(),
      summary,
    });
    await this.publish('enterprise.workrun.completed', runId, tenantId, {
      runId,
    });
    return this.toRunView((await this.repo.findRun(runId, tenantId))!);
  }

  private async checkApproval(
    approvalId: string | null,
    tenantId: string,
    runId: string,
    stepId: string,
    tool: { name: string },
    input: Record<string, unknown>,
    planVersion: string,
    toolRegistrationsVersion: string,
  ): Promise<'PENDING' | 'APPROVED' | 'REJECTED'> {
    if (!approvalId) {
      this.logApprovalMismatch(runId, stepId, 'APPROVAL_ID_MISSING');
      return 'REJECTED';
    }

    let approval: Awaited<ReturnType<ApprovalsService['findOne']>>;
    try {
      approval = await this.approvals.findOne(approvalId, tenantId);
    } catch {
      this.logApprovalMismatch(runId, stepId, 'APPROVAL_NOT_FOUND');
      return 'REJECTED';
    }

    if (approval.expiresAt && approval.expiresAt.getTime() <= Date.now()) {
      this.logApprovalMismatch(runId, stepId, 'APPROVAL_EXPIRED');
      return 'REJECTED';
    }
    if (approval.status !== 'APPROVED') {
      return approval.status === 'PENDING' ? 'PENDING' : 'REJECTED';
    }

    const payload = approval.payload as Record<string, unknown>;
    const expectedHash = this.canonicalInputHash(input);
    const mismatch =
      payload.toolName !== tool.name ||
      payload.canonicalInputHash !== expectedHash ||
      (payload.policyVersion !== undefined &&
        payload.policyVersion !== planVersion) ||
      (payload.toolRegistrationsVersion !== undefined &&
        payload.toolRegistrationsVersion !== toolRegistrationsVersion);
    if (mismatch) {
      this.logApprovalMismatch(runId, stepId, 'APPROVAL_PAYLOAD_MISMATCH');
      return 'REJECTED';
    }

    this.logger.log(
      JSON.stringify({
        marker: 'WORK_RUN_APPROVAL_REVALIDATED',
        runId,
        stepId,
        approvalId,
      }),
    );
    return 'APPROVED';
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private canonicalInputHash(input: Record<string, unknown>): string {
    const canonicalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(canonicalize);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonicalize(item)]),
        );
      }
      return value;
    };
    return createHash('sha256')
      .update(JSON.stringify(canonicalize(input)))
      .digest('hex');
  }

  private assertEmployeeRunMetadata(params: CreateAndRunParams): void {
    const hasEmployeeMetadata = [
      params.employeeId,
      params.requestedByActorId,
      params.taskId,
      params.triggerSourceId,
      params.idempotencyKey,
      params.parentRunId,
    ].some((value) => value !== undefined && value !== null);
    if (!hasEmployeeMetadata) return;

    if (
      !params.employeeId ||
      !params.requestedByActorId ||
      !params.idempotencyKey
    ) {
      throw new Error(
        'employeeId, requestedByActorId, and idempotencyKey are required for Employee-aware WorkRuns',
      );
    }
    if (
      params.actorType !== 'AI_AGENT' ||
      params.actorId !== params.employeeId
    ) {
      throw new Error(
        'Employee-aware WorkRuns must execute as the selected AI employee',
      );
    }
    const triggerType = params.triggerType ?? 'USER';
    if (
      !['USER', 'TASK', 'SCHEDULE', 'EVENT', 'MISSION'].includes(triggerType)
    ) {
      throw new Error(`unsupported Employee run trigger: ${triggerType}`);
    }
  }

  private logApprovalMismatch(
    runId: string,
    stepId: string,
    code: string,
  ): void {
    this.logger.warn(
      JSON.stringify({
        marker: 'WORK_RUN_APPROVAL_REVALIDATION_FAILED',
        runId,
        stepId,
        code,
      }),
    );
  }

  private summarize(assembled: {
    capabilities: Record<
      string,
      {
        authorization: { access: string };
        data: Record<string, unknown>;
        unavailable?: boolean;
      }
    >;
  }): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [cap, ctx] of Object.entries(assembled.capabilities)) {
      out[cap] = {
        access: ctx.authorization.access,
        unavailable: ctx.unavailable ?? false,
        data: ctx.authorization.access === 'DENIED' ? '[DENIED]' : ctx.data,
      };
    }
    return out;
  }

  private async contextSnapshotBreach(
    runId: string,
    tenantId: string,
  ): Promise<WorkRunView> {
    const reason = 'context snapshot missing; restart-persistence breach';
    const run = await this.repo.findRun(runId, tenantId);
    if (run && !['COMPLETED', 'CANCELLED', 'FAILED'].includes(run.status)) {
      await this.repo.updateRun(runId, tenantId, run.version, {
        status: 'PAUSED',
        pausedAt: new Date(),
        failureCode: 'WORK_RUN_CONTEXT_SNAPSHOT_MISSING',
        failureReason: reason,
      });
    }
    await this.publish(
      'enterprise.workrun.paused',
      runId,
      tenantId,
      {
        runId,
        failureCode: 'WORK_RUN_CONTEXT_SNAPSHOT_MISSING',
        reason,
      },
      'context-breach',
      0,
    );
    return this.toRunView((await this.repo.findRun(runId, tenantId))!);
  }

  private async pause(
    runId: string,
    tenantId: string,
    reason?: string,
  ): Promise<WorkRunView> {
    const run = await this.repo.findRun(runId, tenantId);
    const status =
      run!.status === 'RUNNING' && reason === 'retry pending'
        ? 'PAUSED'
        : 'WAITING_FOR_APPROVAL';
    await this.repo.updateRun(runId, tenantId, run!.version, {
      status,
      pausedAt: new Date(),
    });
    await this.publish('enterprise.workrun.paused', runId, tenantId, {
      runId,
      reason: reason ?? 'awaiting approval',
    });
    return this.toRunView((await this.repo.findRun(runId, tenantId))!);
  }

  private async fail(
    runId: string,
    tenantId: string,
    code: string,
    reason: string,
  ): Promise<WorkRunView> {
    const run = await this.repo.findRun(runId, tenantId);
    if (run && !['COMPLETED', 'CANCELLED', 'FAILED'].includes(run.status)) {
      await this.repo.updateRun(runId, tenantId, run.version, {
        status: 'FAILED',
        failedAt: new Date(),
        failureCode: code,
        failureReason: reason,
      });
    }
    await this.publish('enterprise.workrun.failed', runId, tenantId, {
      runId,
      failureCode: code,
    });
    return this.toRunView((await this.repo.findRun(runId, tenantId))!);
  }

  private buildSummary(
    steps: Array<{ status: string; toolName: string }>,
  ): string {
    const ok = steps.filter((s) => s.status === 'SUCCEEDED').length;
    return `Completed ${ok}/${steps.length} steps: ${steps.map((s) => `${s.toolName}(${s.status})`).join(', ')}`;
  }

  private async publish(
    eventType: string,
    runId: string,
    tenantId: string,
    payload: Record<string, unknown>,
    stepId = 'run',
    attempt = 0,
  ): Promise<void> {
    try {
      const eventRun = (await this.repo.findRun(runId, tenantId)) as {
        employeeId?: string | null;
      } | null;
      const employeeId = eventRun?.employeeId ?? null;
      await this.transport.publish({
        eventType,
        tenantId,
        actorType: 'SYSTEM',
        idempotencyKey: `${tenantId}:${runId}:${stepId}:${attempt}`,
        sourceModule: 'work-runtime',
        payload: { ...payload, employeeId },
      });
    } catch (e) {
      this.logger.warn(
        `Failed to publish ${eventType}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  private toRunView(
    run: {
      id: string;
      tenantId: string;
      actorId: string;
      actorType: string;
      employeeId?: string | null;
      requestedByActorId?: string | null;
      taskId?: string | null;
      triggerType?: string;
      triggerSourceId?: string | null;
      parentRunId?: string | null;
      status: string;
      request: string;
      currentStepIndex: number;
      planVersion: number;
      summary: string | null;
      failureCode: string | null;
      failureReason: string | null;
      createdAt: Date;
      startedAt?: Date | null;
      completedAt?: Date | null;
    },
    isReplay = false,
  ): WorkRunView {
    return {
      id: run.id,
      tenantId: run.tenantId,
      actorId: run.actorId,
      actorType: run.actorType as WorkRunView['actorType'],
      employeeId: run.employeeId ?? null,
      requestedByActorId: run.requestedByActorId ?? null,
      taskId: run.taskId ?? null,
      triggerType: run.triggerType ?? 'USER',
      triggerSourceId: run.triggerSourceId ?? null,
      parentRunId: run.parentRunId ?? null,
      status: run.status as WorkRunView['status'],
      request: run.request,
      currentStepIndex: run.currentStepIndex,
      planVersion: run.planVersion,
      summary: run.summary,
      failureCode: run.failureCode,
      failureReason: run.failureReason,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      isReplay,
    };
  }

  private toStepView(s: {
    id: string;
    sequence: number;
    toolName: string;
    capability: string;
    operationType: string;
    status: string;
    governanceDecision: string | null;
    governanceReason: string | null;
    policySource: string | null;
    approvalId: string | null;
    attemptCount: number;
    errorCode: string | null;
  }): WorkRunStepView {
    return {
      id: s.id,
      sequence: s.sequence,
      toolName: s.toolName,
      capability: s.capability,
      operationType: s.operationType as WorkRunStepView['operationType'],
      status: s.status as WorkRunStepView['status'],
      governanceDecision: s.governanceDecision,
      governanceReason: s.governanceReason,
      policySource: s.policySource,
      approvalId: s.approvalId,
      attemptCount: s.attemptCount,
      errorCode: s.errorCode,
    };
  }
}
