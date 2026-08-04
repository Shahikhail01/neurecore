/**
 * Domain Agents — Service.
 *
 * Composes the OOB registry + the persistence repository. Owns:
 *   • Seeding the platform-wide AgentDefinition rows from the registry.
 *   • Tenant bindings (enable/disable + risk-tier override).
 *   • Append-only execution records.
 *
 * Solid:
 *   • SRP — domain-agent business rules only. LLM binding resolution is
 *     composed from Phase 1.2; the Twin permission mirror is composed
 *     from Phase 1.3.
 *   • DIP — depends on the repository abstraction.
 *
 * Per v3 P-1 rule §11: every tenant-scoped method requires a real
 * tenantId. The wildcard sentinel is rejected with ForbiddenException.
 */

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DomainAgentKind, Prisma } from '@prisma/client';
import { DomainAgentRepository } from './domain-agents.repository';
import {
  OOB_AGENT_REGISTRY,
  OobAgentSpec,
} from './oob-agent.registry';

const PLATFORM_ROLES: ReadonlyArray<string> = ['SUPER_ADMIN', 'PLATFORM_ADMIN'];

@Injectable()
export class DomainAgentService {
  private readonly logger = new Logger(DomainAgentService.name);

  constructor(private readonly repo: DomainAgentRepository) {}

  // ─── Seed ───────────────────────────────────────────────────────

  async seedPlatformDefinitions(): Promise<{ created: number; total: number }> {
    let created = 0;
    for (const spec of OOB_AGENT_REGISTRY) {
      const existing = await this.repo.findDefinitionByKind(spec.kind);
      if (existing) continue;
      await this.repo.createDefinition(this.specToSeedInput(spec));
      created++;
    }
    return { created, total: OOB_AGENT_REGISTRY.length };
  }

  async seedPlatformDefinitionsForTenant(tenantId: string): Promise<{ enabled: number }> {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    // Ensure platform definitions exist (idempotent).
    await this.seedPlatformDefinitions();
    // Activate each agent for the tenant unless they opt out.
    const defs = await this.repo.findAllDefinitions({ enabled: true });
    let enabled = 0;
    for (const d of defs) {
      const existing = await this.repo.findTenantBinding(tenantId, d.id);
      if (existing) continue;
      await this.repo.upsertTenantBinding({
        tenantId,
        agentDefinitionId: d.id,
        enabled: true,
      });
      enabled++;
    }
    return { enabled };
  }

  // ─── Read helpers ───────────────────────────────────────────────

  async listPlatformDefinitions(args: { domain?: string } = {}) {
    return this.repo.findAllDefinitions(args);
  }

  async listForTenant(tenantId: string) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const defs = await this.repo.findAllDefinitions();
    const bindings = await this.repo.listTenantBindings(tenantId);
    const byDef = new Map(bindings.map((b) => [b.agentDefinitionId, b]));
    return defs.map((d) => {
      const b = byDef.get(d.id);
      return {
        ...d,
        tenantEnabled: b?.enabled ?? false,
        tenantRiskTierOverride: b?.riskTierOverride ?? null,
        tenantDepartmentId: b?.departmentId ?? null,
        effectiveRiskTier: b?.riskTierOverride ?? d.riskTier,
      };
    });
  }

  // ─── Tenant binding CRUD ────────────────────────────────────────

  async setTenantBinding(args: {
    tenantId: string;
    kind: DomainAgentKind;
    enabled: boolean;
    riskTierOverride?: number | null;
    departmentId?: string | null;
    actorRoles: string[];
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const def = await this.repo.findDefinitionByKind(args.kind);
    if (!def) {
      throw new NotFoundException(`agent definition ${args.kind} not found`);
    }
    // Only platform roles can override the risk tier; OWNER+ can toggle
    // the on/off switch.
    if (
      args.riskTierOverride !== undefined &&
      args.riskTierOverride !== null &&
      !args.actorRoles.some((r) => PLATFORM_ROLES.includes(r))
    ) {
      throw new ForbiddenException(
        'risk-tier override requires platform-admin role',
      );
    }
    return this.repo.upsertTenantBinding({
      tenantId: args.tenantId,
      agentDefinitionId: def.id,
      enabled: args.enabled,
      riskTierOverride: args.riskTierOverride ?? null,
      departmentId: args.departmentId ?? null,
    });
  }

  // ─── Executions (append-only) ────────────────────────────────────

  async startExecution(args: {
    tenantId: string;
    kind: DomainAgentKind;
    actorId: string;
    actorKind?: 'user' | 'twin' | 'system';
    triggerSource?: 'manual' | 'schedule' | 'approval' | 'event';
    inputs?: Record<string, unknown>;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const def = await this.repo.findDefinitionByKind(args.kind);
    if (!def) throw new NotFoundException(`agent definition ${args.kind} not found`);

    // Tenant-side enable check.
    const binding = await this.repo.findTenantBinding(args.tenantId, def.id);
    if (binding && !binding.enabled) {
      throw new ForbiddenException(`agent ${args.kind} is disabled for this tenant`);
    }

    const created = await this.repo.appendExecution({
      tenantId: args.tenantId,
      agentDefinitionId: def.id,
      actorId: args.actorId,
      actorKind: args.actorKind ?? 'user',
      triggerSource: args.triggerSource ?? 'manual',
      inputs: (args.inputs ?? {}) as unknown as Prisma.InputJsonValue,
    });
    return created;
  }

  async finishExecution(args: {
    id: string;
    status: 'SUCCESS' | 'FAILURE' | 'ABSTAINED' | 'PENDING_APPROVAL';
    outputs?: Record<string, unknown>;
    errorMessage?: string;
    tenantId: string;
  }) {
    const existing = await this.repo.findExecutionById(args.id);
    if (!existing) throw new NotFoundException(`execution ${args.id} not found`);
    if (existing.tenantId !== args.tenantId) {
      throw new ForbiddenException('execution belongs to a different tenant');
    }
    const startedAt = existing.startedAt.getTime();
    const durationMs = Date.now() - startedAt;
    const finished = await this.repo.finishExecution(args.id, {
      status: args.status,
      outputs: (args.outputs ?? {}) as unknown as Prisma.InputJsonValue,
      errorMessage: args.errorMessage,
    });
    // Stamp the real duration via a separate update — the repo's
    // durationMs placeholder is replaced.
    return this.repo['prisma'].agentExecution.update({
      where: { id: args.id },
      data: { durationMs },
    }).then(() => finished);
  }

  async listExecutions(args: {
    tenantId: string;
    kind?: DomainAgentKind;
    status?: string;
    skip?: number;
    take?: number;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    let agentDefinitionId: string | undefined;
    if (args.kind) {
      const def = await this.repo.findDefinitionByKind(args.kind);
      agentDefinitionId = def?.id;
    }
    return this.repo.listExecutions({
      tenantId: args.tenantId,
      agentDefinitionId,
      status: args.status,
      skip: args.skip,
      take: args.take,
    });
  }

  // ─── Internals ──────────────────────────────────────────────────

  private specToSeedInput(spec: OobAgentSpec) {
    return {
      kind: spec.kind,
      slug: spec.slug,
      displayName: spec.displayName,
      shortName: spec.shortName,
      description: spec.description,
      domain: spec.domain,
      planSection: spec.planSection,
      reads: spec.reads,
      writes: spec.writes,
      riskTier: spec.riskTier,
    };
  }
}
