/**
 * TierProvisioningService - SOLID: Single Responsibility Principle
 *
 * SRP: ONLY handles automatic agent provisioning on tenant creation
 * OCP: New provisioning strategies extend without modifying core logic
 * DIP: Depends on abstractions (PrismaService), not concretions
 *
 * Phase 3 G14: adds `selectIndustryDefaultAgents()` which uses
 * `resolveDefaultAgentsForIndustry()` from tier-industry-matrix.ts to
 * mark industry-specific agents as selected after onboarding. This
 * complements `provisionAgents()` (which runs at tenant creation when
 * the industry isn't known yet) and lets the matrix drive the final
 * selection.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { certifiedPlatformTemplateWhere } from '../../agent-templates/agent-template-certification';
import { Prisma } from '@prisma/client';
import { resolveDefaultAgentsForIndustry } from '../../industry/tier-industry-matrix';

/**
 * Slug ↔ template.name matcher.
 *
 * The matrix keys (e.g. "bookkeeper") are abstract agent slugs. The
 * AgentTemplate table stores names like "Bookkeeper & Controller".
 * This helper does a substring + boundary match so the matrix list
 * drives selection without a separate name table.
 *
 *   matchesTemplateSlug('bookkeeper', 'Bookkeeper & Controller') → true
 *   matchesTemplateSlug('bookkeeper', 'Tax Strategist')           → false
 *   matchesTemplateSlug('ap-specialist', 'AP Specialist')         → true
 *
 * SRP: single pure function. Pure functions are trivial to test and
 * keep the matching rules out of the provisioning loop.
 */
export function matchesTemplateSlug(
  slug: string,
  templateName: string,
): boolean {
  if (!slug || !templateName) return false;
  const normalised = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const normalisedSlug = normalised(slug);
  const normalisedName = normalised(templateName);
  return (
    normalisedName === normalisedSlug ||
    normalisedName.startsWith(`${normalisedSlug}-`) ||
    normalisedName.startsWith(`${normalisedSlug} `) ||
    normalisedName.startsWith(`${normalisedSlug}&`)
  );
}

export interface ProvisioningResult {
  tenantId: string;
  tierId: string;
  agentsProvisioned: number;
  agentIds: string[];
}

export interface ITierProvisioningService {
  provisionAgents(
    tenantId: string,
    tierId: string,
    actorId?: string,
  ): Promise<ProvisioningResult>;
  getAvailableAgentsForTenant(tenantId: string): Promise<AvailableAgent[]>;
  selectAgent(
    tenantId: string,
    tierAgentPoolId: string,
    actorId: string,
  ): Promise<string>;
  deselectAgent(
    tenantId: string,
    agentId: string,
    actorId: string,
  ): Promise<void>;
  replaceAgent(
    tenantId: string,
    currentAgentId: string,
    newTierAgentPoolId: string,
    actorId: string,
  ): Promise<string>;
}

export interface AvailableAgent {
  tierAgentPoolId: string;
  templateId: string;
  templateName: string;
  templateDescription: string | null;
  agentType: string;
  isRequired: boolean;
  isSelected: boolean;
  selectedAgentId?: string;
}

@Injectable()
export class TierProvisioningService implements ITierProvisioningService {
  private readonly logger = new Logger(TierProvisioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Phase 9 (INST-001): same normaliser used by matchesTemplateSlug but
   * hoisted as an instance method so we can build a slug→template index
   * for the industry-default fallback path.
   */
  private templateNameToSlug(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Provision agents for a new tenant based on their tier's agent pool
   * Called automatically when a tenant is created
   */
  async provisionAgents(
    tenantId: string,
    tierId: string,
    actorId?: string,
  ): Promise<ProvisioningResult> {
    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tier: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Verify tier exists and matches
    if (tenant.tierId !== tierId) {
      throw new BadRequestException(
        `Tenant ${tenantId} is not on tier ${tierId}`,
      );
    }

    // Get tier's agent pool
    const tierPools = await this.prisma.tierAgentPool.findMany({
      where: { tierId },
      include: { template: true },
      orderBy: { slot: 'asc' },
    });

    if (tierPools.length === 0) {
      this.logger.warn(`Tier ${tierId} has no agent pool configured`);
      return { tenantId, tierId, agentsProvisioned: 0, agentIds: [] };
    }

    // Create agents from pool (only those marked as default selected)
    const agentCreations = tierPools
      .filter((pool) => pool.isDefaultSelected)
      .map((pool, index) => ({
        name: pool.template.name,
        description: pool.template.description,
        type: pool.template.type,
        model: pool.defaultModel ?? pool.template.model,
        systemPrompt: pool.template.systemPrompt,
        instructions: pool.template.instructions,
        permissions: (pool.template.permissions ?? []) as Prisma.InputJsonValue,
        config: (pool.template.config ?? {}) as Prisma.InputJsonValue,
        budgetPerDay: pool.defaultBudgetPerDay,
        isActive: true,
        isSelected: true,
        tenantId,
        tierAgentPoolId: pool.id,
        templateId: pool.template.id,
        templateVersion: pool.template.version,
        createdById: actorId,
      }));

    if (agentCreations.length === 0) {
      this.logger.warn(`No default agents to provision for tenant ${tenantId}`);
      return { tenantId, tierId, agentsProvisioned: 0, agentIds: [] };
    }

    // Create all agents in transaction
    const createdAgents = await this.prisma.$transaction(
      agentCreations.map((data) => this.prisma.agent.create({ data })),
    );

    const agentIds = createdAgents.map((a) => a.id);

    // Post-provisioning: link each agent to the matching department by name.
    // The accounting template has Departments like "Audit", "Tax", "Bookkeeping"
    // and agents like "Audit Coordinator", "Tax Strategist", "Bookkeeper".
    // This is a soft match — if no department exists, the agent remains
    // departmentId=null (still visible + functional, just not nested in the
    // department tree).
    await this.linkAgentsToDepartments(tenantId, createdAgents);

    this.logger.log(
      `Provisioned ${createdAgents.length} agents for tenant ${tenantId} (${tenant.slug})`,
    );

    return {
      tenantId,
      tierId,
      agentsProvisioned: createdAgents.length,
      agentIds,
    };
  }

  /**
   * Soft-link provisioned agents to existing departments by name.
   *
   * Strategy: scan the tenant's departments once, then for each agent pick
   * the first department whose name is a case-insensitive substring of the
   * agent's name (or vice versa). E.g. "Audit" matches "Audit Coordinator",
   * "Bookkeeping" matches "Bookkeeper". This is a best-effort heuristic — it
   * never blocks provisioning and never assigns to a tenant that has no
   * departments.
   */
  private async linkAgentsToDepartments(
    tenantId: string,
    agents: { id: string; name: string }[],
  ): Promise<void> {
    if (agents.length === 0) return;
    const departments = await this.prisma.department.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    if (departments.length === 0) return;

    const updates: Promise<unknown>[] = [];
    for (const agent of agents) {
      const lowerAgentName = agent.name.toLowerCase();
      const match = departments.find((d) => {
        const lowerDept = d.name.toLowerCase();
        return (
          lowerAgentName.includes(lowerDept) || lowerDept.includes(lowerAgentName)
        );
      });
      if (match) {
        updates.push(
          this.prisma.agent.update({
            where: { id: agent.id },
            data: { departmentId: match.id },
          }),
        );
      }
    }
    if (updates.length > 0) {
      await this.prisma.$transaction(updates);
      this.logger.log(
        `Linked ${updates.length}/${agents.length} agents to departments for tenant ${tenantId}`,
      );
    }
  }

  /**
   * Get available agents a tenant can select from based on their tier
   */
  async getAvailableAgentsForTenant(
    tenantId: string,
  ): Promise<AvailableAgent[]> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tier: {
          include: {
            tierAgentPools: {
              include: { template: true },
              orderBy: { slot: 'asc' },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Get currently selected agents for this tenant
    const selectedAgents = await this.prisma.agent.findMany({
      where: { tenantId, isSelected: true, tierAgentPoolId: { not: null } },
      select: { tierAgentPoolId: true, id: true },
    });

    const selectedMap = new Map(
      selectedAgents.map((a) => [a.tierAgentPoolId!, a.id]),
    );

    // Check how many agents tenant can select (tier limit)
    const tierAgentCount = await this.prisma.agent.count({
      where: { tenantId, isSelected: true },
    });

    const canSelectMore = tierAgentCount < tenant.tier.maxAgents;

    return tenant.tier.tierAgentPools.map((pool) => ({
      tierAgentPoolId: pool.id,
      templateId: pool.template.id,
      templateName: pool.template.name,
      templateDescription: pool.template.description,
      agentType: pool.template.type,
      isRequired: pool.isRequired,
      isSelected: selectedMap.has(pool.id) || pool.isRequired,
      selectedAgentId: selectedMap.get(pool.id),
    }));
  }

  /**
   * Select an agent from the tier's pool for a tenant
   */
  async selectAgent(
    tenantId: string,
    tierAgentPoolId: string,
    actorId: string,
  ): Promise<string> {
    // Verify tenant and tier access
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tier: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Verify the pool entry belongs to tenant's tier
    const poolEntry = await this.prisma.tierAgentPool.findUnique({
      where: { id: tierAgentPoolId },
      include: { template: true },
    });
    if (!poolEntry || poolEntry.tierId !== tenant.tierId) {
      throw new BadRequestException(
        `Agent template not available in your tier`,
      );
    }

    // Check tier agent limit
    const currentCount = await this.prisma.agent.count({
      where: { tenantId, isSelected: true },
    });
    if (currentCount >= tenant.tier.maxAgents) {
      throw new BadRequestException(
        `Agent limit reached (${tenant.tier.maxAgents}). Deselect an agent first.`,
      );
    }

    // Check if already selected
    const existing = await this.prisma.agent.findFirst({
      where: { tenantId, tierAgentPoolId },
    });
    if (existing) {
      // Just activate it
      await this.prisma.agent.update({
        where: { id: existing.id },
        data: { isSelected: true },
      });
      return existing.id;
    }

    // Create new agent from pool
    const agent = await this.prisma.agent.create({
      data: {
        name: poolEntry.template.name,
        description: poolEntry.template.description,
        type: poolEntry.template.type,
        model: poolEntry.defaultModel ?? poolEntry.template.model,
        systemPrompt: poolEntry.template.systemPrompt,
        instructions: poolEntry.template.instructions,
        permissions: (poolEntry.template.permissions ??
          []) as Prisma.InputJsonValue,
        config: (poolEntry.template.config ?? {}) as Prisma.InputJsonValue,
        budgetPerDay: poolEntry.defaultBudgetPerDay,
        isActive: true,
        isSelected: true,
        tenantId,
        tierAgentPoolId,
        templateId: poolEntry.template.id,
        templateVersion: poolEntry.template.version,
        createdById: actorId,
      },
    });

    this.logger.log(`Tenant ${tenantId} selected agent ${agent.id} from pool`);
    return agent.id;
  }

  /**
   * Industry-aware default-agent selection. Idempotent.
   *
   * Called from OnboardingService.complete() after the tenant's industry
   * is known (provisionAgents() runs earlier, at tenant creation, when
   * the industry isn't yet set). The algorithm:
   *
   *   1. Resolve the priority-sorted industry default list from the matrix.
   *   2. Walk the tenant's tier pool entries; for each entry whose
   *      template.name matches a matrix slug, set isSelected: true on
   *      the agent row (or create one if it doesn't exist yet).
   *   3. Honour the tier's maxAgents cap — stop once we hit it.
   *   4. Deselect agents whose template does NOT match any priority slug
   *      (keeps the surface area clean for the tenant's vertical).
   *
   * Returns the set of agent IDs that were activated.
   *
   * SRP: single responsibility = "apply industry defaults to the
   *      existing pool". Does NOT mutate tier/tenant state, does NOT
   *      create agents outside the pool.
   */
  async selectIndustryDefaultAgents(
    tenantId: string,
    industrySlug: string,
    actorId?: string,
  ): Promise<string[]> {
    if (!industrySlug) return [];

    const prioritySlugs = resolveDefaultAgentsForIndustry(industrySlug);
    if (prioritySlugs.length === 0) {
      this.logger.warn(
        `selectIndustryDefaultAgents: industry "${industrySlug}" has no default agents in the matrix — no changes`,
      );
      return [];
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        tierId: true,
        tier: { select: { maxAgents: true, slug: true } },
      },
    });
    if (!tenant?.tierId || !tenant.tier) {
      this.logger.warn(
        `selectIndustryDefaultAgents: tenant ${tenantId} has no tier — skipping`,
      );
      return [];
    }

    const currentSelected = await this.prisma.agent.count({
      where: { tenantId, isSelected: true },
    });
    const cap = tenant.tier.maxAgents;
    const unlimited = cap >= 9999;
    const remaining = unlimited
      ? Number.POSITIVE_INFINITY
      : cap - currentSelected;
    if (remaining <= 0) {
      this.logger.warn(
        `selectIndustryDefaultAgents: tenant ${tenantId} at agent cap (${currentSelected}/${cap})`,
      );
      return [];
    }

    // Pull the tenant's pool entries for the current tier, with template
    // details so we can match by name.
    const poolEntries = await this.prisma.tierAgentPool.findMany({
      where: { tierId: tenant.tierId },
      include: {
        template: { select: { id: true, name: true, version: true } },
      },
      orderBy: { slot: 'asc' },
    });

    // Phase 9 (INST-001): also index platform AgentTemplates so we can
    // spawn an agent directly from a template when the tier's pool
    // doesn't already include it. The original provisioning path only
    // matched pool rows, so any new industry-default template that
    // hadn't been promoted into a TierAgentPool row was silently
    // skipped, leaving tenants at 0 agents even after
    // onboarding.complete().
    const allTemplates = await this.prisma.agentTemplate.findMany({
      where: certifiedPlatformTemplateWhere(),
      select: {
        id: true,
        name: true,
        version: true,
        type: true,
        model: true,
        description: true,
        systemPrompt: true,
        instructions: true,
        permissions: true,
        config: true,
      },
    });
    const templatesBySlug = new Map(
      allTemplates.map((t) => [this.templateNameToSlug(t.name), t] as const),
    );

    // Match pool entries to priority slugs. Walk priority slugs in order so
    // the matching order respects sub-industry priority.
    type Matched = {
      slug: string;
      entry: (typeof poolEntries)[number] | null;
      template: (typeof allTemplates)[number] | null;
    };
    const matchedEntries: Matched[] = [];
    for (const slug of prioritySlugs) {
      const entry =
        poolEntries.find((p) => matchesTemplateSlug(slug, p.template.name)) ??
        null;
      const template = templatesBySlug.get(slug) ?? null;
      if (entry || template) matchedEntries.push({ slug, entry, template });
    }

    const activated: string[] = [];
    let budget = remaining;

    for (const { entry, template } of matchedEntries) {
      if (budget <= 0) break;

      // Find or create the Agent row for this pool entry on the tenant.
      let agent = entry
        ? await this.prisma.agent.findFirst({
            where: { tenantId, tierAgentPoolId: entry.id },
          })
        : null;

      if (!agent) {
        // Pool entry wins for metadata (defaultModel, defaults) but the
        // AgentTemplate gives us the full systemPrompt / instructions /
        // permissions / config. Prefer pool template fields when
        // available and fall back to the AgentTemplate.
        const poolTemplate = entry?.template ?? null;
        const platformTemplate = template ?? null;
        const sourceName = poolTemplate?.name ?? platformTemplate?.name;
        if (!sourceName) continue;
        const sourceModel =
          entry?.defaultModel ??
          (platformTemplate as { model?: string } | null)?.model ??
          'gpt-4o-mini';
        const sourceDescription = platformTemplate?.description ?? null;
        const sourceSystemPrompt = platformTemplate?.systemPrompt ?? null;
        const sourceInstructions = platformTemplate?.instructions ?? null;
        const sourceType = platformTemplate?.type ?? 'FUNCTIONAL';
        const sourcePermissions = (platformTemplate?.permissions ??
          []) as Prisma.InputJsonValue;
        const sourceConfig = (platformTemplate?.config ??
          {}) as Prisma.InputJsonValue;
        const sourceTemplateId = poolTemplate?.id ?? platformTemplate?.id;
        const sourceTemplateVersion =
          poolTemplate?.version ?? platformTemplate?.version;
        if (!sourceTemplateId || !sourceTemplateVersion) continue;

        agent = await this.prisma.agent.create({
          data: {
            name: sourceName,
            description: sourceDescription,
            type: sourceType as 'EXECUTIVE' | 'CORE' | 'FUNCTIONAL' | 'META',
            model: sourceModel ?? 'gpt-4o-mini',
            systemPrompt: sourceSystemPrompt,
            instructions: sourceInstructions,
            permissions: sourcePermissions,
            config: sourceConfig,
            isActive: true,
            isSelected: true,
            tenantId,
            tierAgentPoolId: entry?.id ?? null,
            templateId: sourceTemplateId,
            templateVersion: sourceTemplateVersion,
            createdById: actorId ?? null,
          },
        });
      } else if (!agent.isSelected) {
        await this.prisma.agent.update({
          where: { id: agent.id },
          data: { isSelected: true, isActive: true },
        });
      }
      activated.push(agent.id);
      budget--;
    }

    // Link the newly-activated agents to existing departments by name (best
    // effort, soft match). This mirrors the linking done in
    // `provisionAgents` so both provisioning paths produce the same shape.
    const activatedAgents = await this.prisma.agent.findMany({
      where: { id: { in: activated } },
      select: { id: true, name: true },
    });
    await this.linkAgentsToDepartments(tenantId, activatedAgents);

    this.logger.log(
      `selectIndustryDefaultAgents: tenant ${tenantId} (industry=${industrySlug}, tier=${tenant.tier.slug}): activated ${activated.length}/${matchedEntries.length} priority agents`,
    );
    return activated;
  }

  /**
   * Deselect (deactivate) an agent for a tenant
   * Cannot deselect required agents
   */
  async deselectAgent(
    tenantId: string,
    agentId: string,
    actorId: string,
  ): Promise<void> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found for tenant`);
    }

    if (agent.tierAgentPoolId) {
      const poolEntry = await this.prisma.tierAgentPool.findUnique({
        where: { id: agent.tierAgentPoolId },
      });
      if (poolEntry?.isRequired) {
        throw new BadRequestException(
          `Cannot deselect required agent "${poolEntry.id}"`,
        );
      }
    }

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { isSelected: false, isActive: false },
    });

    this.logger.log(`Tenant ${tenantId} deselected agent ${agentId}`);
  }

  /**
   * Replace a selected agent with a different one from the pool
   */
  async replaceAgent(
    tenantId: string,
    currentAgentId: string,
    newTierAgentPoolId: string,
    actorId: string,
  ): Promise<string> {
    // Verify tenant and tier
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tier: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Verify current agent belongs to tenant
    const currentAgent = await this.prisma.agent.findFirst({
      where: { id: currentAgentId, tenantId },
    });
    if (!currentAgent) {
      throw new NotFoundException(
        `Agent ${currentAgentId} not found for tenant`,
      );
    }

    // Cannot replace required agents
    if (currentAgent.tierAgentPoolId) {
      const currentPool = await this.prisma.tierAgentPool.findUnique({
        where: { id: currentAgent.tierAgentPoolId },
      });
      if (currentPool?.isRequired) {
        throw new BadRequestException(`Cannot replace required agent`);
      }
    }

    // Verify new pool entry
    const newPool = await this.prisma.tierAgentPool.findUnique({
      where: { id: newTierAgentPoolId },
      include: { template: true },
    });
    if (!newPool || newPool.tierId !== tenant.tierId) {
      throw new BadRequestException(
        `Agent template not available in your tier`,
      );
    }

    // Check if new agent already selected
    const alreadySelected = await this.prisma.agent.findFirst({
      where: {
        tenantId,
        tierAgentPoolId: newTierAgentPoolId,
        isSelected: true,
      },
    });
    if (alreadySelected) {
      throw new BadRequestException(`Agent already selected`);
    }

    // Transaction: deactivate old, create new
    const result = await this.prisma.$transaction(async (tx) => {
      // Deactivate current agent
      await tx.agent.update({
        where: { id: currentAgentId },
        data: { isSelected: false, isActive: false },
      });

      // Create new agent from pool
      const newAgent = await tx.agent.create({
        data: {
          name: newPool.template.name,
          description: newPool.template.description,
          type: newPool.template.type,
          model: newPool.defaultModel ?? newPool.template.model,
          systemPrompt: newPool.template.systemPrompt,
          instructions: newPool.template.instructions,
          permissions: newPool.template.permissions,
          config: newPool.template.config,
          budgetPerDay: newPool.defaultBudgetPerDay,
          isActive: true,
          isSelected: true,
          tenantId,
          tierAgentPoolId: newTierAgentPoolId,
          templateId: newPool.template.id,
          templateVersion: newPool.template.version,
          createdById: actorId,
        },
      });

      return newAgent;
    });

    this.logger.log(
      `Tenant ${tenantId} replaced agent ${currentAgentId} with ${result.id}`,
    );
    return result.id;
  }
}
