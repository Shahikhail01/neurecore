// src/modules/assignments/application/assignment.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IUnitOfWork } from '../../../common/ports/transaction.interface';
import { UNIT_OF_WORK } from '../../../common/ports/transaction.interface';
import type { ITaskRepository } from '../../../common/ports/task-repository.port';
import { TASK_REPOSITORY } from '../../../common/ports/task-repository.port';
import type { IAuditRepository } from '../../../common/ports/audit.port';
import { AUDIT_REPOSITORY } from '../../../common/ports/audit.port';
import type { IOutboxRepository } from '../../../common/outbox/outbox-repository.port';
import { OUTBOX_REPOSITORY } from '../../../common/outbox/outbox-repository.port';
import type { IAgentRepository } from '../domain/ports/agent-repository.port';
import { AGENT_REPOSITORY } from '../domain/ports/agent-repository.port';
import type { ITaskAssignmentRepository } from '../domain/ports/task-assignment-repository.port';
import { TASK_ASSIGNMENT_REPOSITORY } from '../domain/ports/task-assignment-repository.port';
import { TaskStateMachine } from '../../tasks/domain/task-states';

export interface AssignmentInput {
  tenantId: string;
  taskId: string;
  requiredRole: string;
  requiredCapabilities: string[];
  departmentId?: string;
  dataClassification?: string;
  maxConcurrency?: number;
}

export interface ScoredAgent {
  agentId: string;
  name: string;
  score: number;
  rationale: string;
  currentWorkload: number;
}

/**
 * Application service — depends on PORTS only via DI tokens.
 * No PrismaService import. No direct database access.
 */
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
  ) {}

  async findEligibleAgents(input: AssignmentInput): Promise<ScoredAgent[]> {
    const agents = await this.agentRepo.findEligible(
      input.tenantId,
      input.departmentId,
      input.requiredRole,
    );

    const scored: ScoredAgent[] = [];

    for (const agent of agents) {
      const agentCapabilities = agent.capabilities ?? [];
      const hasCapabilities = (input.requiredCapabilities ?? []).every(
        (cap) => agentCapabilities.includes(cap),
      );
      if (!hasCapabilities && input.requiredCapabilities?.length > 0) continue;

      const activeTasks = await this.taskRepo.countActiveByAgent(agent.id, [
        'QUEUED',
        'IN_PROGRESS',
      ]);

      if (agent.maxConcurrency && activeTasks >= agent.maxConcurrency) {
        continue;
      }

      const score = this.scoreAgent(agent, activeTasks, input);
      scored.push({
        agentId: agent.id,
        name: agent.name,
        score,
        rationale: this.buildRationale(agent, activeTasks, input, score),
        currentWorkload: activeTasks,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  private scoreAgent(agent: any, workload: number, input: AssignmentInput): number {
    const capabilityScore = 40;
    const workloadScore = workload === 0 ? 30 : Math.max(0, 30 - workload * 3);
    const departmentScore =
      input.departmentId && agent.departmentId === input.departmentId ? 20 : 10;
    const performanceScore = 10;
    return Math.max(
      0,
      capabilityScore + workloadScore + departmentScore + performanceScore,
    );
  }

  private buildRationale(
    agent: any,
    workload: number,
    input: AssignmentInput,
    score: number,
  ): string {
    return `Agent ${agent.name} selected: capability match (40), workload ${workload} (${30 - workload * 3}), department ${agent.departmentId === input.departmentId ? 'match' : 'partial'} (${agent.departmentId === input.departmentId ? 20 : 10}), score ${score}`;
  }

  async assignTask(
    taskId: string,
    agentId: string,
    assignmentGeneration: number,
    rationale: string,
    tenantId: string,
    correlationId?: string,
  ): Promise<{ assignmentId: string; taskId: string }> {
    return this.uow.execute(async (tx) => {
      const task = await this.taskRepo.findById(tenantId, taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      if (task.tenantId !== tenantId) throw new Error('CROSS_TENANT_ACCESS_DENIED');

      TaskStateMachine.assertTransition(task.status as any, 'ASSIGNED');

      const existing = await this.taskAssignmentRepo.findByGeneration(
        tenantId,
        taskId,
        assignmentGeneration,
      );
      if (existing) {
        return { assignmentId: existing.id, taskId };
      }

      const agent = await this.agentRepo.findById(tenantId, agentId);
      if (!agent) throw new Error('AGENT_NOT_FOUND');
      if (agent.tenantId !== tenantId) throw new Error('CROSS_TENANT_ACCESS_DENIED');

      const activeTasks = await this.taskRepo.countActiveByAgent(agentId, [
        'QUEUED',
        'IN_PROGRESS',
      ]);
      if (agent.maxConcurrency && activeTasks >= agent.maxConcurrency) {
        throw new Error('AGENT_AT_MAX_CONCURRENCY');
      }

      const assignment = await this.taskAssignmentRepo.create(
        {
          tenantId,
          taskId,
          agentId,
          generation: assignmentGeneration,
          rationale,
          status: 'ACTIVE',
        },
        tx,
      );

      await this.taskRepo.updateStatus(
        {
          id: taskId,
          expectedVersion: 0,
          status: 'ASSIGNED',
          agentId,
        },
        tx,
      );

      await this.auditRepo.record(
        {
          tenantId,
          actor: 'SYSTEM',
          action: 'TASK_ASSIGNED',
          resource: 'Task',
          resourceId: taskId,
          correlationId,
          result: 'success',
        },
        tx,
      );

      return { assignmentId: assignment.id, taskId };
    });
  }
}
