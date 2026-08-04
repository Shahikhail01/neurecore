/**
 * Prisma Routine Repository Implementation
 *
 * Implements IRoutineRepository using Prisma ORM
 * Follows Single Responsibility - only handles routine persistence.
 */

import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  IRoutineRepository,
  IRoutineTriggerRepository,
  IRoutineRunRepository,
  CreateRoutineInput,
  UpdateRoutineInput,
  CreateTriggerInput,
  UpdateTriggerInput,
  CreateRoutineRunInput,
  ListRoutinesOptions,
  ListRunsOptions,
} from '../interfaces/routine.interface';
import type { Routine, RoutineTrigger, RoutineRun } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaRoutineRepository implements IRoutineRepository {
  private readonly logger = new Logger(PrismaRoutineRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateRoutineInput): Promise<Routine> {
    this.logger.debug(`[create] Routine: ${data.name}`);

    const routine = await this.prisma.routine.create({
      data: {
        name: data.name,
        description: data.description,
        graphDefinition:
          data.graphDefinition as unknown as Prisma.InputJsonValue,
        config: data.config as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue,
        ownerAgentId: data.ownerAgentId,
        tenantId: data.tenantId,
        createdById: data.createdById,
        status: 'DRAFT',
      },
    });

    return routine;
  }

  async findById(id: string, tenantId: string): Promise<Routine | null> {
    return this.prisma.routine.findFirst({
      where: { id, tenantId },
      include: {
        triggers: true,
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async findAll(
    tenantId: string,
    options?: ListRoutinesOptions,
  ): Promise<{ routines: Routine[]; total: number }> {
    // Phase 0.5 P-1 audit fix: refuse wildcard tenant bypass.
    if (tenantId === '*') {
      throw new ForbiddenException(
        'tenantId "*" is forbidden; use a platform-admin port for cross-tenant queries',
      );
    }
    const where: Prisma.RoutineWhereInput = { tenantId };

    if (options?.status) {
      where.status = options.status;
    }

    // Phase 1 Gap 1 — owner agent filter (single or multiple)
    if (options?.ownerAgentId) {
      where.ownerAgentId = options.ownerAgentId;
    } else if (options?.ownerAgentIds && options.ownerAgentIds.length > 0) {
      where.ownerAgentId = { in: options.ownerAgentIds };
    }

    const [routines, total] = await this.prisma.$transaction([
      this.prisma.routine.findMany({
        where,
        orderBy: { [options?.orderBy || 'createdAt']: options?.order || 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
        include: {
          _count: { select: { triggers: true, runs: true } },
        },
      }),
      this.prisma.routine.count({ where }),
    ]);

    return { routines, total };
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateRoutineInput,
  ): Promise<Routine> {
    this.logger.debug(`[update] Routine: ${id}`);

    const updateData: Prisma.RoutineUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.graphDefinition !== undefined)
      updateData.graphDefinition =
        data.graphDefinition as unknown as Prisma.InputJsonValue;
    if (data.config !== undefined)
      updateData.config = data.config as Prisma.InputJsonValue;
    if (data.metadata !== undefined)
      updateData.metadata = data.metadata as Prisma.InputJsonValue;
    if (data.ownerAgentId !== undefined) {
      updateData.ownerAgent = data.ownerAgentId
        ? { connect: { id: data.ownerAgentId } }
        : { disconnect: true };
    }

    return this.prisma.routine.update({
      where: { id, tenantId },
      data: updateData,
    });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    this.logger.debug(`[delete] Routine: ${id}`);

    // Cascade deletes triggers and runs due to schema configuration
    await this.prisma.routine.delete({
      where: { id, tenantId },
    });
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: string,
  ): Promise<Routine> {
    return this.prisma.routine.update({
      where: { id, tenantId },
      data: { status: status as any },
    });
  }
}

@Injectable()
export class PrismaRoutineTriggerRepository implements IRoutineTriggerRepository {
  private readonly logger = new Logger(PrismaRoutineTriggerRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    routineId: string,
    data: CreateTriggerInput,
  ): Promise<RoutineTrigger> {
    this.logger.debug(`[create] Trigger for routine: ${routineId}`);

    // Generate webhook path for WEBHOOK type triggers
    let webhookPath: string | undefined;
    let webhookSecret: string | undefined;

    if (data.type === 'WEBHOOK') {
      const secret = this.generateSecret();
      webhookPath = `/webhooks/routines/${routineId}/${secret.slice(0, 8)}`;
      webhookSecret = secret;
    }

    return this.prisma.routineTrigger.create({
      data: {
        type: data.type as any,
        name: data.name,
        config: data.config as Prisma.InputJsonValue,
        routineId,
        webhookPath,
        webhookSecret,
        isActive: true,
      },
    });
  }

  async findById(id: string, tenantId: string): Promise<RoutineTrigger | null> {
    return this.prisma.routineTrigger.findFirst({
      where: {
        id,
        routine: { tenantId },
      },
    });
  }

  async findByRoutineId(routineId: string): Promise<RoutineTrigger[]> {
    return this.prisma.routineTrigger.findMany({
      where: { routineId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByWebhookPath(path: string): Promise<RoutineTrigger | null> {
    return this.prisma.routineTrigger.findUnique({
      where: { webhookPath: path },
      include: {
        routine: {
          include: {
            tenant: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateTriggerInput,
  ): Promise<RoutineTrigger> {
    this.logger.debug(`[update] Trigger: ${id}`);

    const updateData: Prisma.RoutineTriggerUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.config !== undefined)
      updateData.config = data.config as Prisma.InputJsonValue;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return this.prisma.routineTrigger.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.routineTrigger.delete({
      where: { id, routine: { tenantId } },
    });
  }

  async updateLastFired(
    id: string,
    firedAt: Date,
    nextFire?: Date,
  ): Promise<void> {
    await this.prisma.routineTrigger.update({
      where: { id },
      data: {
        lastFiredAt: firedAt,
        nextFireAt: nextFire,
      },
    });
  }

  private generateSecret(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  }
}

@Injectable()
export class PrismaRoutineRunRepository implements IRoutineRunRepository {
  private readonly logger = new Logger(PrismaRoutineRunRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateRoutineRunInput): Promise<RoutineRun> {
    this.logger.debug(`[create] Run for routine: ${data.routineId}`);

    const threadId = data.threadId || `routine-${data.routineId}-${Date.now()}`;

    return this.prisma.routineRun.create({
      data: {
        routineId: data.routineId,
        tenantId: data.tenantId,
        triggerType: data.triggerType as any,
        triggerId: data.triggerId,
        input: data.input as Prisma.InputJsonValue,
        agentId: data.agentId,
        createdById: data.createdById,
        threadId,
        status: 'PENDING',
      },
    });
  }

  async findById(id: string, tenantId: string): Promise<RoutineRun | null> {
    return this.prisma.routineRun.findFirst({
      where: { id, tenantId },
      include: {
        routine: true,
        agent: true,
      },
    });
  }

  async findByRoutineId(
    routineId: string,
    options?: ListRunsOptions,
  ): Promise<{ runs: RoutineRun[]; total: number }> {
    const where: Prisma.RoutineRunWhereInput = { routineId };

    if (options?.status) {
      where.status = options.status as any;
    }

    const [runs, total] = await this.prisma.$transaction([
      this.prisma.routineRun.findMany({
        where,
        orderBy: { [options?.orderBy || 'createdAt']: options?.order || 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.routineRun.count({ where }),
    ]);

    return { runs, total };
  }

  async findByTenantId(
    tenantId: string,
    options?: ListRunsOptions,
  ): Promise<{ runs: RoutineRun[]; total: number }> {
    // Phase 0.5 P-1 audit fix: refuse wildcard tenant bypass.
    if (tenantId === '*') {
      throw new ForbiddenException(
        'tenantId "*" is forbidden; use a platform-admin port for cross-tenant queries',
      );
    }
    const where: Prisma.RoutineRunWhereInput = { tenantId };

    if (options?.status) {
      where.status = options.status as any;
    }

    const [runs, total] = await this.prisma.$transaction([
      this.prisma.routineRun.findMany({
        where,
        orderBy: { [options?.orderBy || 'createdAt']: options?.order || 'desc' },
        take: options?.limit || 100,
        skip: options?.offset || 0,
        include: {
          routine: { select: { id: true, name: true } },
        },
      }),
      this.prisma.routineRun.count({ where }),
    ]);

    return { runs, total };
  }

  async updateState(id: string, state: Record<string, unknown>): Promise<void> {
    await this.prisma.routineRun.update({
      where: { id },
      data: {
        state: state as Prisma.InputJsonValue,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });
  }

  async complete(id: string, output: Record<string, unknown>): Promise<void> {
    const run = await this.prisma.routineRun.findUnique({ where: { id } });

    await this.prisma.routineRun.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        output: output as Prisma.InputJsonValue,
        completedAt: new Date(),
        durationMs: run?.startedAt
          ? Date.now() - run.startedAt.getTime()
          : null,
      },
    });
  }

  async fail(id: string, error: string): Promise<void> {
    const run = await this.prisma.routineRun.findUnique({ where: { id } });

    await this.prisma.routineRun.update({
      where: { id },
      data: {
        status: 'FAILED',
        error,
        completedAt: new Date(),
        durationMs: run?.startedAt
          ? Date.now() - run.startedAt.getTime()
          : null,
      },
    });
  }

  async cancel(id: string): Promise<void> {
    await this.prisma.routineRun.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });
  }
}
