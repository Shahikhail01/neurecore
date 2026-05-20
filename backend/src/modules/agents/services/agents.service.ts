import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { AgentStatus, AgentType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import type {
  IAgentService,
  AgentFilter,
  CreateAgentInput,
  UpdateAgentInput,
} from '../interfaces/agent.interface';
import { AgentVersionService } from './agent-version.service';
import { AssignmentService } from '../../tiers/services/assignment.service';
import { TenantResourcePolicyService } from '../../tiers/services/tenant-resource-policy.service';

/**
 * AgentsService
 *
 * Responsibility (SRP): CRUD operations on Agent records.  Does NOT plan or
 * execute — those concerns live in AgentPlannerService / AgentExecutorService.
 */
@Injectable()
export class AgentsService implements IAgentService {
  private readonly logger = new Logger(AgentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly agentVersionService: AgentVersionService,
    private readonly assignmentService: AssignmentService,
    private readonly tenantPolicy: TenantResourcePolicyService,
  ) {}

  async findAll(filter: AgentFilter): Promise<{
    data: unknown[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      tenantId,
      departmentId,
      status,
      type,
      isActive,
      page = 1,
      limit = 20,
    } = filter;
    const skip = (page - 1) * limit;

    const where = {
      ...(tenantId ? { tenantId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(status && { status }),
      ...(type && { type }),
      ...(isActive !== undefined && { isActive }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              tierId: true,
              tier: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  maxAgents: true,
                },
              },
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: { select: { tasks: true } },
        },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string): Promise<unknown> {
    const agent = await this.prisma.agent.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { tasks: true, memoryEntries: true, executionLogs: true },
        },
      },
    });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);
    return agent;
  }

  async findOneForPlatform(id: string): Promise<unknown> {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tasks: true, memoryEntries: true, executionLogs: true },
        },
      },
    });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);
    return agent;
  }

  async create(
    input: CreateAgentInput,
    tenantId: string,
    userId: string,
  ): Promise<unknown> {
    const resolvedDepartmentId = input.departmentId
      ? await this.assignmentService.resolveDepartmentAssignment(
          tenantId,
          input.departmentId,
        )
      : null;

    const slotAssignment = input.tierAgentPoolId
      ? await this.tenantPolicy.assertTierAgentPoolBelongsToTenant(
          tenantId,
          input.tierAgentPoolId,
        )
      : null;

    return this.prisma.agent.create({
      data: {
        name: input.name,
        description: input.description,
        type: (input.type as AgentType) ?? 'FUNCTIONAL',
        model: input.model ?? 'gpt-4o-mini',
        systemPrompt: input.systemPrompt,
        instructions: input.instructions,
        budgetPerDay: input.budgetPerDay,
        permissions: (input.permissions ?? []) as never,
        config: (input.config ?? {}) as never,
        metadata: (input.metadata ?? {}) as never,
        departmentId: resolvedDepartmentId,
        tierAgentPoolId: slotAssignment?.poolSlot.id,
        deployedFromTierId: slotAssignment?.tenant.tierId,
        isFixed:
          slotAssignment?.poolSlot.slotType === 'FIXED' ||
          slotAssignment?.poolSlot.isRequired ||
          false,
        isSelected: input.isSelected ?? true,
        tenantId,
        createdById: userId,
      },
    });
  }

  async update(
    id: string,
    input: UpdateAgentInput,
    tenantId: string,
  ): Promise<unknown> {
    const existingAgent = await this.getOwnedAgent(id, tenantId);

    const effectiveTenantId = input.tenantId ?? tenantId;
    const isTenantReassignment = effectiveTenantId !== tenantId;

    if (isTenantReassignment) {
      const targetTenant = await this.prisma.tenant.findUnique({
        where: { id: effectiveTenantId },
        select: { id: true },
      });
      if (!targetTenant) {
        throw new NotFoundException(`Tenant ${effectiveTenantId} not found`);
      }
    }

    const resolvedDepartmentId = input.departmentId
      ? await this.assignmentService.resolveDepartmentAssignment(
          effectiveTenantId,
          input.departmentId,
        )
      : undefined;

    const slotAssignment = input.tierAgentPoolId
      ? await this.tenantPolicy.assertTierAgentPoolBelongsToTenant(
          effectiveTenantId,
          input.tierAgentPoolId,
        )
      : undefined;

    const updated = await this.prisma.agent.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.status && { status: input.status }),
        ...(input.model && { model: input.model }),
        ...(input.systemPrompt !== undefined && {
          systemPrompt: input.systemPrompt,
        }),
        ...(input.instructions !== undefined && {
          instructions: input.instructions,
        }),
        ...(input.budgetPerDay !== undefined && {
          budgetPerDay: input.budgetPerDay,
        }),
        ...(input.permissions && { permissions: input.permissions as never }),
        ...(input.config && { config: input.config as never }),
        ...(input.metadata && { metadata: input.metadata as never }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.tenantId && { tenantId: effectiveTenantId }),
        ...(resolvedDepartmentId !== undefined && {
          departmentId: resolvedDepartmentId,
        }),
        ...(isTenantReassignment &&
          input.departmentId === undefined && {
            departmentId: null,
          }),
        ...(slotAssignment !== undefined && {
          tierAgentPoolId: slotAssignment.poolSlot.id,
          deployedFromTierId: slotAssignment.tenant.tierId,
          isFixed:
            slotAssignment.poolSlot.slotType === 'FIXED' ||
            slotAssignment.poolSlot.isRequired,
        }),
        ...(isTenantReassignment &&
          input.tierAgentPoolId === undefined && {
            tierAgentPoolId: null,
            deployedFromTierId: null,
            isFixed: false,
          }),
        ...(input.isSelected !== undefined && { isSelected: input.isSelected }),
      },
    });

    // Auto-snapshot: fire-and-forget so version failures never block caller.
    this.agentVersionService
      .snapshotAgent({
        agentId: id,
        tenantId,
        label: 'Auto-save',
        changeNote: 'Automatic snapshot on agent update',
        changedBy: 'system',
        configSnapshot: this.agentVersionService.buildSnapshot(
          updated as Record<string, unknown>,
        ),
      })
      .catch((err: unknown) =>
        this.logger.warn(
          `Auto-snapshot failed for agent ${id}: ${String(err)}`,
        ),
      );

    return updated;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.assertOwnership(id, tenantId);
    await this.prisma.agent.delete({ where: { id } });
    this.logger.log(`Agent ${id} deleted from tenant ${tenantId}`);
  }

  async updateStatus(
    id: string,
    status: AgentStatus,
    tenantId: string,
  ): Promise<unknown> {
    await this.assertOwnership(id, tenantId);
    const agent = await this.prisma.agent.update({
      where: { id },
      data: { status },
    });
    this.events.emitAgentStatusUpdated(tenantId, id, status);
    return agent;
  }

  // ───────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────

  private async assertOwnership(id: string, tenantId: string): Promise<void> {
    const exists = await this.getOwnedAgent(id, tenantId);
    if (!exists) throw new NotFoundException(`Agent ${id} not found`);
  }

  private async getOwnedAgent(id: string, tenantId: string) {
    const exists = await this.prisma.agent.findFirst({
      where: { id, tenantId },
      select: { id: true, tenantId: true },
    });
    if (!exists) throw new NotFoundException(`Agent ${id} not found`);
    return exists;
  }
}
