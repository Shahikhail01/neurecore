// src/modules/assignments/application/assignment.service.ts
// Phase 4 / plan §6.2 — Task-to-AI Assignment service.
//
// Owns: eligibility filtering, deterministic scoring, transactional
// task↔agent linkage with optimistic concurrency, release / reassign
// lifecycle, override attribution, and audit + outbox emission.
//
// This service is itself the AssignTaskCommand + ReleaseAssignmentCommand
// handler so the CommandRegistry can drive it through the authoritative
// path documented in §6.2.

import {
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { CommandMetadata } from '../../../common/correlation/correlation.interface';
import type { CommandHandlerFn, CommandResult } from '../../../common/commands/command.interface';
import type { IUnitOfWork } from '../../../common/ports/transaction.interface';
import { UNIT_OF_WORK } from '../../../common/ports/transaction.interface';
import type { ITaskRepository } from '../../../common/ports/task-repository.port';
import { TASK_REPOSITORY } from '../../../common/ports/task-repository.port';
import type { IAuditRepository } from '../../../common/ports/audit.port';
import { AUDIT_REPOSITORY } from '../../../common/ports/audit.port';
import type { IOutboxRepository } from '../../../common/outbox/outbox-repository.port';
import { OUTBOX_REPOSITORY } from '../../../common/outbox/outbox-repository.port';
import { TenantFlagsService, FeatureFlag } from '../../tenant-flags/tenant-flags.service';
import type {
  AgentDataClassification,
  ScoredAgent,
} from '../domain/agent-capability';
import {
  scoreAgent,
  getActiveScoringPolicy,
  tieBreak,
} from '../domain/agent-capability';
import type {
  AgentEntity,
  AgentWorkload,
  AssignmentStatusForCapacity,
  IAgentRepository,
} from '../domain/ports/agent-repository.port';
import { AGENT_REPOSITORY } from '../domain/ports/agent-repository.port';
import type { ITaskAssignmentRepository } from '../domain/ports/task-assignment-repository.port';
import { TASK_ASSIGNMENT_REPOSITORY } from '../domain/ports/task-assignment-repository.port';
import { TaskStateMachine } from '../../tasks/domain/task-states';
import {
  AssignTaskInput,
  AssignTaskResult,
} from '../commands/assign-task.command';
import {
  ReleaseAssignmentInput,
  ReleaseAssignmentResult,
} from '../commands/release-assignment.command';

const DEFAULT_EXPIRES_IN_SECONDS = 8 * 60 * 60;

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(TASK_REPOSITORY) private readonly taskRepo: ITaskRepository,
    @Inject(AGENT_REPOSITORY) private readonly agentRepo: IAgentRepository,
    @Inject(TASK_ASSIGNMENT_REPOSITORY)
    private readonly taskAssignmentRepo: ITaskAssignmentRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepo: IOutboxRepository,
    @Optional() private readonly tenantFlags?: TenantFlagsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  //  Eligibility + scoring
  // ─────────────────────────────────────────────────────────────────────

  async findEligibleAgents(input: {
    tenantId: string;
    requiredRole: string | null;
    requiredCapabilities: string[];
    departmentId?: string;
    dataClassification?: AgentDataClassification;
  }): Promise<ScoredAgent[]> {
    const agents = await this.agentRepo.findEligible(input.tenantId, {
      departmentId: input.departmentId ?? null,
      role: input.requiredRole ?? null,
      requiredCapabilities: input.requiredCapabilities,
      dataClassification: input.dataClassification,
    });

    if (agents.length === 0) return [];

    const agentIds = agents.map((a) => a.id);
    const workloads = await this.agentRepo.loadWorkloads(
      input.tenantId,
      agentIds,
      ['QUEUED', 'IN_PROGRESS'] as AssignmentStatusForCapacity[],
    );
    const performance = await this.agentRepo.loadPerformance(
      input.tenantId,
      agentIds,
      20,
    );

    const byWorkload = new Map(workloads.map((w) => [w.agentId, w]));
    const byPerformance = new Map(performance.map((p) => [p.agentId, p]));

    const scored: Array<ScoredAgent & { availability: string }> = [];
    for (const agent of agents) {
      const w = byWorkload.get(agent.id);
      const p = byPerformance.get(agent.id);
      if (!w) continue;
      if (
        typeof agent.maxConcurrency === 'number' &&
        w.activeCount >= agent.maxConcurrency
      ) {
        continue;
      }
      const filteredFilter = {
        tenantId: input.tenantId,
        requiredRole: input.requiredRole,
        requiredCapabilities: input.requiredCapabilities,
        departmentConstraint: input.departmentId ?? null,
        dataClassification: input.dataClassification,
      };
      const eligible: import('../domain/agent-capability').AgentCapability = {
        agentId: agent.id,
        tenantId: agent.tenantId,
        name: agent.name,
        role: agent.role,
        specializations: agent.capabilities,
        permissions: agent.permissions,
        maxConcurrency: agent.maxConcurrency ?? 0,
        currentWorkload: w.activeCount,
        availability: agent.availability ?? 'AVAILABLE',
        archived: agent.archived,
        dataClassification: agent.dataClassification,
        departmentId: agent.departmentId,
      };
      const sc = scoreAgent(
        eligible,
        filteredFilter,
        p?.successRate ?? 0,
        {
          activeCount: w.activeCount,
          inProgressCount: w.inProgressCount,
          queuedCount: w.queuedCount,
          blockedCount: w.blockedCount,
          historicalSuccessRate: p?.successRate ?? 0,
        },
        getActiveScoringPolicy(),
      );
      scored.push({ ...sc, availability: agent.availability ?? 'AVAILABLE' });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aAgent: import('../domain/agent-capability').AgentCapability = {
        agentId: a.agentId,
        tenantId: input.tenantId,
        name: a.name,
        role: null,
        specializations: [],
        permissions: [],
        maxConcurrency: 0,
        currentWorkload: a.currentWorkload,
        availability: a.availability as any,
        archived: false,
        dataClassification: 'INTERNAL',
        departmentId: null,
      };
      const bAgent: import('../domain/agent-capability').AgentCapability = {
        ...aAgent,
        agentId: b.agentId,
        currentWorkload: b.currentWorkload,
        availability: b.availability as any,
      };
      return tieBreak(aAgent, bAgent);
    });

    return scored.map((s) => {
      const { availability, ...rest } = s;
      void availability;
      return rest;
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Command handlers
  // ─────────────────────────────────────────────────────────────────────

  handleAssign: CommandHandlerFn<AssignTaskInput, AssignTaskResult> = async (
    input,
    metadata,
  ) => this.executeAssign(input, metadata);

  async executeAssign(
    input: AssignTaskInput,
    metadata: CommandMetadata,
  ): Promise<CommandResult<AssignTaskResult>> {
    return this.uow.execute(async (tx) => {
      const task = await this.taskRepo.findById(input.tenantId, input.taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      if (task.tenantId !== input.tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }

      // Dedup: if the task already has an ACTIVE assignment at the same
      // agent AND the request is auto-assign (no explicit agentId), the
      // command is a replay and we return the prior result. Manual
      // override always proceeds so the override audit row is recorded.
      // The state machine guard runs after this so a closed-state
      // task (COMPLETED / CANCELLED) cannot be silently re-assigned.
      const replayMode =
        !input.agentId && task.agentId !== null;
      if (replayMode) {
        const existing = await this.taskAssignmentRepo.findLatestActive(
          input.tenantId,
          input.taskId,
          tx,
        );
        if (existing && existing.agentId === task.agentId) {
          return {
            success: true,
            data: {
              assignmentId: existing.id,
              taskId: existing.taskId,
              agentId: existing.agentId,
              generation: existing.generation,
              rationale: existing.rationale,
              policyVersion: this.extractPolicyVersion(existing.rationale),
              manualOverride: false,
              expiresAt: existing.expiresAt?.toISOString() ?? null,
              newTaskVersion: task.version,
              capabilityScore: 0,
              workloadScore: 0,
              departmentScore: 0,
              historicalScore: 0,
              totalScore: 0,
              alternatives: [],
            },
            correlationId: metadata.correlationId,
            occurredAt: new Date(),
            deduplicated: true,
          };
        }
      }

      // Reject re-assignment of closed tasks so the dedup replay path
      // can never resurrect COMPLETED / CANCELLED rows. Plan §6.5 —
      // "Assignment persists consistently across views".
      TaskStateMachine.assertTransition(task.status as any, 'ASSIGNED');

      let scored: ScoredAgent;
      let manualOverride = false;
      let preview: AgentDataClassification | null = null;

      const capabilities =
        input.requiredCapabilities ?? task.requiredCapabilities ?? [];
      const requiredRole =
        input.requiredRole ?? task.requiredRole ?? null;
      const dataClassification =
        (input.dataClassification as AgentDataClassification | undefined) ??
        (task.dataClassification as AgentDataClassification | undefined) ??
        'INTERNAL';

      let chosenAgentId: string;
      let chosenAgentWorkload: AgentWorkload | null = null;
      let alternativesList: AssignTaskResult['alternatives'] = [];

      // Gate the auto-assign path behind the tenant-scoped AUTO_ASSIGNMENT
      // flag. Plan §6.1 — manual override is independent of this flag.
      if (!(input.agentId && input.manualOverrideRationale)) {
        const autoEnabled =
          (await this.tenantFlags?.isEnabled(
            FeatureFlag.AUTO_ASSIGNMENT,
            input.tenantId,
          )) ?? false;
        if (!autoEnabled) {
          throw new Error('AUTO_ASSIGNMENT_DISABLED');
        }
      }

      if (input.agentId && input.manualOverrideRationale) {
        const overrideAgent = await this.agentRepo.findById(
          input.tenantId,
          input.agentId,
        );
        if (!overrideAgent) {
          throw new Error('AGENT_NOT_FOUND');
        }
        if (overrideAgent.tenantId !== input.tenantId) {
          throw new Error('CROSS_TENANT_ACCESS_DENIED');
        }
        if (overrideAgent.archived || !overrideAgent.availability) {
          throw new Error('AGENT_NOT_AVAILABLE');
        }
        preview = overrideAgent.dataClassification;
        // Re-check workload inside the transaction so a concurrent
        // assigner that consumed the last slot between the eligibility
        // scan and now cannot oversubscribe the agent.
        const overrideWorkloads = await this.agentRepo.loadWorkloads(
          input.tenantId,
          [overrideAgent.id],
          ['ASSIGNED', 'QUEUED', 'IN_PROGRESS', 'BLOCKED'] as AssignmentStatusForCapacity[],
        );
        const ow =
          overrideWorkloads[0] ?? {
            agentId: overrideAgent.id,
            activeCount: 0,
            assignedCount: 0,
            queuedCount: 0,
            inProgressCount: 0,
            blockedCount: 0,
          };
        chosenAgentWorkload = {
          agentId: overrideAgent.id,
          activeCount: ow.activeCount,
          assignedCount: ow.assignedCount,
          queuedCount: ow.queuedCount,
          inProgressCount: ow.inProgressCount,
          blockedCount: ow.blockedCount,
        };
        if (
          typeof overrideAgent.maxConcurrency === 'number' &&
          overrideAgent.maxConcurrency > 0 &&
          ow.activeCount >= overrideAgent.maxConcurrency
        ) {
          throw new Error('AGENT_AT_MAX_CONCURRENCY');
        }
        const overrideScore = scoreAgent(
          {
            agentId: overrideAgent.id,
            tenantId: overrideAgent.tenantId,
            name: overrideAgent.name,
            role: overrideAgent.role,
            specializations: overrideAgent.capabilities,
            permissions: overrideAgent.permissions,
            maxConcurrency: overrideAgent.maxConcurrency ?? 0,
            currentWorkload: ow.activeCount,
            availability: overrideAgent.availability ?? 'AVAILABLE',
            archived: overrideAgent.archived,
            dataClassification: overrideAgent.dataClassification,
            departmentId: overrideAgent.departmentId,
          },
          {
            tenantId: input.tenantId,
            requiredRole,
            requiredCapabilities: capabilities,
            departmentConstraint: input.departmentId ?? null,
            dataClassification,
          },
          0,
          {
            activeCount: ow.activeCount,
            inProgressCount: ow.inProgressCount,
            queuedCount: ow.queuedCount,
            blockedCount: ow.blockedCount,
            historicalSuccessRate: 0,
          },
          getActiveScoringPolicy(),
        );
        scored = {
          agentId: overrideAgent.id,
          name: overrideAgent.name,
          score: overrideScore.score,
          rationale: `manual override: ${input.manualOverrideRationale}`,
          currentWorkload: ow.activeCount,
          capabilityScore: overrideScore.capabilityScore,
          workloadScore: overrideScore.workloadScore,
          departmentScore: overrideScore.departmentScore,
          historicalScore: overrideScore.historicalScore,
          policyVersion: getActiveScoringPolicy().version,
        };
        chosenAgentId = overrideAgent.id;
        manualOverride = true;
      } else {
        const candidates = await this.findEligibleAgents({
          tenantId: input.tenantId,
          requiredRole,
          requiredCapabilities: capabilities,
          departmentId: input.departmentId,
          dataClassification,
        });
        if (candidates.length === 0) {
          throw new Error('NO_ELIGIBLE_AI_EMPLOYEE');
        }
        const top = candidates[0];
        // Re-resolve the chosen agent inside the transaction so a
        // concurrent assigner that consumed the last slot cannot
        // oversubscribe. The eligibility scan already filtered on
        // capacity, but a write between scan and commit could tip the
        // agent over the edge — re-check here.
        const chosenAgent = await this.agentRepo.findById(
          input.tenantId,
          top.agentId,
        );
        if (!chosenAgent || chosenAgent.archived || !chosenAgent.availability) {
          throw new Error('AGENT_NOT_AVAILABLE');
        }
        const chosenWorkloads = await this.agentRepo.loadWorkloads(
          input.tenantId,
          [chosenAgent.id],
          ['ASSIGNED', 'QUEUED', 'IN_PROGRESS', 'BLOCKED'] as AssignmentStatusForCapacity[],
        );
        const cw = chosenWorkloads[0] ?? {
          agentId: chosenAgent.id,
          activeCount: 0,
          assignedCount: 0,
          queuedCount: 0,
          inProgressCount: 0,
          blockedCount: 0,
        };
        chosenAgentWorkload = {
          agentId: chosenAgent.id,
          activeCount: cw.activeCount,
          assignedCount: cw.assignedCount,
          queuedCount: cw.queuedCount,
          inProgressCount: cw.inProgressCount,
          blockedCount: cw.blockedCount,
        };
        if (
          typeof chosenAgent.maxConcurrency === 'number' &&
          chosenAgent.maxConcurrency > 0 &&
          cw.activeCount >= chosenAgent.maxConcurrency
        ) {
          throw new Error('AGENT_AT_MAX_CONCURRENCY');
        }
        scored = top;
        chosenAgentId = chosenAgent.id;
        alternativesList = candidates.map((c) => ({
          agentId: c.agentId,
          agentName: c.name,
          score: c.score,
          rationale: c.rationale,
          policyVersion: c.policyVersion,
        }));
      }

      // Light unused-vars hint for the analyzer — these are read by
      // upstream diagnostics and the next-step outbox payload builder.
      void chosenAgentWorkload;

      const lifecycle = input.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS;
      const expiresAt =
        Number.isFinite(lifecycle) && lifecycle > 0
          ? new Date(Date.now() + lifecycle * 1000)
          : null;

      const previousAgentId = task.agentId ?? null;

      // Race protection: two concurrent assigners on the same task can
      // both compute the same nextGeneration before either commits. The
      // (tenantId, taskId, generation) unique constraint catches the
      // duplicate. Retry up to MAX_GENERATION_RETRIES with a fresh
      // generation scan between attempts.
      const MAX_GENERATION_RETRIES = 4;
      let assignment: Awaited<
        ReturnType<typeof this.taskAssignmentRepo.create>
      >;
      let attempts = 0;
      let generation = 0;
      // The assigner is supposed to pick a fresh `generation` per commit.
      // `attempt` guards against pathological livelocks.
      for (;;) {
        attempts++;
        generation = await this.nextGeneration(
          input.tenantId,
          input.taskId,
          tx,
        );
        try {
          assignment = await this.taskAssignmentRepo.create(
            {
              tenantId: input.tenantId,
              taskId: input.taskId,
              agentId: scored.agentId,
              generation,
              rationale: scored.rationale,
              status: 'ACTIVE',
              expiresAt,
            },
            tx,
          );
          break;
        } catch (e: any) {
          if (e?.code === 'P2002' && attempts < MAX_GENERATION_RETRIES) {
            // Concurrent assigner beat us to this generation. Re-scan
            // and try the next one.
            continue;
          }
          throw e;
        }
      }
      void attempts;

      await this.taskRepo.updateAssignment(
        {
          id: input.taskId,
          expectedVersion: task.version,
          agentId: scored.agentId,
          status: 'ASSIGNED' as any,
        },
        tx,
      );

      if (manualOverride) {
        await this.taskAssignmentRepo.recordOverrideAudit(
          {
            tenantId: input.tenantId,
            taskId: input.taskId,
            agentId: scored.agentId,
            assignmentGeneration: generation,
            previousAgentId,
            rationale: input.manualOverrideRationale as string,
            overrideByActorId:
              input.overrideByActorId ?? metadata.actorId ?? 'SYSTEM',
            overrideByActorType:
              input.overrideByActorType ?? metadata.actorType ?? 'HUMAN',
            dataClassificationAtOverride: preview,
          },
          tx,
        );
      }

      await this.auditRepo.record(
        {
          tenantId: input.tenantId,
          actor:
            input.overrideByActorId ??
            metadata.actorId ??
            'SYSTEM',
          action: manualOverride
            ? 'TASK_ASSIGNMENT_OVERRIDDEN'
            : 'TASK_AUTO_ASSIGNED',
          resource: 'TaskAssignment',
          resourceId: assignment.id,
          correlationId: metadata.correlationId,
          causationId: metadata.causationId ?? undefined,
          result: 'success',
        },
        tx,
      );

      const outboxId = await this.outboxRepo.publish(
        {
          tenantId: input.tenantId,
          eventType: 'TaskAssigned',
          sourceModule: 'assignments',
          payload: {
            taskId: input.taskId,
            assignmentId: assignment.id,
            agentId: scored.agentId,
            generation,
            manualOverride,
            policyVersion: scored.policyVersion,
            rationale: scored.rationale,
            expiresAt: expiresAt?.toISOString() ?? null,
          },
          correlationId: metadata.correlationId,
          causationId: metadata.causationId,
          idempotencyKey: `task-assigned:${input.taskId}:${generation}`,
          actorId:
            input.overrideByActorId ??
            metadata.actorId ??
            'SYSTEM',
          actorType:
            input.overrideByActorType ?? metadata.actorType ?? 'HUMAN',
        },
        tx,
      );

return {
        success: true,
        data: {
          assignmentId: assignment.id,
          taskId: input.taskId,
          agentId: scored.agentId,
          generation,
          rationale: scored.rationale,
          policyVersion: scored.policyVersion,
          manualOverride,
          expiresAt: expiresAt?.toISOString() ?? null,
          newTaskVersion: task.version + 1,
          capabilityScore: scored.capabilityScore,
          workloadScore: scored.workloadScore,
          departmentScore: scored.departmentScore,
          historicalScore: scored.historicalScore,
          totalScore: scored.score,
          alternatives: alternativesList,
        },
        correlationId: metadata.correlationId,
        occurredAt: new Date(),
      };
    });
  }

  handleRelease: CommandHandlerFn<ReleaseAssignmentInput, ReleaseAssignmentResult> =
    async (input, metadata) => this.executeRelease(input, metadata);

  async executeRelease(
    input: ReleaseAssignmentInput,
    metadata: CommandMetadata,
  ): Promise<CommandResult<ReleaseAssignmentResult>> {
    return this.uow.execute(async (tx) => {
      const task = await this.taskRepo.findById(input.tenantId, input.taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      if (task.tenantId !== input.tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }

      const active = await this.taskAssignmentRepo.findLatestActive(
        input.tenantId,
        input.taskId,
        tx,
      );
      if (!active) {
        throw new Error('NO_ACTIVE_ASSIGNMENT');
      }

      const releasedAt = new Date();
      const released = await this.taskAssignmentRepo.updateStatus(
        {
          id: active.id,
          expectedVersion: active.version,
          status: 'RELEASED',
          releasedAt,
          releasedByActorId: input.releasedByActorId,
          releaseReason: input.reason,
        },
        tx,
      );

      let reassignment: ReleaseAssignmentResult['reassignment'];
      if (input.reassignToAgentId && input.reassignRationale) {
        // Validate the reassign target agent's tenant + capacity inside
        // the transaction so we never accept a cross-tenant agent and
        // never oversubscribe capacity.
        const reassignAgent = await this.agentRepo.findById(
          input.tenantId,
          input.reassignToAgentId,
        );
        if (!reassignAgent) {
          throw new Error('AGENT_NOT_FOUND');
        }
        if (reassignAgent.tenantId !== input.tenantId) {
          throw new Error('CROSS_TENANT_ACCESS_DENIED');
        }
        if (reassignAgent.archived || !reassignAgent.availability) {
          throw new Error('AGENT_NOT_AVAILABLE');
        }
        const reassignWorkloads = await this.agentRepo.loadWorkloads(
          input.tenantId,
          [reassignAgent.id],
          ['ASSIGNED', 'QUEUED', 'IN_PROGRESS', 'BLOCKED'] as AssignmentStatusForCapacity[],
        );
        const rw = reassignWorkloads[0] ?? {
          agentId: reassignAgent.id,
          activeCount: 0,
          assignedCount: 0,
          queuedCount: 0,
          inProgressCount: 0,
          blockedCount: 0,
        };
        if (
          typeof reassignAgent.maxConcurrency === 'number' &&
          reassignAgent.maxConcurrency > 0 &&
          rw.activeCount >= reassignAgent.maxConcurrency
        ) {
          throw new Error('AGENT_AT_MAX_CONCURRENCY');
        }

        const nextGeneration = active.generation + 1;
        const existing = await this.taskAssignmentRepo.findByGeneration(
          input.tenantId,
          input.taskId,
          nextGeneration,
          tx,
        );
        if (!existing) {
          const reassignLifecycle =
            input.reassignExpiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS;
          const reassignExpiresAt =
            Number.isFinite(reassignLifecycle) && reassignLifecycle > 0
              ? new Date(Date.now() + reassignLifecycle * 1000)
              : null;
          const newRow = await this.taskAssignmentRepo.create(
            {
              tenantId: input.tenantId,
              taskId: input.taskId,
              agentId: input.reassignToAgentId,
              generation: nextGeneration,
              rationale: input.reassignRationale,
              status: 'ACTIVE',
              expiresAt: reassignExpiresAt,
            },
            tx,
          );
          await this.taskRepo.updateAssignment(
            {
              id: input.taskId,
              expectedVersion: task.version,
              agentId: input.reassignToAgentId,
              status: 'ASSIGNED' as any,
            },
            tx,
          );

          if (input.reassignManualOverride !== false) {
            // Record an override audit for ANY reassignment triggered
            // by a human (the default) so the audit trail captures who
            // reassigned, to whom, and why. Auto-reassignments (e.g.
            // EXPIRED_SWEEP) opt out via `reassignManualOverride: false`.
            await this.taskAssignmentRepo.recordOverrideAudit(
              {
                tenantId: input.tenantId,
                taskId: input.taskId,
                agentId: input.reassignToAgentId,
                assignmentGeneration: nextGeneration,
                previousAgentId: active.agentId,
                rationale: input.reassignRationale,
                overrideByActorId:
                  input.reassignOverrideActorId ??
                  input.releasedByActorId,
                overrideByActorType:
                  input.reassignOverrideActorType ?? 'HUMAN',
              },
              tx,
            );
          }

          reassignment = {
            assignmentId: newRow.id,
            agentId: newRow.agentId,
            generation: newRow.generation,
          };
        }
      } else {
        // Pure release — drop the agent linkage.
        await this.taskRepo.updateAssignment(
          {
            id: input.taskId,
            expectedVersion: task.version,
            agentId: null,
            status: 'READY' as any,
          },
          tx,
        );
      }

      await this.auditRepo.record(
        {
          tenantId: input.tenantId,
          actor: input.releasedByActorId,
          action: 'TASK_ASSIGNMENT_RELEASED',
          resource: 'TaskAssignment',
          resourceId: released.id,
          correlationId: metadata.correlationId,
          result: 'success',
        },
        tx,
      );

      await this.outboxRepo.publish(
        {
          tenantId: input.tenantId,
          eventType: reassignment ? 'TaskAssigned' : 'TaskAssignmentReleased',
          sourceModule: 'assignments',
          payload: {
            taskId: input.taskId,
            releasedAssignmentId: released.id,
            reason: input.reason,
            reassignment,
          },
          correlationId: metadata.correlationId,
          causationId: metadata.causationId,
          idempotencyKey: `task-released:${released.id}`,
          actorId: input.releasedByActorId,
          actorType: input.releasedByActorType ?? 'HUMAN',
        },
        tx,
      );

      return {
        success: true,
        data: {
          releasedAssignmentId: released.id,
          taskId: input.taskId,
          reassignment,
        },
        correlationId: metadata.correlationId,
        occurredAt: new Date(),
      };
    });
  }

// ─────────────────────────────────────────────────────────────────────
//  Sweep job — release expired assignments (plan §6.2)
//  The sweep runs inside one unit-of-work so the EXPIRED transition
//  and the outbox TaskAssignmentReleased emission commit together.
// ─────────────────────────────────────────────────────────────────────

  async sweepExpiredReleases(): Promise<number> {
    return this.uow.execute(async (tx) => {
      // Delegate the actual SQL transition to the repository so the
      // contract (status='ACTIVE' AND expiresAt <= now) stays in one
      // place. The repo returns the rows it transitioned so we can
      // emit the corresponding outbox events.
      const releasedRows =
        await this.taskAssignmentRepo.releaseExpiredWithContext(
          new Date(),
          tx,
        );
      for (const row of releasedRows) {
        const task = await this.taskRepo.findById(row.tenantId, row.taskId);
        if (task) {
          try {
            await this.taskRepo.updateAssignment(
              {
                id: row.taskId,
                expectedVersion: task.version,
                agentId: null,
                status: 'READY' as any,
              },
              tx,
            );
          } catch (err: any) {
            // Tolerate a version race: another path mutated the task
            // between our findById and updateAssignment. The next sweep
            // will reconcile.
            this.logger.warn(
              `sweepExpiredReleases: task version race for ${row.taskId}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }
        await this.outboxRepo.publish(
          {
            tenantId: row.tenantId,
            eventType: 'TaskAssignmentReleased',
            sourceModule: 'assignments',
            payload: {
              taskId: row.taskId,
              releasedAssignmentId: row.id,
              reason: 'EXPIRED_SWEEP',
              expiredGeneration: row.generation,
              agentId: row.agentId,
            },
            correlationId: `sweep-${row.id}`,
            causationId: null,
            idempotencyKey: `task-expired:${row.id}`,
            actorId: 'SYSTEM',
            actorType: 'SYSTEM',
          },
          tx,
        );
      }
      return releasedRows.length;
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Public reads (audit + lifecycle)
  // ─────────────────────────────────────────────────────────────────────

  async listOverrideAudits(tenantId: string, taskId: string, limit = 20) {
    return this.taskAssignmentRepo.listOverrideAudits(tenantId, taskId, limit);
  }

  async findTaskSummary(tenantId: string, taskId: string) {
    const task = await this.taskRepo.findById(tenantId, taskId);
    if (!task) {
      throw new Error('TASK_NOT_FOUND');
    }
    return task;
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────────────────────────────

  private async nextGeneration(
    tenantId: string,
    taskId: string,
    tx: any,
  ): Promise<number> {
    const existing = await this.taskAssignmentRepo.findLatestActive(
      tenantId,
      taskId,
      tx,
    );
    if (existing) return existing.generation + 1;
    const candidate = await this.taskAssignmentRepo.findByGeneration(
      tenantId,
      taskId,
      1,
      tx,
    );
    if (!candidate) return 1;
    return candidate.generation + 1;
  }

  private extractPolicyVersion(rationale: string): string {
    const match = /\(policy ([0-9.]+)\)/.exec(rationale);
    return match ? match[1] : '1.0';
  }
}
