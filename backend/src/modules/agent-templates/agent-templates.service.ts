import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AgentType } from '@prisma/client';
import type {
  CreateAgentTemplateDto,
  UpdateAgentTemplateDto,
} from './dto/agent-template.dto';
import {
  certifiedPlatformTemplateWhere,
  tenantVisibleTemplateWhere,
} from './agent-template-certification';

/**
 * AgentTemplatesService
 *
 * SRP: Manages CRUD for AgentTemplate records only.
 * OCP: New template fields can be added by extending DTOs without modifying this service.
 * Tenant isolation: Templates are either tenant-specific (tenantId set) or
 * platform-public (isPublic = true, tenantId = null). Both are visible to a tenant.
 */
@Injectable()
export class AgentTemplatesService {
  private readonly logger = new Logger(AgentTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    opts?: { type?: AgentType; page?: number; limit?: number },
  ) {
    try {
      const { type, page = 1, limit = 20 } = opts ?? {};
      const skip = (page - 1) * limit;

      const where = tenantVisibleTemplateWhere(
        tenantId,
        type ? { type } : {},
      );

      const [data, total] = await this.prisma.$transaction([
        this.prisma.agentTemplate.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ isPublic: 'asc' }, { createdAt: 'desc' }],
        }),
        this.prisma.agentTemplate.count({ where }),
      ]);

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    } catch (err) {
      this.logger.warn('Database error in findAll: ' + String(err));
      return {
        data: [],
        total: 0,
        page: opts?.page ?? 1,
        limit: opts?.limit ?? 20,
        totalPages: 0,
      };
    }
  }

  async findAllPlatform(opts?: {
    type?: AgentType;
    page?: number;
    limit?: number;
  }) {
    try {
      const { type, page = 1, limit = 20 } = opts ?? {};
      const skip = (page - 1) * limit;

      const where = certifiedPlatformTemplateWhere(type ? { type } : {});

      const [data, total] = await this.prisma.$transaction([
        this.prisma.agentTemplate.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ createdAt: 'desc' }],
        }),
        this.prisma.agentTemplate.count({ where }),
      ]);

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    } catch (err) {
      this.logger.warn('Database error in findAllPlatform: ' + String(err));
      return {
        data: [],
        total: 0,
        page: opts?.page ?? 1,
        limit: opts?.limit ?? 20,
        totalPages: 0,
      };
    }
  }

  async findOne(id: string, tenantId: string) {
    try {
      const template = await this.prisma.agentTemplate.findFirst({
        where: tenantVisibleTemplateWhere(tenantId, { id }),
      });
      if (!template)
        throw new NotFoundException(`Agent template ${id} not found`);
      return template;
    } catch (err) {
      this.logger.warn('Database error in findOne: ' + String(err));
      throw new ServiceUnavailableException('Database unavailable');
    }
  }

  /**
   * Phase 1 Gap 8 — Get template version history + deprecation status.
   * Returns current version, deprecation info, supersession chain,
   * and any agent instances still running this template (drift detection).
   */
  async getChangelog(id: string, tenantId: string) {
    const template = await this.findOne(id, tenantId);

    // Drift detection: agents spawned from this template
    const spawnedAgents = await this.prisma.agent.findMany({
      where: { templateId: id, tenantId },
      select: {
        id: true,
        name: true,
        status: true,
        templateVersion: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Supersession chain — find any template this is superseded by
    const supersededBy = template.supersededByTemplateId
      ? await this.prisma.agentTemplate.findUnique({
          where: { id: template.supersededByTemplateId },
          select: {
            id: true,
            name: true,
            version: true,
            deprecatedAt: true,
          },
        })
      : null;

    // Reverse chain — what templates superseded this one
    const supersededTemplates = await this.prisma.agentTemplate.findMany({
      where: { supersededByTemplateId: id },
      select: { id: true, name: true, version: true },
    });

    const driftCount = spawnedAgents.filter(
      (a) => a.templateVersion && a.templateVersion !== template.version,
    ).length;

    return {
      template: {
        id: template.id,
        name: template.name,
        version: template.version,
        deprecatedAt: template.deprecatedAt,
        type: template.type,
      },
      lifecycle: {
        isDeprecated: !!template.deprecatedAt,
        supersededBy,
        supersedes: supersededTemplates,
      },
      drift: {
        totalSpawned: spawnedAgents.length,
        driftedCount: driftCount,
        driftedAgents: spawnedAgents
          .filter((a) => a.templateVersion !== template.version)
          .map((a) => ({
            id: a.id,
            name: a.name,
            status: a.status,
            agentVersion: a.templateVersion,
            templateVersion: template.version,
          })),
      },
    };
  }

  async findOnePlatform(id: string) {
    try {
      const template = await this.prisma.agentTemplate.findFirst({
        where: certifiedPlatformTemplateWhere({ id }),
      });
      if (!template)
        throw new NotFoundException(`Platform agent template ${id} not found`);
      return template;
    } catch (err) {
      this.logger.warn('Database error in findOnePlatform: ' + String(err));
      throw new ServiceUnavailableException('Database unavailable');
    }
  }

  async create(tenantId: string, dto: CreateAgentTemplateDto) {
    try {
      return await this.prisma.agentTemplate.create({
        data: {
          name: dto.name,
          description: dto.description,
          type: dto.type ?? 'FUNCTIONAL',
          model: dto.model ?? 'gpt-4o-mini',
          systemPrompt: dto.systemPrompt,
          instructions: dto.instructions,
          permissions: (dto.permissions ?? []) as never,
          config: (dto.config ?? {}) as never,
          // Tenants cannot publish templates platform-wide.
          isPublic: false,
          version: dto.version ?? '1.0.0',
          tenantId,
        },
      });
    } catch (err) {
      this.logger.warn('Database error in create: ' + String(err));
      throw new ServiceUnavailableException('Database unavailable');
    }
  }

  async createPlatform(dto: CreateAgentTemplateDto) {
    const cfg = this.coerceConfig(dto.config);

    if (cfg.allowTenantEditing === undefined) {
      cfg.allowTenantEditing = true;
    }

    return this.prisma.agentTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type ?? 'FUNCTIONAL',
        model: dto.model ?? 'gpt-4o-mini',
        systemPrompt: dto.systemPrompt,
        instructions: dto.instructions,
        permissions: (dto.permissions ?? []) as never,
        config: cfg as never,
        isPublic: true,
        version: dto.version ?? '1.0.0',
        tenantId: null,
      },
    });
  }

  /**
   * Clone a platform template into a tenant-scoped template so the tenant can edit TORs safely.
   */
  async cloneToTenant(
    platformTemplateId: string,
    tenantId: string,
    opts?: { name?: string },
  ) {
    const template = await this.prisma.agentTemplate.findFirst({
      where: certifiedPlatformTemplateWhere({ id: platformTemplateId }),
    });
    if (!template)
      throw new NotFoundException(
        `Platform agent template ${platformTemplateId} not found`,
      );

    const cfg = this.coerceConfig(template.config);
    const allowTenantEditing = cfg.allowTenantEditing === true;
    if (!allowTenantEditing) {
      throw new ForbiddenException(
        'Tenant editing is disabled for this template',
      );
    }

    // If tenant already cloned this platform template, return the existing tenant-scoped copy.
    const existingClone = await this.prisma.agentTemplate.findFirst({
      where: {
        tenantId,
        config: {
          path: ['clonedFromPlatformTemplateId'],
          equals: template.id,
        },
      },
    });
    if (existingClone) return existingClone;

    return this.prisma.agentTemplate.create({
      data: {
        name: opts?.name?.trim() ? opts.name.trim() : template.name,
        description: template.description,
        type: template.type,
        model: template.model,
        systemPrompt: template.systemPrompt,
        instructions: template.instructions,
        permissions: (template.permissions ?? []) as never,
        config: {
          ...(template.config &&
          typeof template.config === 'object' &&
          !Array.isArray(template.config)
            ? template.config
            : {}),
          clonedFromPlatformTemplateId: template.id,
          clonedAt: new Date().toISOString(),
        } as never,
        isPublic: false,
        version: template.version,
        tenantId,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateAgentTemplateDto) {
    // Tenants can only update their own templates, not public ones
    const template = await this.prisma.agentTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!template)
      throw new NotFoundException(
        `Agent template ${id} not found or not yours`,
      );

    return this.prisma.agentTemplate.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type && { type: dto.type }),
        ...(dto.model && { model: dto.model }),
        ...(dto.systemPrompt !== undefined && {
          systemPrompt: dto.systemPrompt,
        }),
        ...(dto.instructions !== undefined && {
          instructions: dto.instructions,
        }),
        ...(dto.permissions && { permissions: dto.permissions as never }),
        ...(dto.config && { config: dto.config as never }),
        ...(dto.version && { version: dto.version }),
      },
    });
  }

  async updatePlatform(id: string, dto: UpdateAgentTemplateDto) {
    const template = await this.prisma.agentTemplate.findFirst({
      where: certifiedPlatformTemplateWhere({ id }),
    });
    if (!template)
      throw new NotFoundException(`Platform agent template ${id} not found`);

    return this.prisma.agentTemplate.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type && { type: dto.type }),
        ...(dto.model && { model: dto.model }),
        ...(dto.systemPrompt !== undefined && {
          systemPrompt: dto.systemPrompt,
        }),
        ...(dto.instructions !== undefined && {
          instructions: dto.instructions,
        }),
        ...(dto.permissions && { permissions: dto.permissions as never }),
        ...(dto.config && { config: dto.config as never }),
        ...(dto.version && { version: dto.version }),
        // Enforce platform invariants.
        isPublic: true,
        tenantId: null,
      },
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const template = await this.prisma.agentTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!template)
      throw new NotFoundException(
        `Agent template ${id} not found or not yours`,
      );
    await this.prisma.agentTemplate.delete({ where: { id } });
  }

  async removePlatform(id: string): Promise<void> {
    const template = await this.prisma.agentTemplate.findFirst({
      where: certifiedPlatformTemplateWhere({ id }),
    });
    if (!template)
      throw new NotFoundException(`Platform agent template ${id} not found`);
    await this.prisma.agentTemplate.delete({ where: { id } });
  }

  /**
   * Instantiate a template — returns a create-agent payload pre-filled from the template.
   * The caller (AgentsService.create) takes this as input.
   */
  async instantiate(id: string, tenantId: string) {
    const template = await this.findOne(id, tenantId);
    return {
      name: template.name,
      description: template.description,
      type: template.type,
      model: template.model,
      systemPrompt: template.systemPrompt,
      instructions: template.instructions,
      permissions: template.permissions,
      config: template.config,
      templateId: template.id,
    };
  }

  /**
   * Coerce a template `config` value (which Prisma stores as `JsonValue |
   * null`) into a typed `Record<string, unknown>` for callers that need to
   * read or set specific fields like `allowTenantEditing`.
   *
   * Replaces the previous `(cfg as any).allowTenantEditing` cast.
   */
  private coerceConfig(raw: unknown): Record<string, unknown> {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    return {};
  }
}
