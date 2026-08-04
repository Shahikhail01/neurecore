/**
 * LLM Provider Registry — Service.
 *
 * Pure business logic for the LLM Provider Registry. Composes the
 * repository + secret provider + audit log. No HTTP concerns (controllers
 * translate).
 *
 * Solid:
 *   • SRP — only LLM registry business rules live here.
 *   • OCP — new binding rotation policies extend this file.
 *   • DIP — depends on Repository and SecretProviderService abstractions.
 *
 * Per v3 P-1 rule §11: every tenant-scoped method requires a real tenantId.
 * The wildcard sentinel `'*'` is rejected with ForbiddenException at the
 * public surface. The detect-wildcard-tenant-bypass.ts CI gate verifies
 * no bypass is reintroduced.
 *
 * Per v2 §5.4.4 (Robust API Security) and §5.4.13 (Encrypted API
 * Integrations): API keys are NEVER stored in this table — only a
 * `secretRef` pointer into SecretProviderService. Resolution happens at
 * call time.
 */

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  LlmProviderKind,
  LlmProviderStatus,
  LlmProvider,
  LlmProviderModel,
  TenantLlmBinding,
  UserRole,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { LlmRegistryRepository } from './llm-registry.repository';

import { SecretProviderService } from '@/modules/security/providers/secret.provider';
import type { JwtPayload } from '@/modules/auth/interfaces/token.interface';
import {
  ResolvedLlmProvider,
  toPublicLlmProvider,
  PublicLlmProvider,
} from './dto/llm-registry.dto';

export interface CreateProviderParams {
  slug: string;
  displayName: string;
  kind: LlmProviderKind;
  status?: LlmProviderStatus;
  baseUrl: string;
  secretRef: string;
  orgId?: string;
  metadata?: Record<string, unknown>;
  requestsPerMinuteCap?: number;
  maxConcurrent?: number;
}

export interface CreateBindingParams {
  tenantId: string;
  providerId: string;
  modelId: string;
  priority?: number;
  requestsPerMinuteCap?: number;
  metadata?: Record<string, unknown>;
}

export interface ListProvidersParams {
  status?: LlmProviderStatus;
  kind?: LlmProviderKind;
  page?: number;
  limit?: number;
}

export interface ProviderListResult {
  items: PublicLlmProvider[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class LlmRegistryService {
  private readonly logger = new Logger(LlmRegistryService.name);

  // Authorised call-sites for cross-tenant operations. We never accept
  // the wildcard tenant id; platform-admin reads go through `findAll*`
  // and are gated by the controller via the RolesGuard.
  private static readonly PLATFORM_ROLES: ReadonlySet<UserRole> = new Set([
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
  ]);

  constructor(
    private readonly repo: LlmRegistryRepository,
    private readonly secrets: SecretProviderService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // Platform-admin provider CRUD (cc.neurecore.com)
  // ─────────────────────────────────────────────────────────────────────

  async createProvider(
    params: CreateProviderParams,
    actor: JwtPayload,
  ): Promise<PublicLlmProvider> {
    this.requirePlatformAdmin(actor, 'createProvider');
    const existing = await this.repo.findProviderBySlug(params.slug);
    if (existing) {
      throw new ConflictException(`provider slug "${params.slug}" already exists`);
    }
    // Validate secretRef resolves at create time so misconfiguration is
    // caught early — not at first inference call.
    this.resolveSecretOrThrow(params.secretRef);
    const created = await this.repo.createProvider({
      slug: params.slug,
      displayName: params.displayName,
      kind: params.kind,
      status: params.status ?? 'ACTIVE',
      baseUrl: params.baseUrl,
      secretRef: params.secretRef,
      orgId: params.orgId ?? null,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      requestsPerMinuteCap: params.requestsPerMinuteCap ?? null,
      maxConcurrent: params.maxConcurrent ?? null,
    });
    this.logger.log(
      `provider created slug=${created.slug} kind=${created.kind} actor=${actor.sub}`,
    );
    return toPublicLlmProvider(created);
  }

  async updateProvider(
    id: string,
    params: Partial<CreateProviderParams>,
    actor: JwtPayload,
  ): Promise<PublicLlmProvider> {
    this.requirePlatformAdmin(actor, 'updateProvider');
    const existing = await this.repo.findProviderById(id);
    if (!existing) throw new NotFoundException(`provider ${id} not found`);
    if (params.secretRef) {
      this.resolveSecretOrThrow(params.secretRef);
    }
    const updated = await this.repo.updateProvider(id, {
      displayName: params.displayName,
      status: params.status,
      baseUrl: params.baseUrl,
      secretRef: params.secretRef,
      orgId: params.orgId,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      requestsPerMinuteCap: params.requestsPerMinuteCap,
      maxConcurrent: params.maxConcurrent,
    });
    this.logger.log(`provider updated id=${id} actor=${actor.sub}`);
    return toPublicLlmProvider(updated);
  }

  async deleteProvider(id: string, actor: JwtPayload): Promise<void> {
    this.requirePlatformAdmin(actor, 'deleteProvider');
    const existing = await this.repo.findProviderById(id);
    if (!existing) throw new NotFoundException(`provider ${id} not found`);
    await this.repo.deleteProvider(id);
    this.logger.warn(`provider deleted id=${id} slug=${existing.slug} actor=${actor.sub}`);
  }

  async listProviders(
    params: ListProvidersParams,
    actor: JwtPayload,
  ): Promise<ProviderListResult> {
    this.requirePlatformAdmin(actor, 'listProviders');
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.repo.findAllProviders({
        status: params.status,
        kind: params.kind,
        skip,
        take: limit,
      }),
      this.repo.countProviders({ status: params.status, kind: params.kind }),
    ]);
    return {
      items: items.map(toPublicLlmProvider),
      total,
      page,
      limit,
    };
  }

  async findProviderById(
    id: string,
    actor: JwtPayload,
  ): Promise<PublicLlmProvider> {
    this.requirePlatformAdmin(actor, 'findProviderById');
    const found = await this.repo.findProviderById(id);
    if (!found) throw new NotFoundException(`provider ${id} not found`);
    return toPublicLlmProvider(found);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Provider model CRUD
  // ─────────────────────────────────────────────────────────────────────

  async addModelToProvider(
    providerId: string,
    params: {
      modelId: string;
      displayName: string;
      capabilities?: Record<string, unknown>;
      contextWindow: number;
      costInputPer1k?: number;
      costOutputPer1k?: number;
    },
    actor: JwtPayload,
  ): Promise<LlmProviderModel> {
    this.requirePlatformAdmin(actor, 'addModelToProvider');
    const provider = await this.repo.findProviderById(providerId);
    if (!provider) throw new NotFoundException(`provider ${providerId} not found`);
    const dup = await this.repo.findModelByProviderAndId(
      providerId,
      params.modelId,
    );
    if (dup) {
      throw new ConflictException(
        `model "${params.modelId}" already exists for provider ${providerId}`,
      );
    }
    return this.repo.createModel({
      providerId,
      modelId: params.modelId,
      displayName: params.displayName,
      capabilities: (params.capabilities ?? {}) as Prisma.InputJsonValue,
      contextWindow: params.contextWindow,
      costInputPer1k: params.costInputPer1k != null
        ? new Prisma.Decimal(params.costInputPer1k)
        : null,
      costOutputPer1k: params.costOutputPer1k != null
        ? new Prisma.Decimal(params.costOutputPer1k)
        : null,
    });
  }

  async listModelsForProvider(
    providerId: string,
    actor: JwtPayload,
  ): Promise<LlmProviderModel[]> {
    this.requirePlatformAdmin(actor, 'listModelsForProvider');
    const provider = await this.repo.findProviderById(providerId);
    if (!provider) throw new NotFoundException(`provider ${providerId} not found`);
    return this.repo.findModelsByProvider(providerId);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Tenant binding CRUD (hq.neurecore.com — tenant users)
  // ─────────────────────────────────────────────────────────────────────

  async createBinding(
    params: CreateBindingParams,
    actor: JwtPayload,
  ): Promise<TenantLlmBinding> {
    this.requireTenantScope(actor, params.tenantId, 'createBinding');
    const provider = await this.repo.findProviderById(params.providerId);
    if (!provider) throw new NotFoundException(`provider ${params.providerId} not found`);
    const model = await this.repo.findModelById(params.modelId);
    if (!model) throw new NotFoundException(`model ${params.modelId} not found`);
    if (model.providerId !== params.providerId) {
      throw new ConflictException(
        `model ${params.modelId} does not belong to provider ${params.providerId}`,
      );
    }
    const created = await this.repo.createBinding({
      tenantId: params.tenantId,
      providerId: params.providerId,
      modelId: params.modelId,
      priority: params.priority ?? 0,
      status: 'ACTIVE',
      requestsPerMinuteCap: params.requestsPerMinuteCap ?? null,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      createdByActorId: actor.sub,
    });
    await this.recordAudit(params.tenantId, created.id, actor.sub, 'CREATED', null, {
      providerId: params.providerId,
      modelId: params.modelId,
      priority: created.priority,
    });
    return created;
  }

  async listBindings(
    tenantId: string,
    actor: JwtPayload,
  ): Promise<TenantLlmBinding[]> {
    this.requireTenantScope(actor, tenantId, 'listBindings');
    return this.repo.findBindingsByTenant(tenantId);
  }

  async rotateBinding(
    bindingId: string,
    actor: JwtPayload,
  ): Promise<TenantLlmBinding> {
    const existing = await this.repo.findBindingById(bindingId);
    if (!existing) throw new NotFoundException(`binding ${bindingId} not found`);
    this.requireTenantScope(actor, existing.tenantId, 'rotateBinding');
    const previousHashRow = await this.repo.findLastAuditHash(
      existing.tenantId,
      bindingId,
    );
    const updated = await this.repo.updateBinding(bindingId, {
      lastRotatedAt: new Date(),
    });
    await this.recordAudit(
      existing.tenantId,
      bindingId,
      actor.sub,
      'ROTATED',
      previousHashRow?.currentHash ?? null,
      { lastRotatedAt: updated.lastRotatedAt },
    );
    return updated;
  }

  async disableBinding(
    bindingId: string,
    actor: JwtPayload,
  ): Promise<TenantLlmBinding> {
    return this.setBindingStatus(bindingId, 'DISABLED', actor);
  }

  async reEnableBinding(
    bindingId: string,
    actor: JwtPayload,
  ): Promise<TenantLlmBinding> {
    return this.setBindingStatus(bindingId, 'ACTIVE', actor);
  }

  async deleteBinding(
    bindingId: string,
    actor: JwtPayload,
  ): Promise<void> {
    const existing = await this.repo.findBindingById(bindingId);
    if (!existing) throw new NotFoundException(`binding ${bindingId} not found`);
    this.requireTenantScope(actor, existing.tenantId, 'deleteBinding');
    const previousHashRow = await this.repo.findLastAuditHash(
      existing.tenantId,
      bindingId,
    );
    await this.repo.deleteBinding(bindingId);
    await this.recordAudit(
      existing.tenantId,
      bindingId,
      actor.sub,
      'DELETED',
      previousHashRow?.currentHash ?? null,
      { providerId: existing.providerId, modelId: existing.modelId },
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Resolution — used by chat / agent / hermes entry points.
  // Returns the full provider+model snapshot the caller needs, including
  // the resolved API key. Callers MUST NOT log the returned secret.
  // ─────────────────────────────────────────────────────────────────────

  async resolveActiveBindingForTenant(
    tenantId: string,
  ): Promise<ResolvedLlmProvider | null> {
    this.assertRealTenantId(tenantId);
    const binding = await this.repo.findActiveBindingForTenant(tenantId);
    if (!binding) return null;
    const provider = await this.repo.findProviderById(binding.providerId);
    if (!provider || provider.status !== 'ACTIVE') return null;
    const model = await this.repo.findModelById(binding.modelId);
    if (!model) return null;
    const apiKey = this.resolveSecretOrThrow(provider.secretRef);
    return {
      id: provider.id,
      slug: provider.slug,
      displayName: provider.displayName,
      kind: provider.kind,
      status: provider.status,
      baseUrl: provider.baseUrl,
      apiKey,
      orgId: provider.orgId,
      model: {
        id: model.id,
        modelId: model.modelId,
        displayName: model.displayName,
        contextWindow: model.contextWindow,
        capabilities:
          (model.capabilities as Record<string, unknown> | null) ?? {},
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────

  private async setBindingStatus(
    bindingId: string,
    status: LlmProviderStatus,
    actor: JwtPayload,
  ): Promise<TenantLlmBinding> {
    const existing = await this.repo.findBindingById(bindingId);
    if (!existing) throw new NotFoundException(`binding ${bindingId} not found`);
    this.requireTenantScope(actor, existing.tenantId, 'setBindingStatus');
    const previousHashRow = await this.repo.findLastAuditHash(
      existing.tenantId,
      bindingId,
    );
    const updated = await this.repo.updateBinding(bindingId, { status });
    await this.recordAudit(
      existing.tenantId,
      bindingId,
      actor.sub,
      status === 'DISABLED' ? 'DISABLED' : 'RE_ENABLED',
      previousHashRow?.currentHash ?? null,
      { status },
    );
    return updated;
  }

  private resolveSecretOrThrow(ref: string): string {
    try {
      const result = this.secrets.resolve(ref);
      if (!result.value) {
        throw new NotFoundException(
          `secretRef "${ref}" did not resolve to a value`,
        );
      }
      return result.value;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException(
        `secretRef "${ref}" could not be resolved: ${(err as Error).message}`,
      );
    }
  }

  private assertRealTenantId(tenantId: string): void {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException(
        'tenantId "*" is forbidden; use a platform-admin port for cross-tenant queries',
      );
    }
  }

  private requireTenantScope(
    actor: JwtPayload,
    tenantId: string,
    op: string,
  ): void {
    this.assertRealTenantId(tenantId);
    if (!actor.tenantId || actor.tenantId !== tenantId) {
      if (!LlmRegistryService.PLATFORM_ROLES.has(actor.role)) {
        throw new ForbiddenException(
          `actor ${actor.sub} (role=${actor.role}) cannot ${op} for tenant ${tenantId}`,
        );
      }
    }
  }

  private requirePlatformAdmin(actor: JwtPayload, op: string): void {
    if (!LlmRegistryService.PLATFORM_ROLES.has(actor.role)) {
      throw new ForbiddenException(
        `actor ${actor.sub} (role=${actor.role}) cannot ${op}; platform admin required`,
      );
    }
  }

  private async recordAudit(
    tenantId: string,
    bindingId: string,
    actorId: string,
    action: string,
    previousHash: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const occurredAt = new Date();
    const currentHash = createHash('sha256')
      .update(JSON.stringify({ tenantId, bindingId, actorId, action, previousHash, metadata, occurredAt }))
      .digest('hex');
    await this.repo.appendAudit({
      tenantId,
      bindingId,
      actorId,
      action,
      previousHash,
      currentHash,
      metadata: metadata as Prisma.InputJsonValue,
    });
  }
}
