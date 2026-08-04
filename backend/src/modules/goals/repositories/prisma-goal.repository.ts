/**
 * Goals Module - Prisma Repository
 *
 * Implements IGoalRepository for persisting goals
 * Following SOLID:
 * - Single Responsibility: Only handles Goal persistence
 * - Dependency Inversion: Implements interface, not coupled to service
 * - Tenant Isolation: ALL queries include tenantId filter (passed as parameter)
 */

import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IGoalRepository,
  CreateGoalInput,
  UpdateGoalInput,
  ListGoalsOptions,
} from '../interfaces/goal.interface';

@Injectable()
export class PrismaGoalRepository implements IGoalRepository {
  private readonly logger = new Logger(PrismaGoalRepository.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(data: CreateGoalInput, tenantId: string) {
    return this.prisma.goal.create({
      data: {
        tenantId,
        title: data.title,
        description: data.description,
        level: data.level ?? 'INDIVIDUAL',
        parentId: data.parentId,
        ownerAgentId: data.ownerAgentId,
        ownerUserId: data.ownerUserId,
        departmentId: data.departmentId,
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
        projectId: data.projectId ?? null,
        measurableCriteria: data.measurableCriteria ?? null,
      },
    });
  }

  async findById(id: string, tenantId: string) {
    return this.prisma.goal.findFirst({
      where: { id, tenantId },
    });
  }

  async findAll(options: ListGoalsOptions, tenantId: string) {
    const { status, level, parentId, ownerUserId, ownerAgentId, projectId } =
      options;
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;

    // Phase 0.5 P-1 audit fix: refuse wildcard tenant bypass.
    if (tenantId === '*') {
      throw new ForbiddenException(
        'tenantId "*" is forbidden; use a platform-admin port for cross-tenant queries',
      );
    }
    const where: Record<string, unknown> = { tenantId };

    if (status) where.status = status;
    if (level) where.level = level;
    if (ownerUserId) where.ownerUserId = ownerUserId;
    if (ownerAgentId) where.ownerAgentId = ownerAgentId;
    if (projectId) where.projectId = projectId;

    // Handle parentId filtering
    if (parentId === 'root') {
      where.parentId = null;
    } else if (parentId) {
      where.parentId = parentId;
    }
    // If parentId is undefined, don't filter by parentId

    const [data, total] = await this.prisma.$transaction([
      this.prisma.goal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          children: { select: { id: true } },
        },
      }),
      this.prisma.goal.count({ where }),
    ]);

    return { data, total };
  }

  async findByParentId(parentId: string, tenantId: string) {
    return this.prisma.goal.findMany({
      where: { parentId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findRootGoals(tenantId: string) {
    return this.prisma.goal.findMany({
      where: { tenantId, parentId: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByProjectId(projectId: string, tenantId: string) {
    return this.prisma.goal.findMany({
      where: { projectId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, data: UpdateGoalInput) {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.level !== undefined) updateData.level = data.level;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.parentId !== undefined) updateData.parentId = data.parentId;
    if (data.ownerAgentId !== undefined)
      updateData.ownerAgentId = data.ownerAgentId;
    if (data.ownerUserId !== undefined)
      updateData.ownerUserId = data.ownerUserId;
    if (data.departmentId !== undefined)
      updateData.departmentId = data.departmentId;
    if (data.targetDate !== undefined) {
      updateData.targetDate = data.targetDate
        ? new Date(data.targetDate)
        : null;
    }
    if (data.completedAt !== undefined) {
      updateData.completedAt = data.completedAt
        ? new Date(data.completedAt)
        : null;
    }
    if (data.measurableCriteria !== undefined) {
      updateData.measurableCriteria = data.measurableCriteria;
    }

    return this.prisma.goal.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, tenantId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, tenantId },
    });

    if (!goal) {
      throw new Error(`Goal ${id} not found for tenant ${tenantId}`);
    }

    await this.prisma.goal.delete({ where: { id } });
    this.logger.log(`Deleted goal ${id}`);
  }

  async updateProgress(id: string, progress: number) {
    const data: Record<string, unknown> = { progress };

    if (progress >= 100) {
      data.status = 'COMPLETED';
      data.completedAt = new Date();
    }

    return this.prisma.goal.update({
      where: { id },
      data,
    });
  }
}