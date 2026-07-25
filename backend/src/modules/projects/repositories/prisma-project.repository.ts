/**
 * Projects Module — Prisma Repository Implementation
 *
 * Following SOLID:
 * - SRP: only data access for Project
 * - DIP: implements IProjectRepository
 */

import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EVENT_TRANSPORT } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { PublishEventInput } from '../../enterprise-events/contracts/enterprise-event.interface';
import type {
  IProjectRepository,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsOptions,
} from '../interfaces/project.interface';

@Injectable()
export class PrismaProjectRepository implements IProjectRepository {
  private readonly logger = new Logger(PrismaProjectRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    // Optional so the repository still stands alone in unit tests that don't
    // wire the fabric. When present, state changes + outbox rows are written
    // atomically (transactional outbox, ADR-001 §8).
    @Optional()
    @Inject(EVENT_TRANSPORT)
    private readonly transport?: IEnterpriseEventTransport,
  ) {}

  async create(data: CreateProjectInput, tenantId: string): Promise<Project> {
    this.logger.debug(`[DEBUG-REPO-CREATE] start: name=${data.name}, hasProjectTypeId=${!!data.projectTypeId}, hasDerivedShape=${!!data.derivedShape}, derivedShapeVersion=${data.derivedShapeVersion ?? 'none'}`);
    if (data.derivedShape) {
      this.logger.debug(`[DEBUG-REPO-CREATE] derivedShape size=${JSON.stringify(data.derivedShape).length} bytes`);
    }
    const createData: Prisma.ProjectUncheckedCreateInput = {
      tenantId,
      name: data.name,
      description: data.description ?? null,
      departmentId: data.departmentId ?? null,
      customerId: data.customerId ?? null,
      projectTypeId: data.projectTypeId ?? null,
      projectTypeVersion: data.projectTypeVersion ?? null,
      // INDUSTRY-SETUP-CONCEPT.md §3.1 G2 — callers (ProjectsService.create)
      // resolve this from synthesised shape or Tenant.industry and pass it in.
      industry: data.industry ?? null,
      budgetType: data.budgetType ?? null,
      budgetAmount:
        data.budgetAmount != null
          ? new Prisma.Decimal(data.budgetAmount)
          : null,
      budgetCurrency: data.budgetCurrency ?? 'USD',
      targetDate: this.toDate(data.targetDate),
      startDate: this.toDate(data.startDate),
      priority: data.priority ?? 'MEDIUM',
      tags: data.tags ?? [],
      goalIds: data.goalIds ?? [],
      customFieldValues: data.customFieldValues as
        | Prisma.InputJsonValue
        | undefined,
      metadata: (data.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      // FIX-PROJ-D1 (Round-3 verification): honour caller-supplied status
      // instead of hardcoding 'LEAD'. Without this, the FE wizard's
      // Status dropdown (Lead/Proposal/Won/Active/...) was silently
      // overwritten on every create. Default stays LEAD so legacy
      // callers without an explicit status are unaffected.
      status: data.status ?? 'LEAD',
      derivedShape: data.derivedShape
        ? (data.derivedShape as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      derivedShapeVersion: data.derivedShapeVersion ?? null,
    };

    // Phase 1: Persist the project.
    // The project MUST persist regardless of downstream event-publish
    // failures. Previously the creation was coupled in a transaction with
    // transport.publish() — if publish failed (e.g. enterpriseEventOutbox
    // unique constraint, Prisma model mismatch, connection drop), the
    // entire transaction rolled back silently and the project was never
    // persisted. This is the root cause of "chat says project created but
    // no row in DB".
    //
    // Phase 2 (fire-and-forget): Publish enterprise.project.created.
    // Logged but never rolled back — consistency for the event stream is
    // handled by the event fabric's own retry loop.
    this.logger.debug(`[DEBUG-REPO-CREATE] about to call prisma.project.create with createData=${JSON.stringify({ name: createData.name, tenantId: createData.tenantId, projectTypeId: createData.projectTypeId, derivedShape: createData.derivedShape ? 'present' : 'absent', status: createData.status })}`);
    let project: Awaited<ReturnType<PrismaService['project']['create']>>;
    try {
      project = await this.prisma.project.create({ data: createData });
      this.logger.debug(`[DEBUG-REPO-CREATE] prisma.project.create succeeded, project.id=${project.id}`);
    } catch (createErr) {
      this.logger.error(`[DEBUG-REPO-CREATE] prisma.project.create FAILED: ${createErr instanceof Error ? createErr.message : String(createErr)}, stack=${createErr instanceof Error ? createErr.stack : ''}`);
      throw createErr;
    }

    if (this.transport) {
      try {
        await this.transport.publish(
          {
            eventType: 'enterprise.project.created',
            tenantId,
            actorType: 'SYSTEM',
            idempotencyKey: `project.created.${project.id}`,
            sourceModule: 'projects',
            payload: {
              projectId: project.id,
              name: project.name,
              customerId: project.customerId,
              projectTypeId: project.projectTypeId,
              budgetAmount: project.budgetAmount
                ? Number(project.budgetAmount)
                : null,
              status: project.status,
            },
          } as PublishEventInput,
        );
      } catch (pubErr) {
        this.logger.error(
          `Failed to publish enterprise.project.created for ${project.id}: ${pubErr instanceof Error ? pubErr.message : String(pubErr)}`,
        );
        // Do NOT rethrow — the project is already persisted.
      }
    }

    return this.mapToProject(project);
  }

  async findById(id: string, tenantId: string): Promise<Project | null> {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
    });
    return project ? this.mapToProject(project) : null;
  }

  async findAll(
    options: ListProjectsOptions,
    tenantId: string,
  ): Promise<{ data: Project[]; total: number }> {
    const where: Record<string, unknown> = tenantId !== '*' ? { tenantId } : {};
    if (options.status) where.status = options.status;
    if (options.departmentId) where.departmentId = options.departmentId;
    if (options.customerId) where.customerId = options.customerId;
    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const page = options.page || 1;
    const limit = options.limit || 20;

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects.map((p) => this.mapToProject(p)),
      total,
    };
  }

  async findByDepartment(
    departmentId: string,
    tenantId: string,
  ): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      where: { departmentId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return projects.map((p) => this.mapToProject(p));
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateProjectInput,
  ): Promise<Project> {
    this.logger.debug(`Updating project: ${id}`);

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.projectTypeId !== undefined)
      updateData.projectTypeId = data.projectTypeId;
    if (data.projectTypeVersion !== undefined)
      updateData.projectTypeVersion = data.projectTypeVersion;
    if (data.industry !== undefined) updateData.industry = data.industry;
    if (data.budgetType !== undefined) updateData.budgetType = data.budgetType;
    if (data.budgetAmount !== undefined)
      updateData.budgetAmount =
        data.budgetAmount == null
          ? null
          : new Prisma.Decimal(data.budgetAmount);
    if (data.budgetCurrency !== undefined)
      updateData.budgetCurrency = data.budgetCurrency;
    if (data.departmentId !== undefined)
      updateData.departmentId = data.departmentId;
    if (data.targetDate !== undefined) {
      updateData.targetDate = this.toDate(data.targetDate);
    }
    if (data.startDate !== undefined) {
      updateData.startDate = this.toDate(data.startDate);
    }
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.goalIds !== undefined) updateData.goalIds = data.goalIds;
    if (data.metadata !== undefined)
      updateData.metadata = data.metadata as Prisma.InputJsonValue;
    if (data.customFieldValues !== undefined) {
      updateData.customFieldValues = data.customFieldValues
        ? (data.customFieldValues as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    if (data.lostReason !== undefined) updateData.lostReason = data.lostReason;

    if (this.transport) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const before = await tx.project.findUnique({
          where: { id },
          select: {
            budgetAmount: true,
            budgetCurrency: true,
            targetDate: true,
            startDate: true,
          },
        });
        const project = await tx.project.update({
          where: { id },
          data: updateData as Prisma.ProjectUpdateInput,
        });

        // Budget changed?
        const beforeBudget =
          before?.budgetAmount != null ? Number(before.budgetAmount) : null;
        const afterBudget =
          project.budgetAmount != null ? Number(project.budgetAmount) : null;
        if (data.budgetAmount !== undefined && beforeBudget !== afterBudget) {
          await this.transport!.publish(
            {
              eventType: 'enterprise.project.budget.changed',
              tenantId,
              actorType: 'SYSTEM',
              idempotencyKey: `project.budget.${id}.${afterBudget ?? 'null'}.${project.updatedAt.getTime()}`,
              sourceModule: 'projects',
              payload: {
                projectId: id,
                previousAmount: beforeBudget,
                newAmount: afterBudget,
                currency: project.budgetCurrency ?? 'USD',
              },
            } as PublishEventInput,
            tx,
          );
        }

        // Timeline changed?
        const timelineChanged =
          (data.targetDate !== undefined &&
            before?.targetDate?.getTime() !== project.targetDate?.getTime()) ||
          (data.startDate !== undefined &&
            before?.startDate?.getTime() !== project.startDate?.getTime());
        if (timelineChanged) {
          await this.transport!.publish(
            {
              eventType: 'enterprise.project.timeline.changed',
              tenantId,
              actorType: 'SYSTEM',
              idempotencyKey: `project.timeline.${id}.${project.updatedAt.getTime()}`,
              sourceModule: 'projects',
              payload: {
                projectId: id,
                previousStartDate: before?.startDate?.toISOString() ?? null,
                newStartDate: project.startDate?.toISOString() ?? null,
                previousTargetDate: before?.targetDate?.toISOString() ?? null,
                newTargetDate: project.targetDate?.toISOString() ?? null,
              },
            } as PublishEventInput,
            tx,
          );
        }
        return project;
      });
      return this.mapToProject(updated);
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: updateData as Prisma.ProjectUpdateInput,
    });
    return this.mapToProject(project);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
    });
    if (!project) {
      throw new Error(`Project ${id} not found for tenant ${tenantId}`);
    }
    await this.prisma.project.delete({ where: { id } });
    this.logger.log(`Deleted project ${id}`);
  }

  async setStatus(
    id: string,
    tenantId: string,
    status: Project['status'],
    extras?: { lostReason?: string | null; completedAt?: Date | null },
  ): Promise<Project> {
    const data: Record<string, unknown> = { status };
    if (extras?.lostReason !== undefined) data.lostReason = extras.lostReason;
    if (extras?.completedAt !== undefined)
      data.completedAt = extras.completedAt;

    if (this.transport) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const before = await tx.project.findUnique({
          where: { id },
          select: { status: true },
        });
        const row = await tx.project.update({
          where: { id },
          data: data as Prisma.ProjectUpdateInput,
        });
        await this.transport!.publish(
          {
            eventType: 'enterprise.project.status.changed',
            tenantId,
            actorType: 'SYSTEM',
            // Idempotency scoped to the exact transition so re-runs dedup but
            // distinct transitions each publish once.
            idempotencyKey: `project.status.${id}.${before?.status ?? 'UNKNOWN'}.${status}`,
            sourceModule: 'projects',
            payload: {
              projectId: id,
              fromStatus: before?.status ?? null,
              toStatus: status,
              reason: extras?.lostReason ?? null,
            },
          } as PublishEventInput,
          tx,
        );
        return row;
      });
      return this.mapToProject(updated);
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: data as Prisma.ProjectUpdateInput,
    });
    return this.mapToProject(updated);
  }

  async addGoal(
    projectId: string,
    goalId: string,
    tenantId: string,
  ): Promise<Project> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) throw new Error('Project not found');

    const currentGoalIds = project.goalIds || [];
    if (!currentGoalIds.includes(goalId)) {
      const updated = await this.prisma.project.update({
        where: { id: projectId },
        data: { goalIds: [...currentGoalIds, goalId] },
      });
      return this.mapToProject(updated);
    }
    return this.mapToProject(project);
  }

  async removeGoal(
    projectId: string,
    goalId: string,
    tenantId: string,
  ): Promise<Project> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) throw new Error('Project not found');

    const currentGoalIds = project.goalIds || [];
    const newGoalIds = currentGoalIds.filter((x: string) => x !== goalId);
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { goalIds: newGoalIds },
    });
    return this.mapToProject(updated);
  }

  async cloneFromProject(
    sourceProjectId: string,
    newName: string,
    tenantId: string,
  ): Promise<Project> {
    this.logger.debug(`Cloning project ${sourceProjectId} as "${newName}"`);

    const source = await this.prisma.project.findFirst({
      where: { id: sourceProjectId, tenantId },
    });
    if (!source) throw new Error(`Source project ${sourceProjectId} not found`);

    const [newProject, stages, members, decisions, memories] =
      await Promise.all([
        this.prisma.project.create({
          data: {
            tenantId,
            name: newName,
            description: source.description,
            departmentId: source.departmentId,
            customerId: source.customerId,
            projectTypeId: source.projectTypeId,
            projectTypeVersion: source.projectTypeVersion,
            budgetType:
              source.budgetType as Prisma.ProjectCreateInput['budgetType'],
            budgetAmount: source.budgetAmount,
            budgetCurrency: source.budgetCurrency,
            targetDate: source.targetDate,
            startDate: null,
            priority: source.priority as Prisma.ProjectCreateInput['priority'],
            tags: source.tags ?? [],
            goalIds: source.goalIds ?? [],
            customFieldValues:
              (source.customFieldValues as Prisma.InputJsonValue) ??
              Prisma.JsonNull,
            metadata:
              (source.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            status: 'LEAD',
            clonedFromProjectId: sourceProjectId,
          },
        }),
        this.prisma.projectStage.findMany({
          where: { projectId: sourceProjectId },
          orderBy: { order: 'asc' },
        }),
        this.prisma.projectMember.findMany({
          where: { projectId: sourceProjectId },
        }),
        this.prisma.projectDecision.findMany({
          where: { projectId: sourceProjectId },
        }),
        this.prisma.projectMemory.findMany({
          where: { projectId: sourceProjectId },
        }),
      ]);

    await Promise.all([
      this.prisma.projectStage.createMany({
        data: stages.map((s) => ({
          projectId: newProject.id,
          name: s.name,
          order: s.order,
          description: s.description,
          status: 'NOT_STARTED',
        })),
      }),
      this.prisma.projectMember.createMany({
        data: members.map((m) => ({
          projectId: newProject.id,
          actorId: m.actorId,
          actorType: m.actorType,
          role: m.role,
        })),
      }),
      this.prisma.projectDecision.createMany({
        data: decisions.map((d) => ({
          projectId: newProject.id,
          title: d.title,
          description: d.description,
          status: 'PROPOSED',
          votesFor: 0,
          votesAgainst: 0,
          abstentions: 0,
          rationale: d.rationale,
          meetingNotes: d.meetingNotes,
          linkedEntityType: d.linkedEntityType,
          linkedEntityId: d.linkedEntityId,
          metadata:
            d.metadata === null
              ? Prisma.JsonNull
              : (d.metadata as Prisma.InputJsonValue),
        })),
      }),
      this.prisma.projectMemory.createMany({
        data: memories.map((m) => ({
          projectId: newProject.id,
          authorId: m.authorId,
          authorType: m.authorType,
          category: m.category,
          content: m.content,
          sourceEntityType: m.sourceEntityType,
          sourceEntityId: m.sourceEntityId,
          isPinned: m.isPinned,
          isAiGenerated: m.isAiGenerated,
          supersededBy: null,
          metadata:
            m.metadata === null
              ? Prisma.JsonNull
              : (m.metadata as Prisma.InputJsonValue),
        })),
      }),
    ]);

    this.logger.log(
      `Cloned project ${sourceProjectId} → ${newProject.id} ` +
        `(${stages.length} stages, ${members.length} members, ` +
        `${decisions.length} decisions, ${memories.length} memories)`,
    );
    return this.mapToProject(newProject);
  }

  async createStages(
    projectId: string,
    stages: Array<{ name: string; order: number; description?: string }>,
  ): Promise<void> {
    if (stages.length === 0) return;
    await this.prisma.projectStage.createMany({
      data: stages.map((s) => ({
        projectId,
        name: s.name,
        order: s.order,
        description: s.description ?? null,
        status: 'NOT_STARTED',
      })),
    });
  }

  private toDate(v: Date | string | null | undefined): Date | null {
    if (v == null) return null;
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  private mapToProject(prismaProject: Record<string, unknown>): Project {
    return {
      id: prismaProject.id as string,
      tenantId: prismaProject.tenantId as string,
      name: prismaProject.name as string,
      description: (prismaProject.description as string | null) ?? null,
      status: prismaProject.status as Project['status'],
      customerId: (prismaProject.customerId as string | null) ?? null,
      projectTypeId: (prismaProject.projectTypeId as string | null) ?? null,
      projectTypeVersion:
        (prismaProject.projectTypeVersion as number | null) ?? null,
      // INDUSTRY-SETUP-CONCEPT.md §3.1 G2 — surface the schema column.
      industry: (prismaProject.industry as string | null) ?? null,
      budgetType: (prismaProject.budgetType as Project['budgetType']) ?? null,
      budgetAmount: this.toNumber(prismaProject.budgetAmount),
      budgetCurrency: (prismaProject.budgetCurrency as string | null) ?? null,
      goalIds: (prismaProject.goalIds as string[] | null) ?? [],
      departmentId: (prismaProject.departmentId as string | null) ?? null,
      parentProjectId: (prismaProject.parentProjectId as string | null) ?? null,
      clonedFromProjectId:
        (prismaProject.clonedFromProjectId as string | null) ?? null,
      lostReason: (prismaProject.lostReason as string | null) ?? null,
      customFieldValues:
        (prismaProject.customFieldValues as Record<string, unknown> | null) ??
        null,
      targetDate: (prismaProject.targetDate as Date | null) ?? null,
      startDate: (prismaProject.startDate as Date | null) ?? null,
      completedAt: (prismaProject.completedAt as Date | null) ?? null,
      priority: (prismaProject.priority as Project['priority']) ?? null,
      tags: (prismaProject.tags as string[] | null) ?? [],
      metadata: prismaProject.metadata,
      createdAt: prismaProject.createdAt as Date,
      updatedAt: prismaProject.updatedAt as Date,
    };
  }

  private toNumber(v: unknown): number | null {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof v === 'object' && v && 'toString' in v) {
      const s = (v as { toString(): string }).toString();
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
}
