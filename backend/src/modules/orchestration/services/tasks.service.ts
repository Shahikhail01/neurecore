import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import type { TaskPriority, TaskStatus } from '@prisma/client';
import { EVENT_TRANSPORT } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import { TenantTemplateRuntimeService } from '../../tenant-templates/tenant-template-runtime.service';

export const GOALS_SERVICE = 'GOALS_SERVICE';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    // DEPRECATED (Phase 2, ADR-001 §12): the in-memory ProjectEventBus. Retained
    // temporarily for the existing project-memory handlers; superseded by the
    // durable Enterprise Event Fabric below.
    @Optional() private readonly eventBus?: any,
    @Optional()
    @Inject(EVENT_TRANSPORT)
    private readonly transport?: IEnterpriseEventTransport,
    @Optional()
    private readonly templateRuntime?: TenantTemplateRuntimeService,
  ) {}

  async findAll(
    options?: {
      status?: TaskStatus;
      agentId?: string;
      goalId?: string;
      projectId?: string;
      page?: number;
      limit?: number;
    },
    tenantId?: string,
  ) {
    const {
      status,
      agentId,
      goalId,
      projectId,
      page = 1,
      limit = 20,
    } = options ?? {};
    const skip = (page - 1) * limit;

    // Phase 0.5 P-1 audit fix:
    // v3 P-1 rule §11 forbids wildcard tenant bypasses. Refuse '*' with a
    // typed ForbiddenException; legitimate cross-tenant queries must use a
    // separately authorized administrative port.
    if (tenantId === '*') {
      throw new ForbiddenException(
        'tenantId "*" is forbidden; use a platform-admin port for cross-tenant queries',
      );
    }
    const where: Record<string, unknown> = {
      ...(tenantId ? { tenantId } : {}),
      ...(status && { status }),
      ...(agentId && { agentId }),
      ...(goalId && { goalId }),
      ...(projectId && { projectId }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, tenantId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, tenantId },
      include: {
        agent: { select: { id: true, name: true, status: true } },
        goal: { select: { id: true, title: true } },
        executionLogs: true,
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  /**
   * SIM-04 G-05 — list eligible agents for a task.
   *
   * Eligibility heuristic (matches the AssignmentService rules in the
   * assignment module; kept narrow on purpose so the SIM-04 picker can
   * surface a truthful short-list rather than silently assign an
   * unsuitable agent):
   *  - tenant ownership enforced
   *  - agent isActive=true and availability=AVAILABLE
   *  - agent has capacity (current in-flight task count < maxConcurrency)
   *  - agent's `config.department` matches task.requiredRole OR
   *    agent has all of task.requiredCapabilities (best-effort)
   *
   * Returns a scored list so the FE can render reasons + scores.
   * Never returns cross-tenant rows.
   */
  async findEligibleAgents(taskId: string, tenantId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
      select: {
        id: true,
        requiredRole: true,
        requiredCapabilities: true,
        agentId: true,
      },
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    const candidateAgents = await this.prisma.agent.findMany({
      where: {
        tenantId,
        isActive: true,
        archived: false,
        availability: 'AVAILABLE',
      },
      select: {
        id: true,
        name: true,
        status: true,
        availability: true,
        maxConcurrency: true,
        role: true,
        capabilities: true,
        config: true,
        departmentId: true,
        _count: { select: { tasks: true } },
      },
      orderBy: { name: 'asc' },
    });

    const reasons = (
      matched: boolean,
      capacityOk: boolean,
      roleMatch: boolean,
      capMatch: boolean,
    ): string[] => {
      const r: string[] = [];
      if (roleMatch) r.push('role matches task.requiredRole');
      else if (capMatch) r.push('capabilities match task.requiredCapabilities');
      else r.push('no role/capability match');
      r.push(capacityOk ? 'has available concurrency' : 'at concurrency limit');
      r.push(matched ? 'in good standing' : 'ineligible');
      return r;
    };

    return candidateAgents
      .map((a) => {
        const cfg = (a.config ?? {}) as Record<string, unknown>;
        const department =
          typeof cfg.department === 'string' ? cfg.department : null;
        const roleMatch =
          task.requiredRole != null && department === task.requiredRole;
        const requiredCaps = Array.isArray(task.requiredCapabilities)
          ? task.requiredCapabilities
          : [];
        const agentCaps = Array.isArray(a.capabilities) ? a.capabilities : [];
        const capMatch =
          requiredCaps.length > 0 &&
          requiredCaps.every((c) => agentCaps.includes(c));
        const inFlight = a._count?.tasks ?? 0;
        const capacityOk = inFlight < (a.maxConcurrency ?? 1);
        const eligible =
          (roleMatch || capMatch || !task.requiredRole) && capacityOk;
        const score =
          (roleMatch ? 2 : 0) + (capMatch ? 2 : 0) + (capacityOk ? 1 : 0);
        return {
          agentId: a.id,
          name: a.name,
          role: a.role,
          department,
          status: a.status,
          availability: a.availability,
          inFlightTasks: inFlight,
          maxConcurrency: a.maxConcurrency ?? 1,
          currentAssignment: a.id === task.agentId,
          eligible,
          score,
          reasons: reasons(eligible, capacityOk, roleMatch, capMatch),
        };
      })
      .sort((x, y) => {
        if (y.score !== x.score) return y.score - x.score;
        return x.name.localeCompare(y.name);
      });
  }

  /**
   * SIM-04 G-06 — list execution attempts for a task, in chronological
   * order. Tenant-scoped by construction; returns attempts whose
   * `taskId` matches AND `tenantId` matches. Includes minimal attempt
   * metadata (status, attemptNumber, started/ended, review link) so the
   * FE task board can render attempt chips without an extra roundtrip.
   */
  async findAttemptsForTask(taskId: string, tenantId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    const attempts = await this.prisma.executionAttempt.findMany({
      where: { taskId, tenantId },
      orderBy: [{ attemptNumber: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        attemptNumber: true,
        status: true,
        agentId: true,
        startedAt: true,
        endedAt: true,
        submittedAt: true,
        tokensUsed: true,
        costCents: true,
        toolCallCount: true,
        outputSummary: true,
        lastError: true,
        lastErrorClassification: true,
        createdAt: true,
        updatedAt: true,
        reviews: {
          select: { id: true, status: true, decision: true, decidedAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return { taskId, count: attempts.length, attempts };
  }

  async create(
    input: {
      title: string;
      description?: string;
      priority?: TaskPriority;
      input?: Record<string, unknown>;
      agentId?: string | null;
      workflowId?: string;
      scheduledAt?: string;
      dueDate?: string;
      createdById?: string | null;
      goalId?: string | null;
      acceptanceCriteria?: string;
      expectedOutput?: Record<string, unknown>;
      projectId?: string;
    },
    tenantId: string,
  ) {
    return this.prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority ?? 'MEDIUM',
        input: (input.input ?? {}) as Prisma.InputJsonValue,
        agentId: input.agentId,
        workflowId: input.workflowId,
        scheduledAt: input.scheduledAt
          ? new Date(input.scheduledAt)
          : undefined,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        tenantId,
        createdById: input.createdById ?? null,
        goalId: input.goalId ?? null,
        acceptanceCriteria: input.acceptanceCriteria ?? null,
        expectedOutput: input.expectedOutput
          ? (input.expectedOutput as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        projectId: input.projectId,
      },
    });
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      priority?: TaskPriority;
      input?: Record<string, unknown>;
      agentId?: string | null;
      goalId?: string | null;
      acceptanceCriteria?: string | null;
      expectedOutput?: Record<string, unknown> | null;
    },
    tenantId: string,
  ) {
    await this.assertOwnership(id, tenantId);
    const updateData: Record<string, unknown> = { ...data };
    if (data.input) {
      updateData.input = data.input as Prisma.InputJsonValue;
    }
    if (data.expectedOutput !== undefined) {
      updateData.expectedOutput = data.expectedOutput
        ? (data.expectedOutput as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    return this.prisma.task.update({
      where: { id },
      data: updateData as Prisma.TaskUpdateInput,
    });
  }

  /**
   * Update task status. When a task is completed, this triggers
   * goal progress recalculation if the task has a goalId.
   */
  async updateStatus(id: string, status: TaskStatus, tenantId: string) {
    await this.assertOwnership(id, tenantId);

    const existing = await this.prisma.task.findFirst({
      where: { id, tenantId },
      select: { startedAt: true },
    });

    const updateData: Record<string, unknown> = { status };
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }
    if (status === 'RUNNING' && existing && !existing.startedAt) {
      updateData.startedAt = new Date();
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: updateData as Prisma.TaskUpdateInput,
    });

    if (status === 'COMPLETED' && updated.goalId) {
      this.logger.debug(
        `Task ${id} completed — goal ${updated.goalId} progress recalculation queued`,
      );
    }

    if (status === 'COMPLETED' && this.eventBus) {
      try {
        this.eventBus.publish({
          type: 'TaskCompleted',
          projectId: updated.projectId,
          tenantId,
          timestamp: new Date(),
          payload: { taskId: id, goalId: updated.goalId, title: updated.title },
        });
      } catch (err) {
        this.logger.warn(`Failed to publish TaskCompleted event: ${err}`);
      }
    }

    // Phase 2: durable enterprise event (the migrated, cross-capability path).
    if (status === 'COMPLETED' && this.transport) {
      try {
        await this.transport.publish({
          eventType: 'enterprise.task.completed',
          tenantId,
          actorType: 'SYSTEM',
          idempotencyKey: `task.completed.${id}`,
          sourceModule: 'orchestration',
          payload: {
            taskId: id,
            projectId: updated.projectId,
            goalId: updated.goalId,
            status: 'COMPLETED',
            title: updated.title,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to publish enterprise.task.completed: ${err}`);
      }
    }

    return updated;
  }

  async remove(id: string, tenantId: string) {
    await this.assertOwnership(id, tenantId);
    await this.prisma.task.delete({ where: { id } });
  }

  async findByGoalId(goalId: string, tenantId: string) {
    return this.prisma.task.findMany({
      where: { goalId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Reopen a previously completed/failed task back to PENDING.
   * Clears completion timestamp and any error message.
   */
  async reopen(id: string, tenantId: string) {
    await this.assertOwnership(id, tenantId);
    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'PENDING',
        completedAt: null,
        error: null,
      } as Prisma.TaskUpdateInput,
    });
  }

  /**
   * Find all subtasks of a given parent task. Uses the JSON `input.parentTaskId`
   * path until a proper parent-child relationship exists.
   */
  async findSubtasks(parentId: string, tenantId: string) {
    return this.prisma.task.findMany({
      where: {
        tenantId,
        input: { path: ['parentTaskId'], equals: parentId },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find tasks that are overdue — status not in COMPLETED/CANCELLED and
   * either has no completedAt timestamp, or was completed after the due date.
   * For now (no dueDate column), returns non-completed tasks as a proxy.
   */
  async findOverdue(
    tenantId: string,
    options?: { departmentId?: string; limit?: number },
  ) {
    const { departmentId, limit = 50 } = options ?? {};
    return this.prisma.task.findMany({
      where: {
        tenantId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        ...(departmentId ? { departmentId } : {}),
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Bulk update status for multiple tasks. Each transition may emit events.
   */
  async bulkUpdateStatus(ids: string[], status: TaskStatus, tenantId: string) {
    const results: Array<{
      id: string;
      status: 'updated' | 'failed';
      error?: string;
    }> = [];
    for (const id of ids) {
      try {
        await this.updateStatus(id, status, tenantId);
        results.push({ id, status: 'updated' });
      } catch (err) {
        results.push({
          id,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }

  /**
   * Clone a task to create a new task with the same properties (minus status,
   * timestamps, and IDs). Useful for templating.
   */
  async clone(
    sourceId: string,
    tenantId: string,
    overrides?: { assigneeId?: string; title?: string },
  ) {
    const source = await this.findOne(sourceId, tenantId);
    return this.create(
      {
        title: overrides?.title ?? `${source.title} (Copy)`,
        description: source.description ?? undefined,
        priority: source.priority,
        agentId:
          overrides?.assigneeId !== undefined
            ? overrides.assigneeId
            : source.agentId,
        input: (source.input as Record<string, unknown> | null) ?? {},
        goalId: source.goalId ?? undefined,
      },
      tenantId,
    );
  }

  /**
   * Find tasks assigned to a specific agent (used by getMyTasks).
   */
  async findByAgent(
    agentId: string,
    tenantId: string,
    options?: { status?: TaskStatus; limit?: number },
  ) {
    return this.prisma.task.findMany({
      where: {
        tenantId,
        agentId,
        ...(options?.status ? { status: options.status } : {}),
      },
      take: options?.limit ?? 50,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Stage 1 §4.7 — Create a single Task from a TASK_TEMPLATE definition.
   * If the tenant has a matching template, its description + subtasks seed
   * the task. Otherwise falls back to the supplied defaults.
   */
  async createFromTemplate(
    tenantId: string,
    templateSlug: string,
    overrides?: {
      agentId?: string | null;
      projectId?: string;
      stageId?: string;
      createdById?: string | null;
    },
  ) {
    if (!this.templateRuntime) {
      throw new BadRequestException('Tenant template runtime not available');
    }
    const tpls =
      await this.templateRuntime.listTaskTemplatesForIndustry(tenantId);
    const tpl = tpls.find((t) => t.slug === templateSlug);
    if (!tpl) {
      throw new NotFoundException(
        `Task template '${templateSlug}' not found for tenant ${tenantId}`,
      );
    }
    return this.create(
      {
        title: tpl.name,
        description: tpl.description,
        agentId: overrides?.agentId ?? null,
        workflowId: undefined,
        createdById: overrides?.createdById ?? null,
        goalId: null,
        input: {
          subtasks: tpl.subtasks,
          assignToRole: tpl.assignToRole,
          estimatedDuration: tpl.estimatedDuration,
          sourceTemplateId: tpl.sourceTemplateId,
        },
      },
      tenantId,
    );
  }

  /**
   * Stage 1 §4.7 — Seed a project's initial task list from all active
   * TASK_TEMPLATE templates matching the tenant's industry. Called by the
   * project creation flow when `seedTasksFromTemplates=true`.
   */
  async seedProjectTasksFromTemplates(
    tenantId: string,
    projectId: string,
    options?: { industrySlug?: string | null; createdById?: string | null },
  ) {
    if (!this.templateRuntime) return [];
    const tpls = await this.templateRuntime.listTaskTemplatesForIndustry(
      tenantId,
      options?.industrySlug,
    );
    if (tpls.length === 0) return [];
    const created: unknown[] = [];
    for (const tpl of tpls) {
      const task = await this.create(
        {
          title: tpl.name,
          description: tpl.description,
          projectId,
          createdById: options?.createdById ?? null,
          input: {
            subtasks: tpl.subtasks,
            assignToRole: tpl.assignToRole,
            estimatedDuration: tpl.estimatedDuration,
            sourceTemplateId: tpl.sourceTemplateId,
          },
        },
        tenantId,
      );
      created.push(task);
    }
    this.logger.log(
      `Seeded ${created.length} tasks from templates for project ${projectId}`,
    );
    return created;
  }

  private async assertOwnership(id: string, tenantId: string) {
    const exists = await this.prisma.task.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Task ${id} not found`);
  }
}
