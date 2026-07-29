/**
 * AI Gateway Service — the public facade
 *
 * This is the ONLY entry point in the codebase that performs an LLM
 * call. Every other module injects `AiGatewayService` and calls one
 * of: `select`, `invoke`, `stream`, `invokeStructured`,
 * `invokeWithTools`, `ping`, `getLastResolved`.
 *
 * Architectural rules (from ai-gateway-imp-plan.md §2, §4.4):
 *   1. No raw `fetch()` outside `HttpLlmTransport`.
 *   2. No raw `process.env` reads for API keys outside
 *      `SecretProviderService`.
 *   3. No raw `prisma.aiModel.findMany()` outside `AiModelRepository`.
 *   4. Every successful invoke writes a `CostRecord`.
 *   5. Every invoke/stream emits a structured log line.
 *   6. Circuit-breaker state is owned by `CircuitBreaker`, not here.
 *   7. Retry policy is owned by `RetryPolicy`, not here.
 *
 * SOLID: this class is a *facade*. Each public method is small and
 * delegates to one helper class. The class is not a god object.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SecretProviderService } from '../security/providers/secret.provider';
import { CryptoService } from '../connectors/services/crypto.service';
import type { Capability } from './domain/capabilities';
import {
  AiGatewayAllProvidersFailedError,
  AiGatewayError,
  AiGatewayStructuredValidationError,
  AiGatewayUnconfiguredError,
  type AiGatewayAttemptedModel,
} from './domain/errors';
import type { LLMUsage } from './domain/types';
import type { InvokeOptionsInput } from './domain/invoke-options';
import type {
  ChatMessage,
  LLMToolCall,
  LLMResponse,
  LLMStreamChunk,
  LLMToolDefinition,
  ResolvedModel,
  SelectOptions,
} from './domain/types';
import { CostAttributorService } from './cost/cost-attributor.service';
import {
  CircuitBreaker,
  type CircuitBreakerOptions,
} from './failover/circuit-breaker';
import { FallbackChainBuilder } from './failover/fallback-chain';
import { computeDelay, isRetryable, sleep } from './failover/retry-policy';
import { StructuredLogger } from './observability/structured-logger';
import { LangSmithSink } from './observability/langsmith-sink';
import { AiModelRepository } from './selection/ai-model.repository';
import { CapabilityResolver } from './selection/capability-resolver';
import { HttpLlmTransport } from './transport/http-llm.transport';
import {
  readAiGatewayConfig,
  type AiGatewayConfig,
} from './config/ai-gateway.config';

export interface InvokeOptions extends InvokeOptionsInput {
  responseFormatJson?: boolean;
}

@Injectable()
export class AiGatewayService implements OnModuleInit {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly config: AiGatewayConfig;
  private readonly circuit: CircuitBreaker;
  private readonly lastResolved = new Map<string, ResolvedModel>();
  private booted = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly transport: HttpLlmTransport,
    private readonly resolver: CapabilityResolver,
    private readonly chainBuilder: FallbackChainBuilder,
    private readonly modelRepo: AiModelRepository,
    private readonly costAttributor: CostAttributorService,
    private readonly structuredLogger: StructuredLogger,
    private readonly langSmith: LangSmithSink,
    private readonly secrets: SecretProviderService,
    private readonly crypto: CryptoService,
  ) {
    this.config = readAiGatewayConfig(this.flattenEnv());
    const cbOptions: CircuitBreakerOptions = {
      threshold: this.config.AI_CIRCUIT_THRESHOLD,
      cooldownMs: this.config.AI_CIRCUIT_COOLDOWN_SECONDS * 1000,
      windowMs: this.config.AI_CIRCUIT_WINDOW_SECONDS * 1000,
    };
    this.circuit = new CircuitBreaker(cbOptions);
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.AI_GATEWAY_V2) {
      this.logger.log('AI_GATEWAY_V2=false — boot probe skipped (legacy mode)');
      return Promise.resolve();
    }
    if (this.booted) return Promise.resolve();
    this.booted = true;
    void this.bootProbe();
    return Promise.resolve();
  }

  /**
   * Boot probe: pings the default model for each capability in parallel.
   * Logs a single line per capability: [ok] or [ERR]. Never fatal.
   */
  private async bootProbe(): Promise<void> {
    const caps: Capability[] = [
      'conversation',
      'planning',
      'execution',
      'evaluation',
      'tools',
      'reasoning',
      'coding',
    ];
    const results = await Promise.allSettled(
      caps.map((cap) =>
        this.ping(null, cap)
          .then((r) => ({ ...r, cap, ok: true as const }))
          .catch((err) => ({
            cap,
            ok: false as const,
            error: err instanceof Error ? err.message : String(err),
          })),
      ),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const v = r.value;
        if (v.ok) {
          this.logger.log(
            `[boot] ${v.cap} [ok] ${v.provider}/${v.model} ${Math.round(v.latencyMs)}ms`,
          );
        } else {
          this.logger.warn(`[boot] ${v.cap} [ERR] ${v.error}`);
        }
      } else {
        this.logger.warn(
          `[boot] probe rejected: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
        );
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────

  async select(
    tenantId: string | null,
    capability: Capability,
    opts: SelectOptions = {},
  ): Promise<ResolvedModel> {
    const resolved = await this.resolver.resolve(tenantId, capability, opts);
    this.lastResolved.set(cacheKey(tenantId, capability), resolved);
    return resolved;
  }

  getLastResolved(
    tenantId: string | null,
    capability: Capability,
  ): ResolvedModel | null {
    return this.lastResolved.get(cacheKey(tenantId, capability)) ?? null;
  }

  async invoke(opts: InvokeOptions): Promise<LLMResponse> {
    const start = Date.now();
    return this.langSmith.wrap(
      'ai-gateway.invoke',
      {
        capability: opts.capability,
        sourceModule: opts.sourceModule,
        tenantId: opts.tenantId,
      },
      () => this.invokeInternal(opts, start),
    );
  }

  private async invokeInternal(
    opts: InvokeOptions,
    start: number,
  ): Promise<LLMResponse> {
    const messages = this.toMessages(opts);
    const chain = await this.chainBuilder.build(
      opts.tenantId,
      opts.capability,
      opts.modelId,
    );
    if (chain.length === 0) {
      // Phase 2.5: structured error type (was a plain `Error`).
      throw new AiGatewayUnconfiguredError(
        `capability=${opts.capability}; no chain links available`,
      );
    }
    const tried: AiGatewayAttemptedModel[] = [];
    for (const link of chain) {
      const apiKey = await this.resolveApiKey(link.providerSlug, link.apiKeyEnv);
      if (!apiKey) {
        tried.push({
          provider: link.providerSlug,
          model: link.modelId,
          errorCode: 'UNCONFIGURED',
        });
        continue;
      }
      const fullModel = await this.modelRepo.findById(link.aiModelId);
      if (!fullModel) {
        tried.push({
          provider: link.providerSlug,
          model: link.modelId,
          errorCode: 'NOT_FOUND',
        });
        continue;
      }
      const url = `${link.apiBaseUrl}/chat/completions`;
      const circuitKey = `${link.providerSlug}/${link.modelId}`;
      try {
        const result = await this.circuit.execute(circuitKey, () =>
          this.invokeWithRetries({
            url,
            apiKey,
            model: link.modelId,
            messages,
            temperature: opts.temperature ?? this.config.AI_DEFAULT_TEMPERATURE,
            maxTokens: opts.maxTokens ?? this.config.AI_DEFAULT_MAX_TOKENS,
            timeoutMs: this.config.AI_DEFAULT_TIMEOUT_MS,
            signal: opts.signal,
            ...(opts.responseFormatJson ? { responseFormatJson: true } : {}),
          }),
        );
        const resolved: ResolvedModel = {
          provider: {
            id: link.providerId,
            slug: link.providerSlug,
            name: link.providerName,
            apiBaseUrl: link.apiBaseUrl,
          },
          model: {
            id: fullModel.id,
            modelId: fullModel.modelId,
            displayName: fullModel.displayName,
            contextWindow: fullModel.contextWindow,
            costPer1kInput: fullModel.costPer1kInput,
            costPer1kOutput: fullModel.costPer1kOutput,
          },
          apiKey: '',
          overrides: {
            viaTenant: link.reason === 'tenant-override',
            viaFallback:
              link.reason === 'fallback' || link.reason === 'catalog',
          },
        };
        this.lastResolved.set(
          cacheKey(opts.tenantId, opts.capability),
          resolved,
        );
        await this.costAttributor
          .record({
            tenantId: opts.tenantId,
            sourceModule: opts.sourceModule,
            sourceEventId: `invoke:${uuidv4()}`,
            capability: opts.capability,
            providerId: link.providerId,
            aiModelId: link.aiModelId,
            provider: link.providerSlug,
            modelId: link.modelId,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            costPer1kInput: fullModel.costPer1kInput,
            costPer1kOutput: fullModel.costPer1kOutput,
            latencyMs: Date.now() - start,
          })
          .catch(() => undefined);
        const response: LLMResponse = {
          content: result.content,
          usage: result.usage,
          model: link.modelId,
          provider: link.providerSlug,
          latencyMs: Date.now() - start,
          resolved: {
            providerId: link.providerId,
            aiModelId: link.aiModelId,
            capability: opts.capability,
          },
        };
        this.structuredLogger.invoke({
          capability: opts.capability,
          provider: link.providerSlug,
          model: link.modelId,
          tenantId: opts.tenantId,
          sourceModule: opts.sourceModule,
          latencyMs: response.latencyMs,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costCents: 0,
          ok: true,
          viaTenantOverride: resolved.overrides.viaTenant,
          viaFallback: resolved.overrides.viaFallback,
        });
        return response;
      } catch (err) {
        const errorCode = err instanceof AiGatewayError ? err.code : 'UNKNOWN';
        tried.push({
          provider: link.providerSlug,
          model: link.modelId,
          errorCode,
        });
        this.structuredLogger.invoke({
          capability: opts.capability,
          provider: link.providerSlug,
          model: link.modelId,
          tenantId: opts.tenantId,
          sourceModule: opts.sourceModule,
          latencyMs: Date.now() - start,
          inputTokens: 0,
          outputTokens: 0,
          costCents: 0,
          ok: false,
          errorCode,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        if (!isFallbackCandidate(err)) {
          throw err;
        }
      }
    }
    throw new AiGatewayAllProvidersFailedError(
      `All ${chain.length} candidate models failed for capability ${opts.capability}`,
      tried,
    );
  }

  async *stream(opts: InvokeOptions): AsyncGenerator<LLMStreamChunk> {
    // Phase 2.8: stream-path failover. The previous implementation
    // only tried the FIRST chain link returned by `select()`. If that
    // model 503'd mid-stream we lost the response. Now we build the
    // full chain, then try each link in order. The first link that
    // produces ANY chunks wins; a transport error before the first
    // chunk tries the next link.
    const chain = await this.chainBuilder.build(
      opts.tenantId,
      opts.capability,
      opts.modelId,
    );
    if (chain.length === 0) {
      throw new AiGatewayUnconfiguredError(
        `capability=${opts.capability}; no chain links available for streaming`,
      );
    }

    const messages = this.toMessages(opts);
    const tried: AiGatewayAttemptedModel[] = [];
    let lastError: unknown = undefined;

    for (const link of chain) {
      const apiKey = await this.resolveApiKey(link.providerSlug, link.apiKeyEnv);
      if (!apiKey) {
        tried.push({
          provider: link.providerSlug,
          model: link.modelId,
          errorCode: 'UNCONFIGURED',
        });
        continue;
      }
      const fullModel = await this.modelRepo.findById(link.aiModelId);
      if (!fullModel) {
        tried.push({
          provider: link.providerSlug,
          model: link.modelId,
          errorCode: 'NOT_FOUND',
        });
        continue;
      }

      const url = `${link.apiBaseUrl}/chat/completions`;
      const start = Date.now();
      let finalUsage: LLMUsage | undefined;
      let producedAnyChunk = false;

      try {
        for await (const chunk of this.transport.stream({
          url,
          apiKey,
          model: link.modelId,
          capability: opts.capability,
          messages,
          temperature: opts.temperature ?? this.config.AI_DEFAULT_TEMPERATURE,
          maxTokens: opts.maxTokens ?? this.config.AI_DEFAULT_MAX_TOKENS,
          timeoutMs: this.config.AI_DEFAULT_TIMEOUT_MS,
          signal: opts.signal,
        })) {
          producedAnyChunk = true;
          if (chunk.done && chunk.usage) {
            finalUsage = chunk.usage;
          }
          yield chunk;
        }

        // Success — record cost attribution and return.
        const elapsed = Date.now() - start;
        if (finalUsage) {
          this.costAttributor
            .record({
              tenantId: opts.tenantId,
              sourceModule: opts.sourceModule,
              sourceEventId: `stream:${uuidv4()}`,
              capability: opts.capability,
              providerId: link.providerId,
              aiModelId: fullModel.id,
              provider: link.providerSlug,
              modelId: link.modelId,
              inputTokens: finalUsage.inputTokens,
              outputTokens: finalUsage.outputTokens,
              costPer1kInput: fullModel.costPer1kInput,
              costPer1kOutput: fullModel.costPer1kOutput,
              latencyMs: elapsed,
            })
            .catch(() => undefined);
        }
        this.structuredLogger.invoke({
          capability: opts.capability,
          provider: link.providerSlug,
          model: link.modelId,
          tenantId: opts.tenantId,
          sourceModule: opts.sourceModule,
          latencyMs: elapsed,
          inputTokens: finalUsage?.inputTokens ?? 0,
          outputTokens: finalUsage?.outputTokens ?? 0,
          costCents: 0,
          ok: true,
        });
        return;
      } catch (err) {
        // If we already yielded chunks, the client has seen partial
        // output. Aborting the stream now would produce a malformed
        // response. Surface the error AFTER the partial stream
        // finishes (which happens automatically when the for-await
        // loop exits on the throw). The next caller (chat) will
        // rethrow the same error.
        if (producedAnyChunk) {
          throw err;
        }
        const errorCode = this.classifyErrorCode(err);
        tried.push({
          provider: link.providerSlug,
          model: link.modelId,
          errorCode,
        });
        lastError = err;
        this.logger.warn(
          `[stream] ${link.providerSlug}/${link.modelId} (capability=${opts.capability}) ` +
            `failed before first chunk (${errorCode}); trying next candidate`,
        );
        // Non-fallback errors propagate immediately.
        if (!isFallbackCandidate(err)) {
          throw err;
        }
      }
    }
    // Every candidate failed before producing chunks.
    throw new AiGatewayAllProvidersFailedError(
      `All ${chain.length} candidate models failed for streaming capability ${opts.capability}`,
      tried,
      lastError,
    );
  }

  async invokeStructured<T>(
    opts: Omit<InvokeOptions, 'messages' | 'prompt'> & {
      prompt: string;
      schema: z.ZodType<T>;
    },
  ): Promise<{ data: T; response: LLMResponse }> {
    const jsonPrompt = `${opts.prompt}\n\nRespond with valid JSON only. No markdown.`;
    const first = await this.invoke({
      ...opts,
      prompt: jsonPrompt,
      responseFormatJson: true,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(first.content);
    } catch {
      const fix = await this.invoke({
        ...opts,
        prompt: `${jsonPrompt}\n\nThe previous reply was not valid JSON. Return ONLY the JSON object, with no surrounding text, that matches the requested schema.`,
      });
      try {
        parsed = JSON.parse(fix.content);
      } catch (err) {
        throw new AiGatewayStructuredValidationError(
          'Model failed to produce valid JSON after retry',
          [{ path: '$', message: 'invalid JSON' }],
          err,
        );
      }
    }
    const result = opts.schema.safeParse(parsed);
    if (!result.success) {
      throw new AiGatewayStructuredValidationError(
        'Model output did not match schema',
        result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      );
    }
    return { data: result.data, response: first };
  }

  async invokeWithTools(
    opts: Omit<InvokeOptions, 'messages' | 'prompt'> & {
      messages: ChatMessage[];
      tools: LLMToolDefinition[];
    },
  ): Promise<LLMResponse & { toolCalls: LLMToolCall[] }> {
    const start = Date.now();
    const resolved = await this.select(opts.tenantId, opts.capability, {
      modelId: opts.modelId,
    });
    const url = `${resolved.provider.apiBaseUrl}/chat/completions`;
    const tools = opts.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    const result = await this.circuit.execute(
      `${resolved.provider.slug}/${resolved.model.modelId}`,
      () =>
        this.invokeWithRetries({
          url,
          apiKey: resolved.apiKey,
          model: resolved.model.modelId,
          messages: opts.messages,
          temperature: opts.temperature ?? this.config.AI_DEFAULT_TEMPERATURE,
          maxTokens: opts.maxTokens ?? this.config.AI_DEFAULT_MAX_TOKENS,
          timeoutMs: this.config.AI_DEFAULT_TIMEOUT_MS,
          signal: opts.signal,
          tools,
          sourceModule: opts.sourceModule,
        }),
    );
    return {
      content: result.content,
      usage: result.usage,
      model: resolved.model.modelId,
      provider: resolved.provider.slug,
      latencyMs: Date.now() - start,
      resolved: {
        providerId: resolved.provider.id,
        aiModelId: resolved.model.id,
        capability: opts.capability,
      },
      toolCalls: result.toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
      })),
    };
  }

  async ping(
    tenantId: string | null,
    capability: Capability,
    /**
     * Optional modelId to pin the ping to. Phase 2.7: used by
     * `testProvider` admin endpoint so the selected provider is
     * actually exercised instead of the global chain's first match.
     */
    explicitModelId?: string,
  ): Promise<{
    ok: boolean;
    latencyMs: number;
    provider: string;
    model: string;
  }> {
    const start = Date.now();
    const resolved = await this.select(tenantId, capability, {
      modelId: explicitModelId,
    });
    const url = `${resolved.provider.apiBaseUrl}/chat/completions`;
    await this.transport.invoke({
      url,
      apiKey: resolved.apiKey,
      model: resolved.model.modelId,
      capability,
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0,
      maxTokens: 1,
      timeoutMs: 5_000,
    });
    return {
      ok: true,
      latencyMs: Date.now() - start,
      provider: resolved.provider.slug,
      model: resolved.model.modelId,
    };
  }

  /** Health snapshot for the admin endpoint. */
  circuitSnapshot(): Array<{ key: string; state: string; failures: number }> {
    return this.circuit.snapshot();
  }

  // ───────────────────────────────────────────────────────────────────
  // Internals
  // ───────────────────────────────────────────────────────────────────

  private async invokeWithRetries(req: {
    url: string;
    apiKey: string;
    model: string;
    messages: ChatMessage[];
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
    signal?: AbortSignal;
    tools?: Array<{
      type: 'function';
      function: { name: string; description: string; parameters: unknown };
    }>;
    responseFormatJson?: boolean;
    capability?: Capability;
    sourceModule?: string;
  }): Promise<{
    content: string;
    toolCalls: Array<{ id: string; name: string; arguments: unknown }>;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    finishReason: string;
    rawModel: string;
  }> {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.transport.invoke({
          url: req.url,
          apiKey: req.apiKey,
          model: req.model,
          capability: req.capability ?? 'conversation',
          messages: req.messages,
          temperature: req.temperature,
          maxTokens: req.maxTokens,
          timeoutMs: req.timeoutMs,
          signal: req.signal,
          ...(req.tools ? { tools: req.tools } : {}),
          ...(req.responseFormatJson ? { responseFormatJson: true } : {}),
          ...(req.sourceModule ? { sourceModule: req.sourceModule } : {}),
        });
      } catch (err) {
        lastErr = err;
        if (!isRetryable(err) || attempt === 2) throw err;
        const retryAfterMs =
          err instanceof Error &&
          'retryAfterMs' in err &&
          typeof (err as { retryAfterMs?: number }).retryAfterMs === 'number'
            ? (err as { retryAfterMs?: number }).retryAfterMs
            : undefined;
        await sleep(computeDelay(attempt, undefined, retryAfterMs));
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error('LLM invoke failed after retries');
  }

  private toMessages(opts: InvokeOptions): ChatMessage[] {
    const out: ChatMessage[] = [];
    if (opts.systemPrompt) {
      out.push({ role: 'system', content: opts.systemPrompt });
    }
    if (opts.messages) {
      out.push(...opts.messages);
    } else if (opts.prompt) {
      out.push({ role: 'user', content: opts.prompt });
    }
    return out;
  }

  /**
   * Phase 2.8: resolve an API key with DB-prefer-encrypted > env fallback.
   * Used by the legacy select()/stream() paths that bypass CapabilityResolver.
   */
  private async resolveApiKey(
    providerSlug: string,
    envVar: string,
  ): Promise<string | null> {
    try {
      const row = await this.prisma.modelProvider.findUnique({
        where: { slug: providerSlug },
        select: { encryptedKey: true },
      });
      if (row?.encryptedKey) {
        const v = this.crypto.decrypt(row.encryptedKey);
        if (v) return v;
      }
    } catch {
      /* fall through to env */
    }
    const envVal = this.secrets.resolve(`env:${envVar}`).value;
    return envVal && envVal.length > 0 ? envVal : null;
  }

  /**
   * Phase 2.8: force the SecretProviderService cache to forget a
   * single secret reference. Used after admin updates to a provider
   * key (encryptedKey in DB) so the next invoke picks up the new
   * value without waiting for the 10s negative TTL.
   */
  invalidateSecret(ref: string): void {
    this.secrets.invalidate(ref);
  }

  /**
   * Map an arbitrary thrown value to a stable error code string.
   * Used in `tried[]` arrays surfaced via `AiGatewayAllProvidersFailedError`.
   * SRP — single source of truth for error classification.
   */
  private classifyErrorCode(err: unknown): string {
    if (err instanceof AiGatewayError) {
      return err.code;
    }
    if (err instanceof Error) {
      const m = err.message.toLowerCase();
      if (m.includes('timeout') || m.includes('etimedout')) return 'AI_GATEWAY_TIMEOUT';
      if (m.includes('401') || m.includes('403') || m.includes('unauthor')) {
        return 'AI_GATEWAY_AUTH';
      }
      if (m.includes('429') || m.includes('rate')) return 'AI_GATEWAY_RATE_LIMIT';
      if (m.includes('500') || m.includes('502') || m.includes('503') || m.includes('504')) {
        return 'AI_GATEWAY_PROVIDER';
      }
      return 'AI_GATEWAY_PROVIDER';
    }
    return 'AI_GATEWAY_UNKNOWN';
  }

  private flattenEnv(): Record<string, unknown> {
    if (!this.configService) return {};
    const cfg = this.configService as unknown as {
      get: (k: string) => unknown;
    };
    const keys = [
      'AI_GATEWAY_V2',
      'AI_CACHE_TTL_SECONDS',
      'AI_CIRCUIT_THRESHOLD',
      'AI_CIRCUIT_COOLDOWN_SECONDS',
      'AI_CIRCUIT_WINDOW_SECONDS',
      'AI_STREAM_ENABLED',
      'AI_DEFAULT_TIMEOUT_MS',
      'AI_DEFAULT_MAX_TOKENS',
      'AI_DEFAULT_TEMPERATURE',
    ];
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const v = cfg.get(k);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
}

function cacheKey(tenantId: string | null, capability: Capability): string {
  return `${tenantId ?? 'system'}|${capability}`;
}

function isFallbackCandidate(err: unknown): boolean {
  if (err instanceof AiGatewayError) {
    return (
      err.code !== 'AI_GATEWAY_AUTH' &&
      err.code !== 'AI_GATEWAY_CONTEXT_LENGTH' &&
      err.code !== 'AI_GATEWAY_BUDGET_EXCEEDED' &&
      err.code !== 'AI_GATEWAY_STRUCTURED_VALIDATION'
    );
  }
  return true;
}
