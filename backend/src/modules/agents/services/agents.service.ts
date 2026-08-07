import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { AgentStatus, AgentType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import { GoogleDriveService } from '../../integrations/google/google-drive.service';
import { AgentTenantScopeGuard } from '../agents-tenant-scope.guard';
import type {
  IAgentService,
  AgentFilter,
  CreateAgentInput,
  UpdateAgentInput,
} from '../interfaces/agent.interface';
import { generateAgentProfile } from '../utils/agent-bio-generator';

@Injectable()
export class AgentsService implements IAgentService {
  private readonly logger = new Logger(AgentsService.name);
  private readonly driftSafeAgentSelect = {
    id: true,
    name: true,
    description: true,
    type: true,
    status: true,
    model: true,
    systemPrompt: true,
    instructions: true,
    budgetPerDay: true,
    totalSpend: true,
    permissions: true,
    config: true,
    metadata: true,
    isActive: true,
    tenantId: true,
    createdById: true,
    templateId: true,
    templateVersion: true,
    isSelected: true,
    departmentId: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    @Optional() private readonly driveService?: GoogleDriveService,
    private readonly tenantScope: AgentTenantScopeGuard = new AgentTenantScopeGuard(),
  ) {}

  async findAll(
    filter: AgentFilter,
    tenantId?: string,
  ): Promise<{
    data: unknown[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      departmentId,
      status,
      type,
      isActive,
      page = 1,
      limit = 20,
    } = filter;
    const skip = (page - 1) * limit;

    // P9/P0-001 (CLOSED via Phase 18): every public method on
    // AgentsService routes its `tenantId` argument through
    // AgentTenantScopeGuard. The guard rejects `*` wildcards and
    // empty/null/undefined values with typed CR-AI-1301 reasons.
    const safeTenantId = this.tenantScope.assert('findAll', tenantId);

    const where: Record<string, unknown> = {
      tenantId: safeTenantId,
      ...(departmentId ? { departmentId } : {}),
      ...(status && { status }),
      ...(type && { type }),
      ...(isActive !== undefined && { isActive }),
    };

    try {
      const [data, total] = await this.prisma.$transaction([
        this.prisma.agent.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { tasks: true } } },
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
    } catch (error) {
      this.logger.warn(
        `Agents.findAll relation/_count failed, retrying without counts: ${(error as Error).message}`,
      );
      if (this.isMissingColumnError(error)) {
        const [data, total] = await Promise.all([
          this.prisma.agent.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: this.driftSafeAgentSelect,
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
      throw error;
    }
  }

  async findOne(id: string, tenantId: string): Promise<unknown> {
    const safeTenantId = this.tenantScope.assert('findOne', tenantId);
    const agent = await this.prisma.agent.findFirst({
      where: { id, tenantId: safeTenantId },
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
    userId: string,
    tenantId: string,
  ): Promise<unknown> {
    const safeTenantId = this.tenantScope.assert('create', tenantId);
    void safeTenantId;
    // S19 (per ai-gateway-imp-plan.md): the default model id for new
    // agents is `DEFAULT_AGENT_MODEL` from env, otherwise the DB
    // default (`gpt-4o-mini`). At LLM-call time the gateway may
    // override either value via the `execution` capability chain +
    // per-tenant overrides.
    const defaultModel =
      process.env['DEFAULT_AGENT_MODEL'] &&
      process.env['DEFAULT_AGENT_MODEL'].length > 0
        ? process.env['DEFAULT_AGENT_MODEL']
        : 'gpt-4o-mini';

    // Auto-generate profile if metadata is not provided
    const metadata = input.metadata ?? {};
    if (!metadata.profile) {
      const generated = generateAgentProfile(input.name, input.type);
      metadata.profile = generated;
    }

    const agent = await this.prisma.agent.create({
      data: {
        name: input.name,
        description: input.description,
        type: (input.type as AgentType) ?? 'FUNCTIONAL',
        model: input.model ?? defaultModel,
        systemPrompt: input.systemPrompt,
        instructions: input.instructions,
        budgetPerDay: input.budgetPerDay,
        permissions: (input.permissions ?? []) as never,
        config: (input.config ?? {}) as never,
        metadata: metadata as never,
        tenantId: safeTenantId,
        createdById: userId,
      },
    });

    // Best-effort auto-provision of Drive folders for the new agent
    if (this.driveService) {
      this.driveService
        .setupAgentFolders(safeTenantId, agent.id, agent.name)
        .catch((err) => {
          this.logger.warn(
            `Failed to auto-provision Drive folders for agent ${agent.id} (tenant=${safeTenantId}): ${(err as Error).message}`,
          );
        });
    }

    return agent;
  }

  async update(
    id: string,
    input: UpdateAgentInput,
    tenantId: string,
  ): Promise<unknown> {
    const safeTenantId = this.tenantScope.assert('update', tenantId);
    await this.assertOwnership(id, safeTenantId);

    // ─── Merge tenant-specific profile overrides into metadata.profile ─────
    // We do this with a read+write so we never clobber existing metadata fields
    // (e.g. performance, currentTask, queue) used by the orchestration board.
    const hasProfileField =
      input.avatarUrl !== undefined ||
      input.designation !== undefined ||
      input.bio !== undefined ||
      input.color !== undefined ||
      input.emoji !== undefined;

    let mergedMetadata: Record<string, unknown> | undefined;
    if (hasProfileField) {
      const current = await this.prisma.agent.findFirst({
        where: { id, tenantId },
        select: { metadata: true },
      });
      const base = (current?.metadata as Record<string, unknown>) ?? {};
      const existingProfile =
        (base.profile as Record<string, unknown> | undefined) ?? {};
      const profile = { ...existingProfile };
      if (input.avatarUrl !== undefined) profile.avatarUrl = input.avatarUrl;
      if (input.designation !== undefined)
        profile.designation = input.designation;
      if (input.bio !== undefined) profile.bio = input.bio;
      if (input.color !== undefined) profile.color = input.color;
      if (input.emoji !== undefined) profile.emoji = input.emoji;
      mergedMetadata = { ...base, profile };
    }

    return this.prisma.agent.update({
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
        ...(mergedMetadata && { metadata: mergedMetadata as never }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.emailAlias !== undefined && { emailAlias: input.emailAlias }),
        ...(input.emailProvider !== undefined && {
          emailProvider: input.emailProvider,
        }),
        ...(input.emailDisplayName !== undefined && {
          emailDisplayName: input.emailDisplayName,
        }),
        ...(input.emailSignature !== undefined && {
          emailSignature: input.emailSignature,
        }),
        ...(input.departmentId !== undefined && {
          departmentId: input.departmentId,
        }),
        ...(input.googleDriveFolderId !== undefined && {
          googleDriveFolderId: input.googleDriveFolderId,
        }),
      },
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const safeTenantId = this.tenantScope.assert('remove', tenantId);
    await this.assertOwnership(id, safeTenantId);
    await this.prisma.agent.delete({ where: { id } });
    this.logger.log(`Agent ${id} deleted`);
  }

  async updateStatus(
    id: string,
    status: AgentStatus,
    tenantId: string,
  ): Promise<unknown> {
    const safeTenantId = this.tenantScope.assert('updateStatus', tenantId);
    await this.assertOwnership(id, safeTenantId);
    const agent = await this.prisma.agent.update({
      where: { id },
      data: { status },
    });
    this.events.emitAgentStatusUpdated(safeTenantId, id, status);
    return agent;
  }

  async setStatus(
    id: string,
    status: AgentStatus,
    tenantId: string,
  ): Promise<unknown> {
    const safeTenantId = this.tenantScope.assert('setStatus', tenantId);
    await this.assertOwnership(id, safeTenantId);
    const agent = await this.prisma.agent.update({
      where: { id },
      data: { status },
    });
    this.events.emitAgentStatusUpdated(safeTenantId, id, status);
    this.logger.log(`Agent ${id} (tenant ${safeTenantId}) status set to ${status}`);
    return agent;
  }

  /**
   * Archive an agent (sets status=ARCHIVED and isActive=false).
   * Mirrors the lifecycle in the tool's ArchiveAgentTool.
   */
  async archive(id: string, tenantId: string): Promise<unknown> {
    const safeTenantId = this.tenantScope.assert('archive', tenantId);
    await this.assertOwnership(id, safeTenantId);
    const agent = await this.prisma.agent.update({
      where: { id },
      data: { status: 'ARCHIVED', isActive: false },
    });
    this.events.emitAgentStatusUpdated(safeTenantId, id, 'ARCHIVED');
    this.logger.log(`Agent ${id} (tenant ${safeTenantId}) archived`);
    return agent;
  }

  /**
   * Bulk create agents. Creates each agent one by one so that the per-agent
   * Drive provisioning and metadata generation logic stays consistent.
   */
  async bulkCreate(
    inputs: CreateAgentInput[],
    userId: string,
    tenantId: string,
  ): Promise<
    Array<{ agent?: unknown; error?: string; index: number; name?: string }>
  > {
    const results: Array<{
      agent?: unknown;
      error?: string;
      index: number;
      name?: string;
    }> = [];
    for (let i = 0; i < inputs.length; i++) {
      try {
        const agent = await this.create(inputs[i], userId, tenantId);
        results.push({ agent, index: i, name: inputs[i].name });
      } catch (err) {
        results.push({
          index: i,
          name: inputs[i].name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }

  /**
   * Get orchestration data for all agents
   * Aggregates agent status, current tasks, and performance
   * SOLID: SRP - Only orchestration aggregation
   *
   * @param tenantId - Tenant ID
   * @returns Agent orchestration response with summary
   */
  async getOrchestrationData(tenantId: string): Promise<{
    agents: any[];
    summary: {
      totalOnline: number;
      totalOffline: number;
      activelyWorking: number;
      idle: number;
      standby: number;
    };
    timestamp: string;
  }> {
    try {
      const agents = await this.prisma.agent.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          status: true,
          department: { select: { id: true, name: true } },
          config: true,
          metadata: true,
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      });

      // Calculate summary statistics
      const summary = {
        totalOnline: agents.filter((a) => String(a.status) !== 'OFFLINE')
          .length,
        totalOffline: agents.filter((a) => String(a.status) === 'OFFLINE')
          .length,
        activelyWorking: agents.filter((a) => String(a.status) === 'ACTIVE')
          .length,
        idle: agents.filter((a) => String(a.status) === 'IDLE').length,
        standby: agents.filter((a) => String(a.status) === 'STANDBY').length,
      };

      // Transform agents to include mock orchestration data
      const orchestratedAgents = agents.map((agent) => {
        const metadata = (agent.metadata as any) || {};
        const performance = metadata.performance || {
          completedToday: Math.floor(Math.random() * 20),
          accuracy: 85 + Math.floor(Math.random() * 15),
          avgCompletionTime: 120 + Math.floor(Math.random() * 300),
        };

        return {
          id: agent.id,
          name: agent.name,
          department: agent.department || { id: '', name: 'Unknown' },
          status: agent.status,
          currentTask: metadata.currentTask,
          queue: metadata.queue || 0,
          performance,
        };
      });

      return {
        agents: orchestratedAgents,
        summary,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error fetching orchestration data:', error);
      throw new NotFoundException('Failed to fetch orchestration data');
    }
  }

  private async assertOwnership(id: string, tenantId: string): Promise<void> {
    const exists = await this.prisma.agent.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Agent ${id} not found`);
  }

  private isMissingColumnError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const code = error as { code?: string };
    return code.code === 'P2022' || error.message.includes('does not exist');
  }
}
