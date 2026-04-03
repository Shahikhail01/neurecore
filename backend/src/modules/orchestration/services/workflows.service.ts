import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { WorkflowStatus } from '@prisma/client';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string | null,
    options?: { status?: WorkflowStatus; page?: number; limit?: number },
  ) {
    const { status, page = 1, limit = 20 } = options ?? {};
    const skip = (page - 1) * limit;

    // Return empty results if no tenant context
    if (!tenantId) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const where = { tenantId, ...(status && { status }) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.workflow.findMany({
        where,
        include: {
          _count: {
            select: {
              tasks: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workflow.count({ where }),
    ]);

    // Transform the data to match frontend expectations
    const transformedData = data.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      isActive: workflow.status === 'ACTIVE',
      createdAt: workflow.createdAt.toISOString(),
      _count: {
        executions: workflow._count.tasks, // Map tasks count to executions
      },
    }));

    return {
      data: transformedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string) {
    const wf = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { tasks: true } } },
    });
    if (!wf) throw new NotFoundException(`Workflow ${id} not found`);
    return wf;
  }

  async create(input: {
    name: string;
    description?: string;
    definition?: Record<string, unknown>;
    config?: Record<string, unknown>;
    isTemplate?: boolean;
    tenantId: string;
  }) {
    return this.prisma.workflow.create({
      data: {
        name: input.name,
        description: input.description,
        definition: (input.definition ?? {}) as never,
        config: (input.config ?? {}) as never,
        isTemplate: input.isTemplate ?? false,
        tenantId: input.tenantId,
      },
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      status?: WorkflowStatus;
      definition?: Record<string, unknown>;
      config?: Record<string, unknown>;
    },
  ) {
    await this.assertOwnership(id, tenantId);
    return this.prisma.workflow.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.status && { status: data.status }),
        ...(data.definition && { definition: data.definition as never }),
        ...(data.config && { config: data.config as never }),
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.assertOwnership(id, tenantId);
    await this.prisma.workflow.delete({ where: { id } });
  }

  async activate(id: string, tenantId: string) {
    await this.assertOwnership(id, tenantId);
    return this.prisma.workflow.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  /**
   * Execute a workflow — starts all tasks that belong to the workflow.
   * Returns an execution summary; real-time progress is pushed via WebSocket.
   * SRP: delegates actual task execution to the caller (AgentExecutorService);
   *      here we just set status and collect the task list.
   */
  async execute(
    id: string,
    tenantId: string,
  ): Promise<{ workflowId: string; taskIds: string[]; status: string }> {
    const wf = await this.findOne(id, tenantId);

    if (wf.status === 'DRAFT') {
      await this.prisma.workflow.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });
    }

    const tasks = await this.prisma.task.findMany({
      where: { workflowId: id, tenantId },
      select: { id: true },
    });

    this.logger.log(
      `Workflow ${id} execution triggered — ${tasks.length} tasks queued`,
    );

    return {
      workflowId: id,
      taskIds: tasks.map((t) => t.id),
      status: 'EXECUTING',
    };
  }

  /** Returns the current status of a workflow with pending/running/completed task counts */
  async getStatus(id: string, tenantId: string) {
    const wf = await this.findOne(id, tenantId);
    const [pending, running, completed, failed] =
      await this.prisma.$transaction([
        this.prisma.task.count({
          where: { workflowId: id, status: 'PENDING' },
        }),
        this.prisma.task.count({
          where: { workflowId: id, status: 'RUNNING' },
        }),
        this.prisma.task.count({
          where: { workflowId: id, status: 'COMPLETED' },
        }),
        this.prisma.task.count({ where: { workflowId: id, status: 'FAILED' } }),
      ]);

    return {
      workflowId: id,
      name: wf.name,
      status: wf.status,
      tasks: {
        pending,
        running,
        completed,
        failed,
        total: pending + running + completed + failed,
      },
    };
  }

  private async assertOwnership(id: string, tenantId: string) {
    const exists = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Workflow ${id} not found`);
  }
}
