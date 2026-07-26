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
      if (task.agentId) {
        const existing = await this.taskAssignmentRepo.findLatestActive(
          input.tenantId,
          input.taskId,
          tx,
        );
        if (existing && existing.agentId === input.agentId) {
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
            },
            correlationId: metadata.correlationId,
            occurredAt: new Date(),
            deduplicated: true,
          };
        }
      }

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
        // Manual override is permitted whenever the actor provides
        // a rationale. The tenant permission system gates WHO can
        // submit overrides; AUTO_ASSIGNMENT is for automated
        // selection and does not block overrides.
        void input;
        preview = overrideAgent.dataClassification;
        scored = {
          agentId: overrideAgent.id,
          name: overrideAgent.name,
          score: 100,
          rationale: `manual override: ${input.manualOverrideRationale}`,
          currentWorkload: 0,
          capabilityScore: 0,
          workloadScore: 0,
          departmentScore: 0,
          historicalScore: 0,
          policyVersion: getActiveScoringPolicy().version,
        };
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
        scored = candidates[0];
      }

      const lifecycle = input.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS;
      const expiresAt =
        Number.isFinite(lifecycle) && lifecycle > 0
          ? new Date(Date.now() + lifecycle * 1000)
          : null;

      const generation = await this.nextGeneration(
        input.tenantId,
        input.taskId,
        tx,
      );

      const previousAgentId = task.agentId ?? null;

      const assignment = await this.taskAssignmentRepo.create(
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
        const nextGeneration = active.generation + 1;
        const existing = await this.taskAssignmentRepo.findByGeneration(
          input.tenantId,
          input.taskId,
          nextGeneration,
          tx,
        );
        if (!existing) {
          const newRow = await this.taskAssignmentRepo.create(
            {
              tenantId: input.tenantId,
              taskId: input.taskId,
              agentId: input.reassignToAgentId,
              generation: nextGeneration,
              rationale: input.reassignRationale,
              status: 'ACTIVE',
              expiresAt: active.expiresAt,
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

          if (input.reassignManualOverride) {
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
  // ─────────────────────────────────────────────────────────────────────

  async sweepExpiredReleases(): Promise<number> {
    return this.uow.execute(async (tx) =>
      this.taskAssignmentRepo.releaseExpired(new Date(), tx),
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Public reads (audit + lifecycle)
  // ─────────────────────────────────────────────────────────────────────

  async listOverrideAudits(tenantId: string, taskId: string, limit = 20) {
    return this.taskAssignmentRepo.listOverrideAudits(tenantId, taskId, limit);
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
