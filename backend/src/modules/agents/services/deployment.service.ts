import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { certifiedPlatformTemplateWhere } from '../../agent-templates/agent-template-certification';
import { EventsGateway } from '../../events/events.gateway';
import type {
  SpawnAgentFromTemplateDto,
  BulkDeployAgentsDto,
  DeploySingleDepartmentDto,
} from '../dto/deployment.dto';
import type { DeployDeptTemplateDto } from '../dto/deployment.dto';
import {
  TenantTemplateRuntimeService,
  type AgentRoleOverride,
} from '../../tenant-templates/tenant-template-runtime.service';

/**
 * DeploymentService
 *
 * SRP : Solely responsible for deployment operations:
 *         1. Spawning agent instances from platform templates
 *         2. Bulk-deploying multiple agents to a tenant
 *         3. Deploying a department template structure to a tenant
 *       CRUD on agents stays in AgentsService.
 *       CRUD on templates stays in AgentTemplatesService.
 *       CRUD on dept templates stays in DepartmentTemplatesService.
 *
 * OCP : New deployment strategies (e.g. schedule-based) can be added without
 *       touching spawning logic.
 *
 * DIP : Consumed through constructor injection — no concrete class lookups.
 */
@Injectable()
export class DeploymentService {
  private readonly logger = new Logger(DeploymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly templateRuntime: TenantTemplateRuntimeService,
  ) {}

  /**
   * Convert a template name into a slug suitable for matching tenant-scoped
   * AGENT_ROLE templates. Example: "Compliance Officer" → "compliance-officer".
   * Used by Stage 1 §4.7 to look up tenant role overrides by template.
   */
  private nameToSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Stage 1 §4.7 — apply tenant-scoped AGENT_ROLE override to a platform
   * template. Returns the merged systemPrompt + KPI list if the tenant has
   * a matching AGENT_ROLE template; otherwise null.
   */
  private async loadAgentRoleOverride(
    tenantId: string,
    templateName: string,
    baseSystemPrompt: string | null,
  ): Promise<{
    systemPrompt: string;
    kpis?: AgentRoleOverride['kpis'];
    overrideSourceId?: string;
  }> {
    const slug = this.nameToSlug(templateName);
    const override = await this.templateRuntime.resolveAgentRoleOverride(
      tenantId,
      slug,
    );
    if (!override) {
      return { systemPrompt: baseSystemPrompt ?? '' };
    }
    return {
      systemPrompt: override.systemPrompt ?? baseSystemPrompt ?? '',
      kpis: override.kpis,
      overrideSourceId: override.sourceTemplateId,
    };
  }

  /**
   * Normalise actorId for the `agents.createdById` FK column. The column is
   * nullable (User?) and `actorId='SYSTEM'` indicates a programmatic spawn
   * (ProjectAutomationService, backfills, …). Storing 'SYSTEM' as the FK
   * value would violate the FK constraint because no user has that id —
   * so we collapse it to null. Real user ids (cuid format) pass through.
   */
  private normaliseActorId(actorId: string | null | undefined): string | null {
    if (!actorId) return null;
    if (actorId === 'SYSTEM') return null;
    return actorId;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Spawn one agent from a platform template
  // ─────────────────────────────────────────────────────────────────────────

  async spawnFromTemplate(
    templateId: string,
    dto: SpawnAgentFromTemplateDto,
    actorId: string,
    actorTenantId: string | null,
    actorRole: string,
  ) {
    // Normalise actorId → null when this is a programmatic ('SYSTEM') spawn,
    // because createdById is a nullable FK to users.id and 'SYSTEM' is not a
    // valid cuid. Real user actors (cuid format) pass through unchanged.
    const actorUserId = this.normaliseActorId(actorId);
    // Tenant scope enforcement: non-SUPER_ADMIN actors can only spawn into
    // their own tenant. Prevents cross-tenant privilege escalation.
    if (actorRole !== 'SUPER_ADMIN') {
      if (!actorTenantId) {
        throw new BadRequestException(
          'Tenant context required to spawn agents',
        );
      }
      if (dto.tenantId !== actorTenantId) {
        throw new BadRequestException(
          'Cannot spawn agents for a different tenant',
        );
      }
    }

    // Resolve the platform template
    const template = await this.prisma.agentTemplate.findFirst({
      where: certifiedPlatformTemplateWhere({ id: templateId }),
    });
    if (!template)
      throw new NotFoundException(
        `Platform agent template ${templateId} not found`,
      );

    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
      select: {
        id: true,
        tier: { select: { maxAgents: true } },
        _count: { select: { agents: true } },
      },
    });
    if (!tenant)
      throw new NotFoundException(`Tenant ${dto.tenantId} not found`);
    if (tenant._count.agents >= tenant.tier.maxAgents) {
      throw new BadRequestException(
        `Tenant has reached its agent limit of ${tenant.tier.maxAgents}. Upgrade tier before deploying more agents.`,
      );
    }

    // Copy template fields → new Agent
    // actorId='SYSTEM' (programmatic spawn) — set createdById to null since
    // there's no real user. Otherwise the FK constraint to users.id is
    // violated for non-user-actor spawns (ProjectAutomationService,
    // backfills, etc).
    const createdById = actorId === 'SYSTEM' ? null : actorId;

    // Stage 1 §4.7 — apply tenant AGENT_ROLE override (systemPrompt + KPIs)
    const roleOverride = await this.loadAgentRoleOverride(
      dto.tenantId,
      template.name,
      template.systemPrompt ?? null,
    );

    const agent = await this.prisma.agent.create({
      data: {
        name: dto.name,
        description: template.description,
        type: template.type,
        model: template.model,
        systemPrompt: roleOverride.systemPrompt,
        instructions: template.instructions,
        permissions: (template.permissions ?? []) as never,
        config: (template.config ?? {}) as never,
        budgetPerDay: dto.budgetPerDay
          ? (String(dto.budgetPerDay) as unknown as never)
          : null,
        isActive: true,
        tenantId: dto.tenantId,
        createdById,
        templateId,
        templateVersion: template.version,
        departmentId: dto.departmentId ?? null,
        // Store authority level inside config override
        metadata: {
          spawnedByAdmin: actorRole === 'SUPER_ADMIN',
          spawnedByOwner: actorRole === 'OWNER' || actorRole === 'ADMIN',
          authorityLevel: dto.authorityLevel ?? 'RECOMMENDATION',
          spawnedAt: new Date().toISOString(),
          ...(roleOverride.kpis ? { kpis: roleOverride.kpis } : {}),
          ...(roleOverride.overrideSourceId
            ? { roleOverrideTemplateId: roleOverride.overrideSourceId }
            : {}),
        },
      },
    });

    this.logger.log(
      `Spawned agent "${agent.name}" (${agent.id}) for tenant ${dto.tenantId} from template ${templateId} by ${actorRole}`,
    );
    this.events.emitAgentStatusUpdated(dto.tenantId, agent.id, 'IDLE');

    return agent;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Bulk-deploy multiple agents to a tenant in a single transaction
  // ─────────────────────────────────────────────────────────────────────────

  async bulkDeployAgents(
    tenantId: string,
    dto: BulkDeployAgentsDto,
    actorId: string,
  ) {
    // Verify tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        tier: { select: { maxAgents: true } },
        _count: { select: { agents: true } },
      },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    const slotsAvailable = tenant.tier.maxAgents - tenant._count.agents;
    if (dto.agents.length > slotsAvailable) {
      throw new BadRequestException(
        `Deploying ${dto.agents.length} agents would exceed the tier limit of ${tenant.tier.maxAgents}. Available slots: ${slotsAvailable}.`,
      );
    }

    // Resolve all template IDs in one query
    const templateIds = [...new Set(dto.agents.map((a) => a.templateId))];
    const templates = await this.prisma.agentTemplate.findMany({
      where: certifiedPlatformTemplateWhere({ id: { in: templateIds } }),
    });
    const templateMap = new Map(templates.map((t) => [t.id, t]));

    // Validate all templates exist before touching the DB
    for (const item of dto.agents) {
      if (!templateMap.has(item.templateId)) {
        throw new NotFoundException(
          `Platform agent template ${item.templateId} not found`,
        );
      }
    }

    // Create all agents in one transaction → all-or-nothing
    const created = await this.prisma.$transaction(
      dto.agents.map((item) => {
        const tmpl = templateMap.get(item.templateId)!;
        return this.prisma.agent.create({
          data: {
            name: item.name,
            description: tmpl.description,
            type: tmpl.type,
            model: tmpl.model,
            systemPrompt: tmpl.systemPrompt,
            instructions: tmpl.instructions,
            permissions: (tmpl.permissions ?? []) as never,
            config: (tmpl.config ?? {}) as never,
            budgetPerDay: item.budgetPerDay
              ? (String(item.budgetPerDay) as unknown as never)
              : null,
            isActive: true,
            tenantId,
            createdById: this.normaliseActorId(actorId),
            templateId: item.templateId,
            templateVersion: tmpl.version,
            departmentId: item.departmentId ?? null,
            metadata: {
              spawnedByAdmin: true,
              authorityLevel: item.authorityLevel ?? 'RECOMMENDATION',
            } as never,
          },
        });
      }),
    );

    this.logger.log(
      `Bulk-deployed ${created.length} agents to tenant ${tenantId}`,
    );
    return { deployed: created.length, agents: created };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Deploy a department template structure to a tenant
  //    Optionally auto-creates agents for each dept using matching templates
  // ─────────────────────────────────────────────────────────────────────────

  async deployDeptTemplate(
    tenantId: string,
    dto: DeployDeptTemplateDto,
    actorId: string,
  ) {
    // Verify tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        tier: { select: { maxAgents: true } },
        _count: { select: { agents: true } },
      },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    // Resolve template
    const tmpl = await this.prisma.departmentTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!tmpl)
      throw new NotFoundException(
        `Department template ${dto.templateId} not found`,
      );

    const structure = tmpl.structure as Array<{
      name: string;
      description?: string;
      headAgentType?: string;
      parentName?: string;
      agentTemplateNames?: string[];
    }>;

    // Build name → id map to resolve parentId references
    const nameToId = new Map<string, string>();

    // Sequential create (respects parent order)
    const createdDepts: { id: string; name: string }[] = [];
    for (const item of structure) {
      const dept = await this.prisma.department.create({
        data: {
          name: item.name,
          description: item.description,
          status: 'ACTIVE',
          tenantId,
          parentId: item.parentName
            ? (nameToId.get(item.parentName) ?? null)
            : null,
          metadata: {
            fromTemplate: tmpl.id,
            headAgentType: item.headAgentType,
          } as never,
        },
      });
      nameToId.set(item.name, dept.id);
      createdDepts.push({ id: dept.id, name: dept.name });
    }

    this.logger.log(
      `Deployed dept template "${tmpl.slug}" → ${createdDepts.length} departments for tenant ${tenantId}`,
    );

    // Optional: bootstrap head agents per department
    let agentCount = 0;
    if (dto.withAgents) {
      const agentTemplates = await this.prisma.agentTemplate.findMany({
        where: certifiedPlatformTemplateWhere(),
      });

      const templatesByName = new Map(
        agentTemplates.map((t) => [t.name.trim().toLowerCase(), t]),
      );
      const templatesByType = new Map<string, typeof agentTemplates>([
        ['EXECUTIVE', agentTemplates.filter((t) => t.type === 'EXECUTIVE')],
        ['CORE', agentTemplates.filter((t) => t.type === 'CORE')],
        ['FUNCTIONAL', agentTemplates.filter((t) => t.type === 'FUNCTIONAL')],
        ['META', agentTemplates.filter((t) => t.type === 'META')],
      ]);

      // Pre-check tenant agent limit before creating any agents
      const desiredAgentCount = structure.reduce((sum, item) => {
        const names = Array.isArray(item.agentTemplateNames)
          ? item.agentTemplateNames
          : [];
        if (names.length > 0) return sum + names.length;
        return item.headAgentType ? sum + 1 : sum;
      }, 0);
      const slotsAvailable = tenant.tier.maxAgents - tenant._count.agents;
      if (desiredAgentCount > slotsAvailable) {
        throw new BadRequestException(
          `Deploying ${desiredAgentCount} agents would exceed the tenant agent limit. Available slots: ${slotsAvailable}.`,
        );
      }

      for (const item of structure) {
        const deptId = nameToId.get(item.name)!;

        const explicitNames = Array.isArray(item.agentTemplateNames)
          ? item.agentTemplateNames
          : [];
        if (explicitNames.length > 0) {
          for (const roleName of explicitNames) {
            const matchTemplate = templatesByName.get(
              String(roleName).trim().toLowerCase(),
            );
            if (!matchTemplate) continue;

            await this.prisma.agent.create({
              data: {
                name: matchTemplate.name,
                description: matchTemplate.description,
                type: matchTemplate.type,
                model: matchTemplate.model,
                systemPrompt: matchTemplate.systemPrompt,
                instructions: matchTemplate.instructions,
                permissions: (matchTemplate.permissions ?? []) as never,
                config: (matchTemplate.config ?? {}) as never,
                isActive: true,
                tenantId,
                createdById: this.normaliseActorId(actorId),
                templateId: matchTemplate.id,
                templateVersion: matchTemplate.version,
                departmentId: deptId,
                metadata: {
                  spawnedByAdmin: true,
                  authorityLevel: 'RECOMMENDATION',
                  fromDeptTemplateId: tmpl.id,
                  departmentName: item.name,
                  roleTemplateName: matchTemplate.name,
                } as never,
              },
            });
            agentCount++;
          }
          continue;
        }

        // Back-compat: spawn a single "lead" agent using headAgentType
        const leadType = item.headAgentType ? String(item.headAgentType) : null;
        const candidates = leadType
          ? (templatesByType.get(leadType) ?? [])
          : [];
        const matchTemplate =
          candidates.find((t) => /lead/i.test(t.name)) ?? candidates[0] ?? null;
        if (!matchTemplate) continue;

        await this.prisma.agent.create({
          data: {
            name: `${item.name} Lead`,
            description: matchTemplate.description,
            type: matchTemplate.type,
            model: matchTemplate.model,
            systemPrompt: matchTemplate.systemPrompt,
            instructions: matchTemplate.instructions,
            permissions: (matchTemplate.permissions ?? []) as never,
            config: (matchTemplate.config ?? {}) as never,
            isActive: true,
            tenantId,
            createdById: this.normaliseActorId(actorId),
            templateId: matchTemplate.id,
            templateVersion: matchTemplate.version,
            departmentId: deptId,
            metadata: {
              spawnedByAdmin: true,
              authorityLevel: 'RECOMMENDATION',
              fromDeptTemplateId: tmpl.id,
              departmentName: item.name,
              roleTemplateName: matchTemplate.name,
            } as never,
          },
        });
        agentCount++;
      }
    }

    return {
      departments: createdDepts.length,
      agents: agentCount,
      details: createdDepts,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Deploy a SINGLE department from a DepartmentTemplate item
  //    Useful when tenants want to add a single department without
  //    re-deploying the whole template (which may have changed).
  // ─────────────────────────────────────────────────────────────────────────

  async deploySingleDepartment(
    tenantId: string,
    dto: DeploySingleDepartmentDto,
    actorId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        tier: { select: { maxDepartments: true, maxAgents: true } },
        _count: { select: { departments: true, agents: true } },
      },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    if (tenant._count.departments >= tenant.tier.maxDepartments) {
      throw new BadRequestException(
        `Tenant has reached its department limit (${tenant.tier.maxDepartments}).`,
      );
    }

    const tmpl = await this.prisma.departmentTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!tmpl)
      throw new NotFoundException(
        `Department template ${dto.templateId} not found`,
      );

    const structure = tmpl.structure as Array<{
      name: string;
      description?: string;
      headAgentType?: string;
      parentName?: string;
      agentTemplateNames?: string[];
    }>;

    const item = structure[dto.itemIndex];
    if (!item)
      throw new BadRequestException(
        `Item index ${dto.itemIndex} out of range (template has ${structure.length} items).`,
      );

    // Reject if a department with this name already exists for the tenant
    // (idempotency — caller can DELETE the existing one first if they
    // want a clean re-deploy).
    const existing = await this.prisma.department.findFirst({
      where: { tenantId, name: item.name },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        `Tenant already has a department named "${item.name}" (id=${existing.id}). Remove it first to re-deploy.`,
      );
    }

    const created = await this.prisma.department.create({
      data: {
        name: item.name,
        description: item.description ?? null,
        status: 'ACTIVE',
        tenantId,
        parentId: dto.parentDepartmentId ?? null,
        metadata: {
          fromTemplate: tmpl.id,
          fromTemplateItemIndex: dto.itemIndex,
          headAgentType: item.headAgentType,
          deployedBy: actorId,
        } as never,
      },
    });

    let agentCreated: { id: string; name: string } | null = null;
    if (dto.withHeadAgent) {
      const lead = item.headAgentType ?? 'FUNCTIONAL';
      const agentTemplates = await this.prisma.agentTemplate.findMany({
        where: certifiedPlatformTemplateWhere({ type: lead as never }),
      });
      const matchTemplate =
        agentTemplates.find((t) => /lead/i.test(t.name)) ??
        agentTemplates[0] ??
        null;
      if (matchTemplate) {
        const slotsAvailable = tenant.tier.maxAgents - tenant._count.agents;
        if (slotsAvailable <= 0) {
          throw new BadRequestException(
            `Tenant has no agent slots remaining; cannot bootstrap lead.`,
          );
        }
        const agent = await this.prisma.agent.create({
          data: {
            name: `${item.name} Lead`,
            description: matchTemplate.description,
            type: matchTemplate.type,
            model: matchTemplate.model,
            systemPrompt: matchTemplate.systemPrompt,
            instructions: matchTemplate.instructions,
            permissions: (matchTemplate.permissions ?? []) as never,
            config: (matchTemplate.config ?? {}) as never,
            isActive: true,
            tenantId,
            createdById: this.normaliseActorId(actorId),
            templateId: matchTemplate.id,
            templateVersion: matchTemplate.version,
            departmentId: created.id,
            metadata: {
              spawnedByAdmin: true,
              authorityLevel: 'RECOMMENDATION',
              fromDeptTemplateId: tmpl.id,
              departmentName: item.name,
              roleTemplateName: matchTemplate.name,
            } as never,
          },
        });
        agentCreated = { id: agent.id, name: agent.name };
      }
    }

    this.logger.log(
      `Single dept deploy: ${item.name} → tenant ${tenantId}` +
        (agentCreated ? ` with head agent ${agentCreated.id}` : ''),
    );

    return {
      department: {
        id: created.id,
        name: created.name,
        parentId: created.parentId,
      },
      headAgent: agentCreated,
    };
  }
}
