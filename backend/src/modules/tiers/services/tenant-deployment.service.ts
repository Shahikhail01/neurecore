import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import type {
  BulkDeployAgentsDto,
  DeployDeptTemplateDto,
  SpawnAgentFromTemplateDto,
} from '../../agents/dto/deployment.dto';
import { AssignmentService } from './assignment.service';
import { TenantResourcePolicyService } from './tenant-resource-policy.service';

export interface ProvisioningResult {
  tenantId: string;
  tierId: string;
  agentsProvisioned: number;
  agentIds: string[];
}

export interface TierDeploymentPreview {
  tenantId: string;
  tenantName: string;
  currentTier: {
    id: string;
    name: string;
    slug: string;
    maxAgents: number;
  };
  targetTier: {
    id: string;
    name: string;
    slug: string;
    maxAgents: number;
  };
  usage: {
    selectedAgents: number;
    selectedDepartments: number;
  };
  compatibility: {
    canChange: boolean;
    blockingReasons: string[];
  };
  impact: {
    agentsToProvision: Array<{
      templateId: string;
      templateName: string;
      slotType: string;
    }>;
    departmentsToProvision: Array<{
      templateId: string;
      templateName: string;
      slotType: string;
    }>;
    reusableAgents: Array<{
      id: string;
      name: string;
      templateId: string | null;
    }>;
    reusableDepartments: Array<{
      id: string;
      name: string;
      templateId: string | null;
    }>;
    tierLinkedAgentsOutsideTargetPolicy: Array<{
      id: string;
      name: string;
      templateId: string | null;
    }>;
    tierLinkedDepartmentsOutsideTargetPolicy: Array<{
      id: string;
      name: string;
      templateId: string | null;
    }>;
  };
}

export interface DepartmentProvisioningResult {
  tenantId: string;
  tierId: string;
  departmentsProvisioned: number;
  departmentIds: string[];
  departmentsReused: number;
}

export interface TierBootstrapResult {
  tenantId: string;
  tierId: string;
  departmentsProvisioned: number;
  departmentIds: string[];
  departmentsReused: number;
  agentsProvisioned: number;
  agentIds: string[];
  agentsReused: number;
}

type SelectedAgent = {
  id: string;
  name: string;
  templateId: string | null;
  tierAgentPoolId: string | null;
  deployedFromTierId: string | null;
};

type SelectedDepartment = {
  id: string;
  name: string;
  templateId: string | null;
  tierDepartmentPoolId: string | null;
  deployedFromTierId: string | null;
};

@Injectable()
export class TenantDeploymentService {
  private readonly logger = new Logger(TenantDeploymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly assignments: AssignmentService,
    private readonly tenantPolicy: TenantResourcePolicyService,
  ) {}

  async spawnFromTemplate(
    templateId: string,
    dto: SpawnAgentFromTemplateDto,
    actorId: string,
  ) {
    const template = await this.prisma.agentTemplate.findFirst({
      where: { id: templateId, isPublic: true, tenantId: null },
    });
    if (!template) {
      throw new NotFoundException(
        `Platform agent template ${templateId} not found`,
      );
    }

    const tenant = await this.tenantPolicy.assertTenantExists(dto.tenantId);
    const currentAgentCount = await this.prisma.agent.count({
      where: { tenantId: dto.tenantId },
    });
    if (currentAgentCount >= tenant.tier.maxAgents) {
      throw new BadRequestException(
        `Tenant has reached its agent limit of ${tenant.tier.maxAgents}. Upgrade tier before deploying more agents.`,
      );
    }

    const resolvedDepartmentId =
      await this.assignments.resolveDepartmentAssignment(
        dto.tenantId,
        dto.departmentId,
      );

    const agent = await this.prisma.agent.create({
      data: {
        name: dto.name,
        description: template.description,
        type: template.type,
        model: template.model,
        systemPrompt: template.systemPrompt,
        instructions: template.instructions,
        permissions: (template.permissions ?? []) as never,
        config: (template.config ?? {}) as never,
        budgetPerDay: dto.budgetPerDay
          ? (String(dto.budgetPerDay) as unknown as never)
          : null,
        isActive: true,
        isSelected: true,
        tenantId: dto.tenantId,
        createdById: actorId,
        templateId,
        templateVersion: template.version,
        departmentId: resolvedDepartmentId,
        metadata: {
          spawnedByAdmin: true,
          authorityLevel: dto.authorityLevel ?? 'RECOMMENDATION',
        } as never,
      },
    });

    this.logger.log(
      `Spawned agent "${agent.name}" (${agent.id}) for tenant ${dto.tenantId} from template ${templateId}`,
    );
    this.events.emitAgentStatusUpdated(dto.tenantId, agent.id, 'IDLE');

    return agent;
  }

  async bulkDeployAgents(
    tenantId: string,
    dto: BulkDeployAgentsDto,
    actorId: string,
  ) {
    const tenant = await this.tenantPolicy.assertTenantExists(tenantId);
    const currentAgentCount = await this.prisma.agent.count({
      where: { tenantId },
    });
    const slotsAvailable = tenant.tier.maxAgents - currentAgentCount;
    if (dto.agents.length > slotsAvailable) {
      throw new BadRequestException(
        `Deploying ${dto.agents.length} agents would exceed the tier limit of ${tenant.tier.maxAgents}. Available slots: ${slotsAvailable}.`,
      );
    }

    const templateIds = [...new Set(dto.agents.map((a) => a.templateId))];
    const templates = await this.prisma.agentTemplate.findMany({
      where: { id: { in: templateIds }, isPublic: true, tenantId: null },
    });
    const templateMap = new Map(templates.map((t) => [t.id, t]));

    for (const item of dto.agents) {
      if (!templateMap.has(item.templateId)) {
        throw new NotFoundException(
          `Platform agent template ${item.templateId} not found`,
        );
      }
      if (item.departmentId) {
        await this.tenantPolicy.assertDepartmentBelongsToTenant(
          tenantId,
          item.departmentId,
        );
      }
    }

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
            isSelected: true,
            tenantId,
            createdById: actorId,
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

  async deployDeptTemplate(
    tenantId: string,
    dto: DeployDeptTemplateDto,
    actorId: string,
  ) {
    const tenant = await this.tenantPolicy.assertTenantExists(tenantId);
    await this.tenantPolicy.assertNoDuplicateFixedDepartmentTemplateDeployment(
      tenantId,
      dto.templateId,
    );
    const tmpl = await this.prisma.departmentTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!tmpl) {
      throw new NotFoundException(
        `Department template ${dto.templateId} not found`,
      );
    }

    const structure = tmpl.structure as Array<{
      name: string;
      description?: string;
      headAgentType?: string;
      parentName?: string;
      agentTemplateNames?: string[];
    }>;

    const nameToId = new Map<string, string>();
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
          templateId: tmpl.id,
          isFixed: false,
          isSelected: true,
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
      `Deployed dept template "${tmpl.slug}" -> ${createdDepts.length} departments for tenant ${tenantId}`,
    );

    let agentCount = 0;
    if (dto.withAgents) {
      const agentTemplates = await this.prisma.agentTemplate.findMany({
        where: { isPublic: true, tenantId: null },
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

      const desiredAgentCount = structure.reduce((sum, item) => {
        const names = Array.isArray(item.agentTemplateNames)
          ? item.agentTemplateNames
          : [];
        if (names.length > 0) return sum + names.length;
        return item.headAgentType ? sum + 1 : sum;
      }, 0);

      const currentAgentCount = await this.prisma.agent.count({
        where: { tenantId },
      });
      const slotsAvailable = tenant.tier.maxAgents - currentAgentCount;
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
                isSelected: true,
                tenantId,
                createdById: actorId,
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
            isSelected: true,
            tenantId,
            createdById: actorId,
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

  async previewTierBootstrap(
    tenantId: string,
    tierId: string,
  ): Promise<TierDeploymentPreview> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tier: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const targetTier = await this.prisma.tier.findUnique({
      where: { id: tierId },
    });
    if (!targetTier) {
      throw new NotFoundException(`Tier ${tierId} not found`);
    }

    const [
      selectedAgents,
      selectedDepartments,
      targetAgentPool,
      targetDepartmentPool,
    ] = await Promise.all([
      this.prisma.agent.findMany({
        where: { tenantId, isSelected: true },
        select: {
          id: true,
          name: true,
          templateId: true,
          tierAgentPoolId: true,
          deployedFromTierId: true,
        },
      }),
      this.prisma.department.findMany({
        where: { tenantId, isSelected: true },
        select: {
          id: true,
          name: true,
          templateId: true,
          tierDepartmentPoolId: true,
          deployedFromTierId: true,
        },
      }),
      this.prisma.tierAgentPool.findMany({
        where: { tierId },
        include: { template: true },
        orderBy: { slot: 'asc' },
      }),
      this.prisma.tierDepartmentPool.findMany({
        where: { tierId },
        include: { departmentTemplate: true },
        orderBy: { slot: 'asc' },
      }),
    ]);

    const desiredAgentPool = this.getDesiredAgentPoolEntries(targetAgentPool);
    const desiredDepartmentPool =
      this.getDesiredDepartmentPoolEntries(targetDepartmentPool);

    const targetAgentTemplateIds = new Set(
      targetAgentPool.map((slot) => slot.templateId),
    );
    const targetDepartmentTemplateIds = new Set(
      targetDepartmentPool.map((slot) => slot.departmentTemplateId),
    );

    const reusableAgents = desiredAgentPool
      .map((slot) =>
        this.findExistingTierResource(
          selectedAgents,
          'tierAgentPoolId',
          'templateId',
          slot.id,
          slot.templateId,
        ),
      )
      .filter((agent): agent is SelectedAgent => Boolean(agent))
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        templateId: agent.templateId,
      }));

    const reusableDepartments = desiredDepartmentPool
      .map((slot) =>
        this.findExistingTierResource(
          selectedDepartments,
          'tierDepartmentPoolId',
          'templateId',
          slot.id,
          slot.departmentTemplateId,
        ),
      )
      .filter((department): department is SelectedDepartment =>
        Boolean(department),
      )
      .map((department) => ({
        id: department.id,
        name: department.name,
        templateId: department.templateId,
      }));

    const agentsToProvision = desiredAgentPool
      .filter(
        (slot) =>
          !this.findExistingTierResource(
            selectedAgents,
            'tierAgentPoolId',
            'templateId',
            slot.id,
            slot.templateId,
          ),
      )
      .map((slot) => ({
        templateId: slot.templateId,
        templateName: slot.template?.name ?? 'Unknown Template',
        slotType: slot.slotType,
      }));

    const departmentsToProvision = desiredDepartmentPool
      .filter(
        (slot) =>
          !this.findExistingTierResource(
            selectedDepartments,
            'tierDepartmentPoolId',
            'templateId',
            slot.id,
            slot.departmentTemplateId,
          ),
      )
      .map((slot) => ({
        templateId: slot.departmentTemplateId,
        templateName: slot.departmentTemplate?.name ?? 'Unknown Template',
        slotType: slot.slotType,
      }));

    const blockingReasons: string[] = [];
    if (selectedAgents.length > targetTier.maxAgents) {
      blockingReasons.push(
        `Tenant has ${selectedAgents.length} selected agents but target tier allows only ${targetTier.maxAgents}`,
      );
    }

    const projectedSelectedAgents =
      selectedAgents.length + agentsToProvision.length;
    if (
      agentsToProvision.length > 0 &&
      projectedSelectedAgents > targetTier.maxAgents
    ) {
      blockingReasons.push(
        `Target tier would need ${agentsToProvision.length} additional tier-linked agent${agentsToProvision.length === 1 ? '' : 's'}, exceeding the limit of ${targetTier.maxAgents}`,
      );
    }

    const tierLinkedAgentsOutsideTargetPolicy = selectedAgents
      .filter(
        (agent) =>
          (agent.tierAgentPoolId || agent.deployedFromTierId) &&
          agent.templateId &&
          !targetAgentTemplateIds.has(agent.templateId),
      )
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        templateId: agent.templateId,
      }));

    const tierLinkedDepartmentsOutsideTargetPolicy = selectedDepartments
      .filter(
        (department) =>
          (department.tierDepartmentPoolId || department.deployedFromTierId) &&
          department.templateId &&
          !targetDepartmentTemplateIds.has(department.templateId),
      )
      .map((department) => ({
        id: department.id,
        name: department.name,
        templateId: department.templateId,
      }));

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      currentTier: {
        id: tenant.tier.id,
        name: tenant.tier.name,
        slug: tenant.tier.slug,
        maxAgents: tenant.tier.maxAgents,
      },
      targetTier: {
        id: targetTier.id,
        name: targetTier.name,
        slug: targetTier.slug,
        maxAgents: targetTier.maxAgents,
      },
      usage: {
        selectedAgents: selectedAgents.length,
        selectedDepartments: selectedDepartments.length,
      },
      compatibility: {
        canChange: blockingReasons.length === 0,
        blockingReasons,
      },
      impact: {
        agentsToProvision,
        departmentsToProvision,
        reusableAgents,
        reusableDepartments,
        tierLinkedAgentsOutsideTargetPolicy,
        tierLinkedDepartmentsOutsideTargetPolicy,
      },
    };
  }

  async provisionDepartmentsForTier(
    tenantId: string,
    tierId: string,
    actorId?: string,
  ): Promise<DepartmentProvisioningResult> {
    const tenant = await this.tenantPolicy.assertTierMatchesTenant(
      tenantId,
      tierId,
    );

    const tierPools = await this.prisma.tierDepartmentPool.findMany({
      where: { tierId },
      include: { departmentTemplate: true },
      orderBy: { slot: 'asc' },
    });

    const desiredPools = this.getDesiredDepartmentPoolEntries(tierPools);
    if (desiredPools.length === 0) {
      this.logger.warn(
        `Tier ${tierId} has no default department pool configured`,
      );
      return {
        tenantId,
        tierId,
        departmentsProvisioned: 0,
        departmentIds: [],
        departmentsReused: 0,
      };
    }

    const existingDepartments = await this.prisma.department.findMany({
      where: {
        tenantId,
        isSelected: true,
        OR: [
          { tierDepartmentPoolId: { in: desiredPools.map((pool) => pool.id) } },
          {
            templateId: {
              in: desiredPools.map((pool) => pool.departmentTemplateId),
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        templateId: true,
        tierDepartmentPoolId: true,
      },
    });

    const createdIds: string[] = [];
    let reusedCount = 0;

    for (const pool of desiredPools) {
      const existing = this.findExistingTierResource(
        existingDepartments,
        'tierDepartmentPoolId',
        'templateId',
        pool.id,
        pool.departmentTemplateId,
      );

      if (existing) {
        await this.prisma.department.update({
          where: { id: existing.id },
          data: {
            tierDepartmentPoolId: pool.id,
            templateId: pool.departmentTemplateId,
            deployedFromTierId: tierId,
            isFixed: pool.slotType === 'FIXED' || pool.isRequired,
            isSelected: true,
          },
        });
        reusedCount += 1;
        continue;
      }

      const department = await this.prisma.department.create({
        data: {
          name: pool.departmentTemplate.name,
          description: pool.departmentTemplate.description ?? null,
          status: 'ACTIVE',
          tenantId,
          templateId: pool.departmentTemplateId,
          tierDepartmentPoolId: pool.id,
          deployedFromTierId: tierId,
          isFixed: pool.slotType === 'FIXED' || pool.isRequired,
          isSelected: true,
          createdById: actorId ?? undefined,
        },
      });
      createdIds.push(department.id);
    }

    this.logger.log(
      `Provisioned ${createdIds.length} departments and reused ${reusedCount} departments for tenant ${tenantId} (${tenant.slug})`,
    );

    return {
      tenantId,
      tierId,
      departmentsProvisioned: createdIds.length,
      departmentIds: createdIds,
      departmentsReused: reusedCount,
    };
  }

  async bootstrapTenantTier(
    tenantId: string,
    tierId: string,
    actorId?: string,
  ): Promise<TierBootstrapResult> {
    const preview = await this.previewTierBootstrap(tenantId, tierId);
    if (!preview.compatibility.canChange) {
      throw new BadRequestException(preview.compatibility.blockingReasons[0]);
    }

    const departments = await this.provisionDepartmentsForTier(
      tenantId,
      tierId,
      actorId,
    );
    const agents = await this.provisionAgentsForTier(tenantId, tierId, actorId);

    return {
      tenantId,
      tierId,
      departmentsProvisioned: departments.departmentsProvisioned,
      departmentIds: departments.departmentIds,
      departmentsReused: departments.departmentsReused,
      agentsProvisioned: agents.agentsProvisioned,
      agentIds: agents.agentIds,
      agentsReused: agents.agentsReused,
    };
  }

  async provisionAgentsForTier(
    tenantId: string,
    tierId: string,
    actorId?: string,
  ): Promise<ProvisioningResult & { agentsReused: number }> {
    const tenant = await this.tenantPolicy.assertTierMatchesTenant(
      tenantId,
      tierId,
    );

    const tierPools = await this.prisma.tierAgentPool.findMany({
      where: { tierId },
      include: { template: true },
      orderBy: { slot: 'asc' },
    });

    if (tierPools.length === 0) {
      this.logger.warn(`Tier ${tierId} has no agent pool configured`);
      return {
        tenantId,
        tierId,
        agentsProvisioned: 0,
        agentIds: [],
        agentsReused: 0,
      };
    }

    const desiredPools = this.getDesiredAgentPoolEntries(tierPools);

    if (desiredPools.length === 0) {
      this.logger.warn(`No default agents to provision for tenant ${tenantId}`);
      return {
        tenantId,
        tierId,
        agentsProvisioned: 0,
        agentIds: [],
        agentsReused: 0,
      };
    }

    const existingAgents = await this.prisma.agent.findMany({
      where: {
        tenantId,
        isSelected: true,
        OR: [
          { tierAgentPoolId: { in: desiredPools.map((pool) => pool.id) } },
          { templateId: { in: desiredPools.map((pool) => pool.template.id) } },
        ],
      },
      select: {
        id: true,
        name: true,
        templateId: true,
        tierAgentPoolId: true,
      },
    });

    const currentSelectedCount = await this.prisma.agent.count({
      where: { tenantId, isSelected: true },
    });

    const missingPools = desiredPools.filter(
      (pool) =>
        !this.findExistingTierResource(
          existingAgents,
          'tierAgentPoolId',
          'templateId',
          pool.id,
          pool.template.id,
        ),
    );

    if (currentSelectedCount + missingPools.length > tenant.tier.maxAgents) {
      throw new BadRequestException(
        `Provisioning ${missingPools.length} additional tier-linked agent${missingPools.length === 1 ? '' : 's'} would exceed the tier limit of ${tenant.tier.maxAgents}.`,
      );
    }

    let reusedCount = 0;
    for (const pool of desiredPools) {
      const existing = this.findExistingTierResource(
        existingAgents,
        'tierAgentPoolId',
        'templateId',
        pool.id,
        pool.template.id,
      );
      if (!existing) {
        continue;
      }

      await this.prisma.agent.update({
        where: { id: existing.id },
        data: {
          tierAgentPoolId: pool.id,
          templateId: pool.template.id,
          templateVersion: pool.template.version,
          deployedFromTierId: tierId,
          isFixed: pool.slotType === 'FIXED' || pool.isRequired,
          isSelected: true,
        },
      });
      reusedCount += 1;
    }

    const createdAgents = await this.prisma.$transaction(
      missingPools.map((pool) =>
        this.prisma.agent.create({
          data: {
            name: pool.template.name,
            description: pool.template.description,
            type: pool.template.type,
            model: pool.defaultModel ?? pool.template.model,
            systemPrompt: pool.template.systemPrompt,
            instructions: pool.template.instructions,
            permissions: (pool.template.permissions ??
              []) as Prisma.InputJsonValue,
            config: (pool.template.config ?? {}) as Prisma.InputJsonValue,
            budgetPerDay: pool.defaultBudgetPerDay,
            isActive: true,
            isSelected: true,
            isFixed: pool.slotType === 'FIXED' || pool.isRequired,
            tenantId,
            tierAgentPoolId: pool.id,
            templateId: pool.template.id,
            templateVersion: pool.template.version,
            deployedFromTierId: tierId,
            createdById: actorId,
          },
        }),
      ),
    );

    const agentIds = createdAgents.map((agent) => agent.id);
    this.logger.log(
      `Provisioned ${createdAgents.length} agents and reused ${reusedCount} agents for tenant ${tenantId} (${tenant.slug})`,
    );

    return {
      tenantId,
      tierId,
      agentsProvisioned: createdAgents.length,
      agentIds,
      agentsReused: reusedCount,
    };
  }

  private getDesiredAgentPoolEntries<
    T extends {
      slotType: string;
      isRequired: boolean;
      isDefaultSelected: boolean;
      slot: number;
    },
  >(pools: T[]): T[] {
    return pools
      .filter(
        (pool) =>
          pool.slotType === 'FIXED' ||
          pool.isRequired ||
          pool.isDefaultSelected,
      )
      .sort((left, right) => {
        const leftPriority =
          left.slotType === 'FIXED' || left.isRequired ? 0 : 1;
        const rightPriority =
          right.slotType === 'FIXED' || right.isRequired ? 0 : 1;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        return left.slot - right.slot;
      });
  }

  private getDesiredDepartmentPoolEntries<
    T extends {
      slotType: string;
      isRequired: boolean;
      isDefaultSelected: boolean;
      slot: number;
    },
  >(pools: T[]): T[] {
    return pools
      .filter(
        (pool) =>
          pool.slotType === 'FIXED' ||
          pool.isRequired ||
          pool.isDefaultSelected,
      )
      .sort((left, right) => {
        const leftPriority =
          left.slotType === 'FIXED' || left.isRequired ? 0 : 1;
        const rightPriority =
          right.slotType === 'FIXED' || right.isRequired ? 0 : 1;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        return left.slot - right.slot;
      });
  }

  private findExistingTierResource<
    T extends Record<string, string | null>,
    SlotKey extends keyof T,
    TemplateKey extends keyof T,
  >(
    resources: T[],
    slotKey: SlotKey,
    templateKey: TemplateKey,
    slotId: string,
    templateId: string,
  ): T | undefined {
    return resources.find(
      (resource) =>
        resource[slotKey] === slotId || resource[templateKey] === templateId,
    );
  }
}
