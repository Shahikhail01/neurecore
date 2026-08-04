import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { WorkflowStatus } from '@prisma/client';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    options?: { status?: WorkflowStatus; page?: number; limit?: number },
    tenantId?: string,
  ) {
    const { status, page = 1, limit = 20 } = options ?? {};
    const skip = (page - 1) * limit;

    // Phase 0.5 P-1 audit fix:
    // v3 P-1 rule §11 forbids wildcard tenant bypasses. Previously the code
    // accepted `tenantId === '*'` and silently widened the filter to all
    // tenants, breaking tenant isolation. We now refuse the wildcard with a
    // typed ForbiddenException; legitimate cross-tenant queries must use a
    // separately authorized administrative port (not yet introduced).
    if (tenantId === '*') {
      throw new ForbiddenException(
        'tenantId "*" is forbidden; use a platform-admin port for cross-tenant queries',
      );
    }
    const where: Record<string, unknown> = {
      ...(tenantId ? { tenantId } : {}),
      ...(status && { status }),
    };
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

    const transformedData = data.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      isActive: workflow.status === 'ACTIVE',
      createdAt: workflow.createdAt.toISOString(),
      _count: {
        executions: workflow._count.tasks,
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

  async create(
    input: {
      name: string;
      description?: string;
      definition?: Record<string, unknown>;
      config?: Record<string, unknown>;
      isTemplate?: boolean;
    },
    tenantId: string,
  ) {
    return this.prisma.workflow.create({
      data: {
        name: input.name,
        description: input.description,
        definition: (input.definition ?? {}) as never,
        config: (input.config ?? {}) as never,
        isTemplate: input.isTemplate ?? false,
        tenantId,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      status?: WorkflowStatus;
      definition?: Record<string, unknown>;
      config?: Record<string, unknown>;
    },
    tenantId: string,
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

  async getStatus(id: string, tenantId: string) {
    const wf = await this.findOne(id, tenantId);
    const [pending, running, completed, failed] =
      await this.prisma.$transaction([
        this.prisma.task.count({
          where: { workflowId: id, tenantId, status: 'PENDING' },
        }),
        this.prisma.task.count({
          where: { workflowId: id, tenantId, status: 'RUNNING' },
        }),
        this.prisma.task.count({
          where: { workflowId: id, tenantId, status: 'COMPLETED' },
        }),
        this.prisma.task.count({
          where: { workflowId: id, tenantId, status: 'FAILED' },
        }),
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
