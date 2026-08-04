/**
 * Domain Agents — Repository.
 *
 * Persistence for AgentDefinition + TenantAgentDefinition + AgentExecution.
 * Pure data access; no business logic.
 */

import { Injectable } from '@nestjs/common';
import { DomainAgentKind, Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

export interface SeedAgentDefinitionInput {
  kind: DomainAgentKind;
  slug: string;
  displayName: string;
  shortName: string;
  description: string;
  domain: string;
  planSection: string;
  reads: string[];
  writes: string[];
  riskTier: number;
}

@Injectable()
export class DomainAgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllDefinitions(args: { domain?: string; enabled?: boolean } = {}) {
    return this.prisma.agentDefinition.findMany({
      where: {
        ...(args.domain ? { domain: args.domain } : {}),
        ...(args.enabled !== undefined ? { enabled: args.enabled } : {}),
      },
      orderBy: [{ domain: 'asc' }, { displayName: 'asc' }],
    });
  }

  findDefinitionByKind(kind: DomainAgentKind) {
    return this.prisma.agentDefinition.findUnique({ where: { kind } });
  }

  findDefinitionBySlug(slug: string) {
    return this.prisma.agentDefinition.findUnique({ where: { slug } });
  }

  createDefinition(input: SeedAgentDefinitionInput) {
    return this.prisma.agentDefinition.create({
      data: {
        ...input,
        reads: input.reads,
        writes: input.writes,
        version: '1.0.0',
        enabled: true,
      },
    });
  }

  setDefinitionEnabled(id: string, enabled: boolean) {
    return this.prisma.agentDefinition.update({
      where: { id },
      data: { enabled },
    });
  }

  // ─── Tenant overrides ────────────────────────────────────────────

  findTenantBinding(tenantId: string, agentDefinitionId: string) {
    return this.prisma.tenantAgentDefinition.findUnique({
      where: {
        tenantId_agentDefinitionId: { tenantId, agentDefinitionId },
      },
    });
  }

  upsertTenantBinding(args: {
    tenantId: string;
    agentDefinitionId: string;
    enabled?: boolean;
    riskTierOverride?: number | null;
    departmentId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.tenantAgentDefinition.upsert({
      where: {
        tenantId_agentDefinitionId: {
          tenantId: args.tenantId,
          agentDefinitionId: args.agentDefinitionId,
        },
      },
      create: {
        tenantId: args.tenantId,
        agentDefinitionId: args.agentDefinitionId,
        enabled: args.enabled ?? true,
        riskTierOverride: args.riskTierOverride ?? null,
        departmentId: args.departmentId ?? null,
        metadata: args.metadata ?? {},
      },
      update: {
        ...(args.enabled !== undefined ? { enabled: args.enabled } : {}),
        ...(args.riskTierOverride !== undefined
          ? { riskTierOverride: args.riskTierOverride }
          : {}),
        ...(args.departmentId !== undefined
          ? { departmentId: args.departmentId }
          : {}),
        ...(args.metadata ? { metadata: args.metadata } : {}),
      },
    });
  }

  listTenantBindings(tenantId: string) {
    return this.prisma.tenantAgentDefinition.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Executions (append-only) ─────────────────────────────────────

  appendExecution(input: {
    tenantId: string;
    agentDefinitionId: string;
    actorId: string;
    actorKind?: string;
    triggerSource?: string;
    inputs?: Prisma.InputJsonValue;
    outputs?: Prisma.InputJsonValue;
    decisionTrace?: Prisma.InputJsonValue;
    status?: string;
  }) {
    return this.prisma.agentExecution.create({
      data: {
        tenantId: input.tenantId,
        agentDefinitionId: input.agentDefinitionId,
        actorId: input.actorId,
        actorKind: input.actorKind ?? 'user',
        triggerSource: input.triggerSource ?? 'manual',
        inputs: input.inputs ?? {},
        outputs: input.outputs ?? {},
        decisionTrace: input.decisionTrace ?? {},
        status: input.status ?? 'RUNNING',
      },
    });
  }

  finishExecution(
    id: string,
    args: {
      status: 'SUCCESS' | 'FAILURE' | 'ABSTAINED' | 'PENDING_APPROVAL';
      outputs?: Prisma.InputJsonValue;
      errorMessage?: string;
    },
  ) {
    return this.prisma.agentExecution.update({
      where: { id },
      data: {
        status: args.status,
        outputs: args.outputs ?? {},
        errorMessage: args.errorMessage,
        finishedAt: new Date(),
        durationMs:
          // We re-read startedAt for the diff below in the service.
          // The repo just stamps finishedAt + duration placeholder; the
          // service computes the real duration.
          0,
      },
    });
  }

  findExecutionById(id: string) {
    return this.prisma.agentExecution.findUnique({ where: { id } });
  }

  listExecutions(args: {
    tenantId: string;
    agentDefinitionId?: string;
    status?: string;
    skip?: number;
    take?: number;
  }) {
    return this.prisma.agentExecution.findMany({
      where: {
        tenantId: args.tenantId,
        ...(args.agentDefinitionId ? { agentDefinitionId: args.agentDefinitionId } : {}),
        ...(args.status ? { status: args.status } : {}),
      },
      orderBy: { startedAt: 'desc' },
      skip: args.skip,
      take: args.take ?? 50,
    });
  }
}
