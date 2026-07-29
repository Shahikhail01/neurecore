/**
 * AI Providers Controller
 *
 * Compatibility layer mapping the frontend `/ai/providers` + `/ai/routing`
 * API surface onto the AI Gateway DB catalog (`model_providers`,
 * `ai_models`). The frontend-admin Settings > AI Providers page calls
 * these endpoints; this controller translates them into the Prisma
 * catalog so no new backend logic is required.
 *
 * All endpoints are SuperAdmin-only (matches the existing
 * ModelsAdminController guard).
 *
 * Phase 2.3 + 2.4 + 2.7 fixes (2026-07-20):
 *   - `ModelBody.capabilities` accepted and validated with `isCapability()`.
 *   - Models created via this surface are routable (was: empty array).
 *   - `updateRouting` validates the chosen model possesses the capability
 *     before marking it default.
 *   - `testProvider` actually pings the selected provider's models, not
 *     the global gateway.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AiModelRepository } from '../selection/ai-model.repository';
import { AiGatewayService } from '../ai-gateway.service';
import { CAPABILITIES, isCapability } from '../domain/capabilities';
import { CryptoService } from '../../connectors/services/crypto.service';
import { guessCapabilities } from '../selection/capability-heuristic';

/* ------------------------------------------------------------------ */
/*  DTO types                                                         */
/* ------------------------------------------------------------------ */

interface ProviderBody {
  provider: string;   // slug
  name: string;
  apiKey?: string;
  apiEndpoint?: string;
  isEnabled?: boolean;
  isDefault?: boolean;
}

interface ModelBody {
  name: string;
  modelId: string;
  /**
   * Phase 2.3: capabilities advertised by this model. Validated with
   * `isCapability()` from the AI Gateway domain. If absent, defaults
   * to `['conversation']` (the most common capability) so the model
   * is at least routable. Empty arrays are rejected.
   */
  capabilities?: string[];
  contextWindow?: number;
  maxTokens?: number;
  isEnabled?: boolean;
  isDefault?: boolean;
}

interface RoutingBody {
  planning?: string;
  execution?: string;
  evaluation?: string;
  conversation?: string;
  coding?: string;
  reasoning?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers — map DB row → frontend shape                              */
/* ------------------------------------------------------------------ */

function mapProvider(
  row: Prisma.ModelProviderGetPayload<{
    include: { models: { select: { id: true, modelId: true } } };
  }>,
  modelsFull?: Prisma.AiModelGetPayload<{ include: { provider: { select: { slug: true } } } }>[],
  decryptedKey?: string,
) {
  const ms = (modelsFull ?? []).map(mapModel);
  const hasKey = !!row.encryptedKey;
  let keyPreview: string | undefined;
  if (hasKey && decryptedKey) {
    keyPreview = maskKeyPreview(decryptedKey);
  }
  return {
    id: row.id,
    provider: row.slug as 'deepseek' | 'gemini' | 'openrouter' | 'minimax',
    name: row.name,
    apiKey: keyPreview ?? (hasKey ? '••••••••••••' : ''),
    hasKey,
    keyPreview,
    apiEndpoint: row.apiBaseUrl ?? undefined,
    isEnabled: row.isActive,
    isDefault: false,
    models: ms,
    settings: {
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 4096,
      timeout: 30000,
      retryAttempts: 3,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Phase 2.8: render a short, non-reversible preview of the decrypted
 * key (first 4 + '…' + last 4 chars) so admins can verify which key
 * is loaded without exposing the full secret. Falls back to a
 * full-mask when the key is too short to safely truncate.
 */
function maskKeyPreview(plaintext: string): string {
  if (plaintext.length <= 10) return '••••••••';
  return `${plaintext.slice(0, 4)}…${plaintext.slice(-4)}`;
}

function mapModel(row: Prisma.AiModelGetPayload<{
  include: { provider: { select: { slug: true } } };
}>) {
  return {
    id: row.id,
    name: row.displayName || row.modelId,
    provider: (row as any).provider?.slug ?? ('minimax' as string),
    modelId: row.modelId,
    contextWindow: row.contextWindow,
    maxTokens: 4096,
    supportsVision: false,
    supportsFunctionCalling: row.capabilities.includes('tools'),
    isDefault: row.isDefault,
    isEnabled: row.isAvailable,
  };
}

/* ---------------------------------------------------------------- */
/*  Controller                                                      */
/* ---------------------------------------------------------------- */

@Controller({ path: 'settings/ai', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class AiProvidersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: AiModelRepository,
    private readonly gateway: AiGatewayService,
    private readonly crypto: CryptoService,
  ) {}

  /* ---- Provider CRUD ---- */

  @Get('providers')
  async listProviders() {
    const providers = await this.prisma.modelProvider.findMany({
      orderBy: { name: 'asc' },
      include: { models: { select: { id: true, modelId: true } } },
    });
    const models = await this.prisma.aiModel.findMany({
      include: { provider: { select: { slug: true } } },
    });
    // Phase 2.8: decrypt each provider's stored key once so the UI
    // can show a masked preview. Failures silently fall back to a
    // fully-masked entry — never throw from the list endpoint.
    const previews = providers.map((p) =>
      p.encryptedKey ? this.tryDecrypt(p.encryptedKey) : '',
    );
    return providers.map((p, i) =>
      mapProvider(
        p,
        models.filter((m) => m.providerId === p.id),
        previews[i],
      ),
    );
  }

  private tryDecrypt(blob: string): string {
    try {
      return this.crypto.decrypt(blob);
    } catch {
      return '';
    }
  }

  @Get('providers/:id')
  async getProvider(@Param('id') id: string) {
    const p = await this.prisma.modelProvider.findUniqueOrThrow({ where: { id } });
    const modelsFull = await this.prisma.aiModel.findMany({
      where: { providerId: id },
      include: { provider: { select: { slug: true } } },
    });
    return mapProvider(
      { ...p, models: modelsFull.map((m) => ({ id: m.id, modelId: m.modelId })) },
      modelsFull,
      p.encryptedKey ? this.tryDecrypt(p.encryptedKey) : '',
    );
  }

@Post('providers')
  async createProvider(
    @Body() body: ProviderBody,
    @CurrentUser() user: { id: string },
  ) {
    const created = await this.prisma.modelProvider.create({
      data: {
        slug: body.provider,
        name: body.name,
        apiBaseUrl: body.apiEndpoint ?? '',
        apiKeyEnv: `${body.provider.toUpperCase()}_API_KEY`,
        encryptedKey: body.apiKey ? this.crypto.encrypt(body.apiKey) : null,
        isActive: body.isEnabled ?? true,
      },
      include: { models: { select: { id: true, modelId: true } } },
    });
    await this.writeAudit(user.id, 'create', 'ModelProvider', created.id, null, {
      ...created,
      encryptedKey: created.encryptedKey ? '[redacted]' : null,
    });
    this.repo.invalidate();
    return mapProvider(created as any, [], body.apiKey ?? '');
  }

@Patch('providers/:id')
  async updateProvider(
    @Param('id') id: string,
    @Body() body: Partial<ProviderBody>,
    @CurrentUser() user: { id: string },
  ) {
    const before = await this.prisma.modelProvider.findUnique({ where: { id } });
    const updateData: Prisma.ModelProviderUpdateInput = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.apiEndpoint !== undefined) updateData.apiBaseUrl = body.apiEndpoint;
    if (body.isEnabled !== undefined) updateData.isActive = body.isEnabled;
    // Phase 2.8: apiKey === '' → clear the stored key (rotation-out);
    // apiKey === non-empty → re-encrypt and store.
    // Omitting apiKey leaves the existing value untouched.
    if (body.apiKey === '') {
      updateData.encryptedKey = null;
    } else if (body.apiKey) {
      // Reject non-Latin1 keys before encrypting — Node's undici fetch
      // throws "Cannot convert argument to a ByteString" when an
      // outbound Authorization header contains codepoints > 255, and
      // the resulting undici error message is leaked to operators.
      if (/[^\x00-\xFF]/.test(body.apiKey)) {
        const badChar: string | undefined = [...body.apiKey].find((c): c is string => c.charCodeAt(0) > 255);
        const badIdx = body.apiKey.indexOf(badChar!);
        throw new BadRequestException(
          `API key contains a non-ASCII character (U+${badChar!.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')} at position ${badIdx}). Re-enter the key with only printable ASCII characters.`,
        );
      }
      updateData.encryptedKey = this.crypto.encrypt(body.apiKey);
    }

    const updated = await this.prisma.modelProvider.update({
      where: { id },
      data: updateData,
      include: { models: { select: { id: true, modelId: true } } },
    });
    await this.writeAudit(
      user.id,
      'update',
      'ModelProvider',
      id,
      { ...before, encryptedKey: before?.encryptedKey ? '[redacted]' : null },
      { ...updated, encryptedKey: updated.encryptedKey ? '[redacted]' : null },
    );
    this.repo.invalidate();
    // Force SecretProviderService negative-cache to expire in ≤10s so
    // a freshly-saved key is picked up without restart.
    this.gateway.invalidateSecret(`db:${updated.slug}`);
    const modelsFull = await this.prisma.aiModel.findMany({
      where: { providerId: id },
      include: { provider: { select: { slug: true } } },
    });
    const decrypted = updated.encryptedKey ? this.tryDecrypt(updated.encryptedKey) : '';
    return mapProvider(updated as any, modelsFull, decrypted);
  }

  @Delete('providers/:id')
  async deleteProvider(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const before = await this.prisma.modelProvider.findUnique({ where: { id } });
    await this.prisma.modelProvider.delete({ where: { id } });
    await this.writeAudit(user.id, 'delete', 'ModelProvider', id, before, null);
    this.repo.invalidate();
    return { ok: true };
  }

  @Patch('providers/:id/toggle')
  async toggleProvider(
    @Param('id') id: string,
    @Body('enabled') enabled: boolean,
    @CurrentUser() user: { id: string },
  ) {
    return this.updateProvider(id, { isEnabled: enabled } as any, user);
  }

  @Post('providers/:id/set-default')
  async setDefaultProvider(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    // Phase 2.8: take the highest-priority active model of this
    // provider that advertises 'conversation', then route EVERY
    // capability that model supports to it. Falls back to the first
    // active model if no conversation-capable model exists.
    const provider = await this.prisma.modelProvider.findUniqueOrThrow({
      where: { id },
    });
    const candidate = await this.prisma.aiModel.findFirst({
      where: {
        providerId: id,
        isAvailable: true,
        capabilities: { has: 'conversation' },
      },
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
    }) ?? (await this.prisma.aiModel.findFirst({
      where: { providerId: id, isAvailable: true },
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
    }));
    if (!candidate) {
      return { ok: false, error: `Provider "${provider.slug}" has no active models. Add or enable a model first.` };
    }
    const routing: Record<string, string> = {};
    for (const cap of candidate.capabilities) {
      if (isCapability(cap)) routing[cap] = candidate.modelId;
    }
    if (Object.keys(routing).length === 0) {
      return { ok: false, error: `Model "${candidate.modelId}" advertises no routable capabilities.` };
    }
    const result = await this.updateRouting(routing as any, user);
    return { ok: true, providerId: id, modelId: candidate.modelId, routing: result };
  }

  @Post('providers/:id/test')
  async testProvider(@Param('id') id: string) {
    const provider = await this.prisma.modelProvider.findUniqueOrThrow({ where: { id } });
    const start = Date.now();
    try {
      // Phase 2.7: pick THIS provider's model (capability-matching) and
      // ask the gateway to ping it. Previous version ignored `models`
      // and pinged the global chain, which could falsely report a
      // healthy provider when a different one handled the request.
      const candidate = await this.prisma.aiModel.findFirst({
        where: {
          providerId: id,
          isAvailable: true,
          capabilities: { has: 'conversation' },
        },
        orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
      });
      if (!candidate) {
        return {
          success: false,
          latency: 0,
          error: 'No available models for this provider with capability=conversation',
        };
      }
      const result = await this.gateway.ping(null, 'conversation', candidate.modelId);
      return { success: result.ok, latency: Date.now() - start };
    } catch (err) {
      return {
        success: false,
        latency: Date.now() - start,
        error: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  /* ---- Discovery (Phase 2.8) ---- */

  /**
   * Call the provider's OpenAI-compatible `GET /models` endpoint,
   * upsert every returned id into `ai_models` as DISABLED, and return
   * the resulting list (id + displayName + guessed capabilities) so
   * the admin UI can render checkboxes for which to enable.
   *
   * Resolution order for the API key (mirrors CapabilityResolver):
   *   1. DB: `db:<slug>` (encryptedKey)
   *   2. env: `<apiKeyEnv>`
   *
   * Capabilities are inferred from the model id with the heuristic
   * `guessCapabilities()`; admins can override per-model after.
   */
  @Post('providers/:id/discover-models')
  async discoverModels(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const provider = await this.prisma.modelProvider.findUniqueOrThrow({
      where: { id },
    });
    const apiKey = this.resolveProviderKey(provider);
    if (!apiKey) {
      return {
        ok: false,
        error: `No API key available for provider "${provider.slug}". Set it via the provider editor or ${provider.apiKeyEnv} env var.`,
        inserted: [],
        existing: [],
      };
    }
    // Reject non-Latin1 keys with a clear message — Node's fetch uses
    // undici which throws "Cannot convert argument to a ByteString" when
    // a header value contains codepoints > 255. Without this guard the
    // raw undici message bubbles up and confuses operators.
    if (/[^\x00-\xFF]/.test(apiKey)) {
      const badChar: string | undefined = [...apiKey].find((c): c is string => c.charCodeAt(0) > 255);
      const badIdx = apiKey.indexOf(badChar!);
      return {
        ok: false,
        error: `Stored API key for provider "${provider.slug}" contains a non-ASCII character (U+${badChar!.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')} at position ${badIdx}). Clear and re-enter the key.`,
        inserted: [],
        existing: [],
      };
    }
    const url = `${provider.apiBaseUrl.replace(/\/+$/, '')}/models`;
    let payload: { data?: Array<{ id: string }> } | null = null;
    let httpError: string | undefined;
    try {
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!resp.ok) {
        httpError = `HTTP ${resp.status} ${resp.statusText}`;
      } else {
        payload = (await resp.json()) as { data?: Array<{ id: string }> };
      }
    } catch (err) {
      httpError = err instanceof Error ? err.message : 'network error';
    }
    if (httpError || !payload?.data) {
      return {
        ok: false,
        error: httpError ?? 'Provider returned no model list',
        inserted: [],
        existing: [],
      };
    }
    const incoming = payload.data.map((m) => m.id).filter(Boolean);
    if (incoming.length === 0) {
      return { ok: true, inserted: [], existing: [], message: 'Provider returned 0 models' };
    }

    const existing = await this.prisma.aiModel.findMany({
      where: { providerId: id, modelId: { in: incoming } },
      select: { id: true, modelId: true },
    });
    const existingIds = new Set(existing.map((m) => m.modelId));
    const toInsert = incoming.filter((mid) => !existingIds.has(mid));

    const insertedRows: Array<{ id: string; modelId: string; displayName: string; capabilities: string[] }> = [];
    for (const modelId of toInsert) {
      const caps = guessCapabilities(modelId);
      const row = await this.prisma.aiModel.create({
        data: {
          providerId: id,
          modelId,
          displayName: modelId,
          capabilities: caps,
          contextWindow: 32000,
          costPer1kInput: new Prisma.Decimal(0),
          costPer1kOutput: new Prisma.Decimal(0),
          priority: 100,
          isDefault: false,
          isAvailable: false, // Phase 2.8: require explicit admin enable
        },
      });
      await this.writeAudit(user.id, 'create', 'AiModel', row.id, null, {
        modelId,
        capabilities: caps,
        via: 'discover',
      });
      insertedRows.push({
        id: row.id,
        modelId: row.modelId,
        displayName: row.displayName,
        capabilities: caps,
      });
    }
    this.repo.invalidate();
    return {
      ok: true,
      inserted: insertedRows,
      existing: existing.map((m) => m.modelId),
      message: `Inserted ${insertedRows.length} new model(s); ${existing.length} already existed`,
    };
  }

  /**
   * Phase 2.8: resolve an API key for a provider with the same
   * precedence as CapabilityResolver (db → env). Returns '' when
   * neither source has a value.
   */
  private resolveProviderKey(provider: {
    slug: string;
    apiKeyEnv: string;
    encryptedKey: string | null;
  }): string {
    if (provider.encryptedKey) {
      try {
        const v = this.crypto.decrypt(provider.encryptedKey);
        if (v) return v;
      } catch {
        /* fall through to env */
      }
    }
    const envVal = process.env[provider.apiKeyEnv] ?? '';
    return envVal;
  }

  /* ---- Model CRUD ---- */

  @Get('providers/:providerId/models')
  async listModels(@Param('providerId') providerId: string) {
    return this.prisma.aiModel.findMany({
      where: { providerId },
      include: { provider: { select: { slug: true } } },
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
    }).then((ms) => ms.map(mapModel));
  }

  @Post('providers/:providerId/models')
  async createModel(
    @Param('providerId') providerId: string,
    @Body() body: ModelBody,
    @CurrentUser() user: { id: string },
  ) {
    // Phase 2.3: validate + normalise capabilities.
    const capabilities = this.normaliseCapabilities(body.capabilities);
    const created = await this.prisma.aiModel.create({
      data: {
        providerId,
        modelId: body.modelId,
        displayName: body.name,
        capabilities,
        contextWindow: body.contextWindow ?? 8192,
        costPer1kInput: new Prisma.Decimal(0),
        costPer1kOutput: new Prisma.Decimal(0),
        isDefault: body.isDefault ?? false,
        isAvailable: body.isEnabled ?? true,
      },
    });
    await this.writeAudit(user.id, 'create', 'AiModel', created.id, null, created);
    this.repo.invalidate();
    return { ...created, provider: { slug: '' } };
  }

  @Patch('providers/:providerId/models/:modelId')
  async updateModel(
    @Param('providerId') _pId: string,
    @Param('modelId') modelId: string,
    @Body() body: Partial<ModelBody>,
    @CurrentUser() user: { id: string },
  ) {
    const before = await this.prisma.aiModel.findUnique({ where: { id: modelId } });
    const updateData: Prisma.AiModelUpdateInput = {};
    if (body.name !== undefined) updateData.displayName = body.name;
    if (body.isEnabled !== undefined) updateData.isAvailable = body.isEnabled;
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
    if (body.contextWindow !== undefined) updateData.contextWindow = body.contextWindow;
    // Phase 2.3: allow capability updates (deduped, validated).
    if (body.capabilities !== undefined) {
      updateData.capabilities = this.normaliseCapabilities(body.capabilities);
    }

    const updated = await this.prisma.aiModel.update({
      where: { id: modelId },
      data: updateData,
    });
    await this.writeAudit(user.id, 'update', 'AiModel', modelId, before, updated);
    this.repo.invalidate();
    return updated;
  }

  @Delete('providers/:providerId/models/:modelId')
  async deleteModel(
    @Param('providerId') _pId: string,
    @Param('modelId') modelId: string,
    @CurrentUser() user: { id: string },
  ) {
    const before = await this.prisma.aiModel.findUnique({ where: { id: modelId } });
    await this.prisma.aiModel.delete({ where: { id: modelId } });
    await this.writeAudit(user.id, 'delete', 'AiModel', modelId, before, null);
    this.repo.invalidate();
    return { ok: true };
  }

  @Patch('providers/:providerId/models/:modelId/toggle')
  async toggleModel(
    @Param('providerId') _pId: string,
    @Param('modelId') modelId: string,
    @Body('enabled') enabled: boolean,
    @CurrentUser() user: { id: string },
  ) {
    return this.updateModel(_pId, modelId, { isEnabled: enabled }, user);
  }

  /**
   * Phase 2.8: mark a single model as the default for every capability
   * it advertises, clearing isDefault on all sibling models that share
   * those capabilities. The url param is the database row id (cuid),
   * matching the discover-models response shape.
   */
  @Post('providers/:providerId/models/:modelId/set-default')
  async setDefaultModel(
    @Param('providerId') providerId: string,
    @Param('modelId') modelId: string,
    @CurrentUser() user: { id: string },
  ) {
    const target = await this.prisma.aiModel.findUniqueOrThrow({
      where: { id: modelId },
    });
    if (target.providerId !== providerId) {
      throw new BadRequestException(
        `Model ${modelId} does not belong to provider ${providerId}`,
      );
    }
    for (const cap of target.capabilities) {
      if (!isCapability(cap)) continue;
      await this.prisma.aiModel.updateMany({
        where: {
          capabilities: { has: cap },
          provider: { isActive: true },
          NOT: { id: target.id },
        },
        data: { isDefault: false },
      });
    }
    const updated = await this.prisma.aiModel.update({
      where: { id: target.id },
      data: { isDefault: true },
    });
    await this.writeAudit(user.id, 'update', 'AiModel', updated.id, target, {
      isDefault: true,
      via: 'set-default',
    });
    this.repo.invalidate();
    return updated;
  }

  /* ---- Routing ---- */

  @Get('routing')
  async getRouting() {
    const models = await this.prisma.aiModel.findMany({
      where: { isAvailable: true, isDefault: true },
      select: { modelId: true, capabilities: true },
    });
    const map = new Map<string, string>();
    models.forEach((m) => {
      m.capabilities.forEach((c) => {
        if (!map.has(c)) map.set(c, m.modelId);
      });
    });
    return {
      planning: map.get('planning') ?? 'MiniMax-M2.7-highspeed',
      execution: map.get('execution') ?? 'MiniMax-M2.7-highspeed',
      evaluation: map.get('evaluation') ?? 'MiniMax-M2.7-highspeed',
      conversation: map.get('conversation') ?? 'MiniMax-M2.7-highspeed',
      coding: map.get('coding') ?? 'deepseek-coder',
      reasoning: map.get('reasoning') ?? 'deepseek-reasoner',
    };
  }

  @Patch('routing')
  async updateRouting(
    @Body() body: RoutingBody,
    @CurrentUser() user: { id: string },
  ) {
    // Phase 2.4: validate every capability name AND every selected
    // model. Previous version marked ANY model isDefault=true even if
    // it didn't advertise the capability, leaving the chain to skip
    // it on lookup.
    const entries = Object.entries(body) as [string, string][];
    for (const [capability, modelId] of entries) {
      if (!isCapability(capability)) {
        throw new BadRequestException(
          `Unknown capability "${capability}". Valid: ${CAPABILITIES.join(', ')}`,
        );
      }
      const model = await this.prisma.aiModel.findFirst({
        where: {
          modelId,
          isAvailable: true,
          capabilities: { has: capability },
        },
      });
      if (!model) {
        throw new BadRequestException(
          `Model "${modelId}" is not available for capability "${capability}"`,
        );
      }
      await this.prisma.aiModel.updateMany({
        where: { capabilities: { has: capability } },
        data: { isDefault: false },
      });
      await this.prisma.aiModel.update({
        where: { id: model.id },
        data: { isDefault: true },
      });
      await this.writeAudit(user.id, 'update', 'AiModel', model.id, null, { isDefault: true, capability });
    }
    this.repo.invalidate();
    return this.getRouting();
  }

  @Post('routing/reset')
  async resetRouting(@CurrentUser() user: { id: string }) {
    const defaults: Record<string, string> = {
      planning: 'MiniMax-M2.7-highspeed',
      execution: 'MiniMax-M2.7-highspeed',
      evaluation: 'MiniMax-M2.7-highspeed',
      conversation: 'MiniMax-M2.7-highspeed',
      coding: 'deepseek-coder',
      reasoning: 'deepseek-reasoner',
    };
    return this.updateRouting(defaults, user);
  }

  /* ---- Audit helper ---- */

  /**
   * Phase 2.3: validate + dedupe + lower-case a caller-supplied
   * `capabilities` array. Throws `BadRequestException` on:
   *   - empty array (a model with no capabilities is invisible to
   *     every chain builder; reject it loudly)
   *   - any unknown capability string
   *
   * When `input` is undefined, defaults to `['conversation']` so
   * `POST /settings/ai/providers/:id/models` without a body still
   * produces a routable model.
   *
   * Pure: no I/O, no DB calls, no side effects. SRP.
   */
  private normaliseCapabilities(input: string[] | undefined): string[] {
    const src = input ?? ['conversation'];
    if (src.length === 0) {
      throw new BadRequestException(
        'capabilities must be a non-empty array (use ["conversation"] for a generic chat model)',
      );
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of src) {
      const c = raw.trim().toLowerCase();
      if (!isCapability(c)) {
        throw new BadRequestException(
          `Unknown capability "${raw}". Valid: ${CAPABILITIES.join(', ')}`,
        );
      }
      if (!seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
    return out;
  }

  private async writeAudit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    const sanitise = (v: unknown): Prisma.InputJsonValue => {
      if (v === null || v === undefined) return undefined as unknown as Prisma.InputJsonValue;
      return JSON.parse(JSON.stringify(v));
    };
    await this.prisma.modelCatalogAudit.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        before: sanitise(before),
        after: sanitise(after),
      },
    });
  }
}
