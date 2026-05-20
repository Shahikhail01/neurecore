import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { TaskPriority, TaskStatus } from '@prisma/client';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string | null | undefined,
    options?: {
      status?: TaskStatus;
      agentId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const { status, agentId, page = 1, limit = 20 } = options ?? {};
    const skip = (page - 1) * limit;

    const where = {
      ...(tenantId ? { tenantId } : {}),
      ...(status && { status }),
      ...(agentId && { agentId }),
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
        executionLogs: true,
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async findOneForPlatform(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        agent: { select: { id: true, name: true, status: true } },
        executionLogs: true,
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async create(input: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    input?: Record<string, unknown>;
    agentId?: string;
    workflowId?: string;
    scheduledAt?: string;
    tenantId: string;
    createdById: string;
  }) {
    return this.prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority ?? 'MEDIUM',
        input: (input.input ?? {}) as never,
        agentId: input.agentId,
        workflowId: input.workflowId,
        scheduledAt: input.scheduledAt
          ? new Date(input.scheduledAt)
          : undefined,
        tenantId: input.tenantId,
        createdById: input.createdById,
      },
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      priority?: TaskPriority;
      input?: Record<string, unknown>;
      agentId?: string;
    },
  ) {
    await this.assertOwnership(id, tenantId);
    return this.prisma.task.update({
      where: { id },
      data: { ...data, input: data.input as never },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.assertOwnership(id, tenantId);
    await this.prisma.task.delete({ where: { id } });
  }

  private async assertOwnership(id: string, tenantId: string) {
    const exists = await this.prisma.task.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Task ${id} not found`);
  }
}
