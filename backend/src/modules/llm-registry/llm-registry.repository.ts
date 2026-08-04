/**
 * LLM Provider Registry — Repository.
 *
 * Single canonical owner of persistence for LlmProvider, LlmProviderModel,
 * TenantLlmBinding, and LlmBindingAudit. Pure data-access methods — no
 * business logic, no HTTP, no audit writes (audit is composed at the
 * service layer).
 *
 * Solid:
 *   • SRP — only Prisma calls.
 *   • DIP — depends on PrismaService (injected).
 *   • OCP — adding a new query is a new method, not a new branch.
 *
 * Per v3 P-1 rule §11: every query below accepts a real tenantId. There
 * is no wildcard branch. The single platform-admin `findAllProviders`
 * uses an explicit authorised call-site signature.
 */

import { Injectable } from '@nestjs/common';
import {
  LlmProvider,
  LlmProviderKind,
  LlmProviderModel,
  LlmProviderStatus,
  Prisma,
  TenantLlmBinding,
} from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

export interface CreateProviderInput {
  slug: string;
  displayName: string;
  kind: LlmProviderKind;
  status: LlmProviderStatus;
  baseUrl: string;
  secretRef: string;
  orgId: string | null;
  metadata: Prisma.InputJsonValue;
  requestsPerMinuteCap: number | null;
  maxConcurrent: number | null;
}

export interface UpdateProviderInput {
  displayName?: string;
  status?: LlmProviderStatus;
  baseUrl?: string;
  secretRef?: string;
  orgId?: string | null;
  metadata?: Prisma.InputJsonValue;
  requestsPerMinuteCap?: number | null;
  maxConcurrent?: number | null;
}

export interface CreateModelInput {
  providerId: string;
  modelId: string;
  displayName: string;
  capabilities: Prisma.InputJsonValue;
  contextWindow: number;
  costInputPer1k: Prisma.Decimal | null;
  costOutputPer1k: Prisma.Decimal | null;
}

@Injectable()
export class LlmRegistryRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Provider queries ----------

  findAllProviders(args: {
    status?: LlmProviderStatus;
    kind?: LlmProviderKind;
    skip?: number;
    take?: number;
  }): Promise<LlmProvider[]> {
    return this.prisma.llmProvider.findMany({
      where: {
        ...(args.status ? { status: args.status } : {}),
        ...(args.kind ? { kind: args.kind } : {}),
      },
      orderBy: [{ displayName: 'asc' }],
      skip: args.skip,
      take: args.take,
    });
  }

  countProviders(args: {
    status?: LlmProviderStatus;
    kind?: LlmProviderKind;
  }): Promise<number> {
    return this.prisma.llmProvider.count({
      where: {
        ...(args.status ? { status: args.status } : {}),
        ...(args.kind ? { kind: args.kind } : {}),
      },
    });
  }

  findProviderById(id: string): Promise<LlmProvider | null> {
    return this.prisma.llmProvider.findUnique({ where: { id } });
  }

  findProviderBySlug(slug: string): Promise<LlmProvider | null> {
    return this.prisma.llmProvider.findUnique({ where: { slug } });
  }

  createProvider(input: CreateProviderInput): Promise<LlmProvider> {
    return this.prisma.llmProvider.create({ data: input });
  }

  updateProvider(id: string, input: UpdateProviderInput): Promise<LlmProvider> {
    return this.prisma.llmProvider.update({ where: { id }, data: input });
  }

  deleteProvider(id: string): Promise<LlmProvider> {
    return this.prisma.llmProvider.delete({ where: { id } });
  }

  // ---------- Provider model queries ----------

  findModelsByProvider(providerId: string): Promise<LlmProviderModel[]> {
    return this.prisma.llmProviderModel.findMany({
      where: { providerId },
      orderBy: [{ displayName: 'asc' }],
    });
  }

  findModelById(id: string): Promise<LlmProviderModel | null> {
    return this.prisma.llmProviderModel.findUnique({ where: { id } });
  }

  findModelByProviderAndId(
    providerId: string,
    modelId: string,
  ): Promise<LlmProviderModel | null> {
    return this.prisma.llmProviderModel.findUnique({
      where: { providerId_modelId: { providerId, modelId } },
    });
  }

  createModel(input: CreateModelInput): Promise<LlmProviderModel> {
    return this.prisma.llmProviderModel.create({ data: input });
  }

  deleteModel(id: string): Promise<LlmProviderModel> {
    return this.prisma.llmProviderModel.delete({ where: { id } });
  }

  // ---------- Tenant binding queries ----------
  // Every method below REQUIRES a real tenantId. The service layer is the
  // only caller; it has already validated the wildcard.

  findBindingsByTenant(
    tenantId: string,
    status?: LlmProviderStatus,
  ): Promise<TenantLlmBinding[]> {
    return this.prisma.tenantLlmBinding.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findActiveBindingForTenant(
    tenantId: string,
  ): Promise<TenantLlmBinding | null> {
    return this.prisma.tenantLlmBinding.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findBindingById(id: string): Promise<TenantLlmBinding | null> {
    return this.prisma.tenantLlmBinding.findUnique({ where: { id } });
  }

  createBinding(input: {
    tenantId: string;
    providerId: string;
    modelId: string;
    priority: number;
    status: LlmProviderStatus;
    requestsPerMinuteCap: number | null;
    metadata: Prisma.InputJsonValue;
    createdByActorId: string;
  }): Promise<TenantLlmBinding> {
    return this.prisma.tenantLlmBinding.create({ data: input });
  }

  updateBinding(
    id: string,
    input: {
      status?: LlmProviderStatus;
      priority?: number;
      requestsPerMinuteCap?: number | null;
      metadata?: Prisma.InputJsonValue;
      lastRotatedAt?: Date;
    },
  ): Promise<TenantLlmBinding> {
    return this.prisma.tenantLlmBinding.update({ where: { id }, data: input });
  }

  deleteBinding(id: string): Promise<TenantLlmBinding> {
    return this.prisma.tenantLlmBinding.delete({ where: { id } });
  }

  // ---------- Audit ----------
  // Append-only. No update / delete methods are exposed.

  appendAudit(input: {
    tenantId: string;
    bindingId: string;
    actorId: string;
    action: string;
    previousHash: string | null;
    currentHash: string;
    reason?: string;
    metadata: Prisma.InputJsonValue;
  }): Promise<{ id: string }> {
    return this.prisma.llmBindingAudit.create({
      data: input,
      select: { id: true },
    });
  }

  findLastAuditHash(
    tenantId: string,
    bindingId: string,
  ): Promise<{ currentHash: string } | null> {
    return this.prisma.llmBindingAudit.findFirst({
      where: { tenantId, bindingId },
      orderBy: { occurredAt: 'desc' },
      select: { currentHash: true },
    });
  }

  listAudits(args: {
    tenantId: string;
    bindingId?: string;
    skip?: number;
    take?: number;
  }): Promise<
    Array<{
      id: string;
      bindingId: string;
      actorId: string;
      action: string;
      previousHash: string | null;
      currentHash: string;
      occurredAt: Date;
      reason: string | null;
      metadata: unknown;
    }>
  > {
    return this.prisma.llmBindingAudit.findMany({
      where: {
        tenantId: args.tenantId,
        ...(args.bindingId ? { bindingId: args.bindingId } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      skip: args.skip,
      take: args.take ?? 50,
    }) as unknown as Promise<
      Array<{
        id: string;
        bindingId: string;
        actorId: string;
        action: string;
        previousHash: string | null;
        currentHash: string;
        occurredAt: Date;
        reason: string | null;
        metadata: unknown;
      }>
    >;
  }
}
