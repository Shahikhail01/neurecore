/**
 * WorkflowsService — Business logic for workflow CRUD and execution.
 *
 * SOLID principles:
 *   - Single Responsibility: only workflow domain logic, no HTTP concerns
 *   - Dependency Inversion: depends on PrismaService (injected), not constructed
 *   - Interface Segregation: public API is a focused set of cohesive methods
 *
 * Status state machine:
 *   DRAFT  → ACTIVE   (activate)
 *   ACTIVE → PAUSED   (pause)
 *   PAUSED → ACTIVE  (activate)
 *   ACTIVE → ARCHIVED (archive)
 *   any    → DRAFT    (no — reset not allowed here)
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import { WorkflowStatus } from '@prisma/client';
import type { CreateWorkflowDto } from '../dto/create-workflow.dto';
import type { UpdateWorkflowDto } from '../dto/update-workflow.dto';
import type {
  WorkflowResponseDto,
  WorkflowExecutionSummaryDto,
  WorkflowExecutionHistoryItemDto,
  UpdateWorkflowExecutionDto,
} from '../dto/workflow-response.dto';

interface ListWorkflowsOptions {
  page?: number;
  limit?: number;
  status?: WorkflowStatus;
  search?: string;
}

interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

type WorkflowWithMeta = WorkflowResponseDto & {
  _count?: { executions?: number };
};

const VALID_TRANSITIONS: Partial<Record<WorkflowStatus, WorkflowStatus[]>> = {
  [WorkflowStatus.ACTIVE]: [WorkflowStatus.PAUSED, WorkflowStatus.ARCHIVED],
  [WorkflowStatus.PAUSED]: [WorkflowStatus.ACTIVE],
  [WorkflowStatus.DRAFT]: [WorkflowStatus.ACTIVE],
};

function isValidTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  // ─── Read ────────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    options: ListWorkflowsOptions = {},
  ): Promise<ListResult<WorkflowWithMeta>> {
    const { page = 1, limit = 20, status, search } = options;

    const where = {
      tenantId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              {
                description: { contains: search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.workflow.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { executions: true } } },
      }),
      this.prisma.workflow.count({ where }),
    ]);

    return {
      items: items.map((w) => this.mapWithMeta(w)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, tenantId: string): Promise<WorkflowWithMeta> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { executions: true } } },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }
    return this.mapWithMeta(workflow);
  }

  // ─── Create ──────────────────────────────────────────────────────────────

  async create(
    dto: CreateWorkflowDto,
    tenantId: string,
  ): Promise<WorkflowResponseDto> {
    const { nodes, edges, description, config, definition } = dto;

    const workflow = await this.prisma.workflow.create({
      data: {
        name: dto.name,
        description: description ?? null,
        isTemplate: dto.isTemplate ?? false,
        config: (config ?? {}) as object,
        definition: (definition ?? {
          nodes: nodes ?? [],
          edges: edges ?? [],
        }) as object,
        status: WorkflowStatus.DRAFT,
        isActive: false,
        tenantId,
        executionCount: 0,
        successRate: 0,
      },
    });

    return this.mapWithMeta({ ...workflow, _count: { executions: 0 } });
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateWorkflowDto,
    tenantId: string,
  ): Promise<WorkflowResponseDto> {
    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { executions: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    if (existing.status === WorkflowStatus.ACTIVE) {
      // Only allow status transition to PAUSED while ACTIVE
      if (dto.status !== undefined && dto.status !== WorkflowStatus.PAUSED) {
        throw new BadRequestException(
          'Active workflows can only be paused. Use /workflows/:id/execute to run, or deactivate first.',
        );
      }
    }

    const { nodes, edges, definition, config, ...rest } = dto;

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        ...rest,
        ...(config !== undefined ? { config: config as object } : {}),
        ...(definition !== undefined ||
        nodes !== undefined ||
        edges !== undefined
          ? {
              definition: {
                ...((typeof existing.definition === 'object'
                  ? existing.definition
                  : {}) as Record<string, unknown>),
                ...(definition ?? {}),
                ...(nodes !== undefined ? { nodes } : {}),
                ...(edges !== undefined ? { edges } : {}),
              } as object,
            }
          : {}),
      },
    });

    return this.mapWithMeta({ ...updated, _count: existing._count });
  }

  // ─── Delete ──────────────────────────────────────────────────────────────

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    if (
      existing.status !== WorkflowStatus.DRAFT &&
      existing.status !== WorkflowStatus.ARCHIVED
    ) {
      throw new ForbiddenException(
        'Only DRAFT or ARCHIVED workflows can be deleted.',
      );
    }

    await this.prisma.workflow.delete({ where: { id } });
  }

  // ─── Status transitions ─────────────────────────────────────────────────

  async activate(id: string, tenantId: string): Promise<WorkflowResponseDto> {
    return this.transitionStatus(id, tenantId, WorkflowStatus.ACTIVE);
  }

  async pause(id: string, tenantId: string): Promise<WorkflowResponseDto> {
    return this.transitionStatus(id, tenantId, WorkflowStatus.PAUSED);
  }

  private async transitionStatus(
    id: string,
    tenantId: string,
    targetStatus: WorkflowStatus,
  ): Promise<WorkflowResponseDto> {
    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { executions: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    if (!isValidTransition(existing.status, targetStatus)) {
      throw new BadRequestException(
        `Cannot transition workflow from ${existing.status} to ${targetStatus}.`,
      );
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        status: targetStatus,
        isActive: targetStatus === WorkflowStatus.ACTIVE,
      },
    });

    this.events.emitToTenant(tenantId, 'workflow:event', {
      workflowId: id,
      workflowName: existing.name,
      event:
        targetStatus === WorkflowStatus.ACTIVE
          ? 'workflow:activated'
          : 'workflow:paused',
      status: targetStatus,
      stageLabel:
        targetStatus === WorkflowStatus.ACTIVE ? 'Activation' : 'Pause requested',
      timestamp: Date.now(),
    });

    return this.mapWithMeta({ ...updated, _count: existing._count });
  }

  // ─── Execute ────────────────────────────────────────────────────────────

  async execute(
    id: string,
    tenantId: string,
    input?: Record<string, unknown>,
  ): Promise<{ executionId: string }> {
    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    if (existing.status !== WorkflowStatus.ACTIVE) {
      throw new BadRequestException(
        'Only ACTIVE workflows can be executed. Activate the workflow first.',
      );
    }

    // Create execution record
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId: id,
        tenantId,
        status: 'RUNNING',
      },
    });

    // Update workflow metadata
    await this.prisma.workflow.update({
      where: { id },
      data: {
        lastExecutedAt: new Date(),
        executionCount: { increment: 1 },
      },
    });

    this.events.emitToTenant(tenantId, 'workflow:event', {
      workflowId: id,
      workflowName: existing.name,
      event: 'workflow:started',
      status: existing.status,
      stageLabel: 'Execution started',
      executionId: execution.id,
      progressPercent: 10,
      detail: 'Workflow execution record created',
      input,
      timestamp: Date.now(),
    });

    this.events.emitToTenant(tenantId, 'workflow:progress', {
      workflowId: id,
      workflowName: existing.name,
      status: existing.status,
      stageLabel: 'Execution queued',
      executionId: execution.id,
      progressPercent: 25,
      detail: 'Workflow execution is queued for runtime processing',
      timestamp: Date.now(),
    });

    // TODO (Phase 2): Enqueue actual job via BullMQ here.
    // For now, we return the execution ID immediately.
    // The job worker would later call completeExecution / failExecution.

    return { executionId: execution.id };
  }

  async updateExecution(
    workflowId: string,
    executionId: string,
    tenantId: string,
    dto: UpdateWorkflowExecutionDto,
  ): Promise<{ executionId: string; status: string }> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId, workflowId, tenantId },
    });
    if (!execution) {
      throw new NotFoundException(`Workflow execution ${executionId} not found`);
    }
    if (execution.status !== 'RUNNING') {
      throw new BadRequestException(
        `Workflow execution ${executionId} is already ${execution.status}.`,
      );
    }

    const completedAt = new Date();
    const durationMs = Math.max(
      0,
      completedAt.getTime() - execution.startedAt.getTime(),
    );

    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: dto.status,
        completedAt,
        durationMs,
        errorMessage: dto.status === 'FAILED' ? dto.errorMessage ?? dto.detail ?? 'Workflow execution failed' : null,
      },
    });

    const executionAgg = await this.prisma.workflowExecution.aggregate({
      where: { workflowId, tenantId },
      _count: { _all: true },
    });
    const successCount = await this.prisma.workflowExecution.count({
      where: { workflowId, tenantId, status: 'COMPLETED' },
    });
    const totalRuns = executionAgg._count._all;
    const successRate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0;

    await this.prisma.workflow.update({
      where: { id: workflowId },
      data: {
        successRate,
      },
    });

    this.events.emitToTenant(tenantId, 'workflow:progress', {
      workflowId,
      workflowName: workflow.name,
      status: dto.status === 'COMPLETED' ? 'ARCHIVED' : 'ERROR',
      stageLabel: dto.status === 'COMPLETED' ? 'Execution completed' : 'Execution failed',
      executionId,
      progressPercent: 100,
      detail:
        dto.detail ??
        (dto.status === 'COMPLETED'
          ? 'Workflow execution completed successfully'
          : dto.errorMessage ?? 'Workflow execution failed'),
      timestamp: Date.now(),
    });

    this.events.emitToTenant(tenantId, 'workflow:event', {
      workflowId,
      workflowName: workflow.name,
      event: dto.status === 'COMPLETED' ? 'workflow:completed' : 'workflow:failed',
      status: dto.status === 'COMPLETED' ? 'ARCHIVED' : 'ERROR',
      stageLabel: dto.status === 'COMPLETED' ? 'Completed' : 'Failed',
      executionId,
      progressPercent: 100,
      detail:
        dto.detail ??
        (dto.status === 'COMPLETED'
          ? 'Workflow execution completed successfully'
          : dto.errorMessage ?? 'Workflow execution failed'),
      timestamp: Date.now(),
    });

    return { executionId, status: dto.status };
  }

  // ─── Status summary ─────────────────────────────────────────────────────

  async getStatus(
    id: string,
    tenantId: string,
  ): Promise<WorkflowExecutionSummaryDto> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    // Compute average duration from recent executions
    const recentExecutions = await this.prisma.workflowExecution.findMany({
      where: { workflowId: id },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    const completedOnes = recentExecutions.filter(
      (e) => e.completedAt && e.durationMs,
    );
    const avgDurationMs =
      completedOnes.length > 0
        ? Math.round(
            completedOnes.reduce((sum, e) => sum + (e.durationMs ?? 0), 0) /
              completedOnes.length,
          )
        : null;

    const lastExecution = workflow.executions[0] ?? null;

    return {
      workflowId: id,
      totalRuns: workflow.executionCount,
      successRate: workflow.successRate,
      avgDurationMs,
      lastRunAt: workflow.lastExecutedAt ?? null,
      status: workflow.status,
    };
  }

  async getExecutionHistory(
    id: string,
    tenantId: string,
    limit = 10,
  ): Promise<WorkflowExecutionHistoryItemDto[]> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    const executions = await this.prisma.workflowExecution.findMany({
      where: { workflowId: id, tenantId },
      orderBy: { startedAt: 'desc' },
      take: Math.max(1, Math.min(50, limit)),
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        durationMs: true,
        errorMessage: true,
      },
    });

    return executions.map((execution) => ({
      id: execution.id,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      durationMs: execution.durationMs,
      errorMessage: execution.errorMessage,
      createdAt: execution.startedAt,
    }));
  }

  // ─── Map Prisma model → response DTO ───────────────────────────────────

  /**
   * mapWithMeta — extracts nodes/edges from `definition` JSON and attaches
   * the execution count so the frontend adapter receives the expected shape.
   */
  private mapWithMeta(
    workflow: {
      id: string;
      name: string;
      description: string | null;
      status: WorkflowStatus;
      isActive: boolean;
      isTemplate: boolean;
      tenantId: string;
      definition: unknown;
      lastExecutedAt: Date | null;
      executionCount: number;
      successRate: number;
      createdAt: Date;
      updatedAt: Date;
      _count?: { executions?: number } | null;
    } & {
      _count?: { executions?: number };
    },
  ): WorkflowWithMeta {
    const def =
      typeof workflow.definition === 'object' && workflow.definition !== null
        ? (workflow.definition as Record<string, unknown>)
        : {};

    const dto: WorkflowWithMeta = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      isActive: workflow.isActive,
      isTemplate: workflow.isTemplate,
      tenantId: workflow.tenantId,
      definition: def,
      nodes: Array.isArray(def.nodes) ? def.nodes : [],
      edges: Array.isArray(def.edges) ? def.edges : [],
      lastExecutedAt: workflow.lastExecutedAt,
      executionCount: workflow.executionCount,
      successRate: workflow.successRate,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      _count: workflow._count ?? { executions: 0 },
    };

    return dto;
  }
}
