/**
 * Phase 21 — LlmModelRunner.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-19-21.md §5.
 *
 * Phase 21 swaps the deterministic heuristic brain behind every
 * prediction provider with an LLM-backed runner — but ONLY when the
 * per-tenant feature flag is enabled. By default, every provider
 * continues to fall back to its existing heuristic path
 * (`InProcessMockModelRunner`), so Phase 21 is *strictly
 * additive*. Operators opt in via Ops.
 *
 * SRP — owns ONLY the LLM HTTP request/response + cost/telemetry
 * accounting. The actual prediction math + LLM prompt assembly
 * stays in the provider (which is the canonical `IPredictionProvider`
 * implementation).
 *
 * DIP — depends on `LlmFeatureFlagService` (per-tenant opt-in) + a
 * typed HTTP fetch. No provider-specific knowledge lives here.
 *
 * Phase 30 (CR-AI-1305) — the runner is also the platform's LLM spend
 * hook. Before the upstream call it asks the injected
 * `ICostCeilingEnforcer` for authorisation, and after a successful
 * call it reports the realised spend. The enforcer is optional so
 * every existing construction site (and the Phase 21 gate) keeps
 * working unchanged; when it is absent no ceiling is applied.
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { LlmFeatureFlagService } from './llm-feature-flag.service';
import { COST_CEILING_ENFORCER } from '../../../cost-ceiling/interfaces/ICeilingRule';
import type { ICostCeilingEnforcer } from '../../../cost-ceiling/interfaces/ICostCeilingEnforcer';

export interface LlmRunRequest {
  readonly tenantId: string;
  readonly capability: string;
  readonly prompt: string;
  readonly features: Record<string, unknown>;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly responseSchema?: Record<string, unknown>;
}

export interface LlmRunResult {
  readonly content: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly durationMs: number;
  readonly model: string;
  /** Realised spend reported to the cost ceiling, in integer cents. */
  readonly costCents: number;
}

/**
 * Integer cents per 1k tokens used to project and report LLM spend
 * when the upstream response carries no price. Overridable per
 * deployment through `LLM_COST_CENTS_PER_1K_TOKENS`.
 *
 * An unset or blank variable must fall back to the default — an
 * empty string coerces to 0 in JavaScript, which would silently
 * report every call as free and disable the spend ceiling.
 */
export const DEFAULT_COST_CENTS_PER_1K_TOKENS = 1;

export function costCentsPer1kTokens(): number {
  const raw = process.env['LLM_COST_CENTS_PER_1K_TOKENS'];
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_COST_CENTS_PER_1K_TOKENS;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_COST_CENTS_PER_1K_TOKENS;
}

/** Integer cents for a token count, rounded up so spend is never under-reported. */
export function tokensToCents(tokens: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0) return 0;
  return Math.ceil((tokens / 1000) * costCentsPer1kTokens());
}

@Injectable()
export class LlmModelRunner {
  private readonly logger = new Logger(LlmModelRunner.name);

  constructor(
    private readonly flag: LlmFeatureFlagService,
    private readonly fetchImpl: typeof fetch = fetch,
    @Optional()
    @Inject(COST_CEILING_ENFORCER)
    private readonly ceiling: ICostCeilingEnforcer | null = null,
  ) {}

  async run(req: LlmRunRequest): Promise<LlmRunResult> {
    const enabled = await this.flag.isEnabled(req.tenantId, req.capability);
    if (!enabled) {
      // LLM opt-in is OFF. Caller must fall back to the deterministic
      // runner. We throw a typed error so the provider's catch
      // branch can switch to the heuristic path cleanly.
      throw new LlmOptedOutError(
        `LLM runner opted out for tenant=${req.tenantId} capability=${req.capability}`,
      );
    }

    // Phase 30 — hard containment. A breached ceiling throws
    // `CostCeilingExceededError` and the upstream call never happens.
    const maxTokens = req.maxTokens ?? 1024;
    if (this.ceiling) {
      await this.ceiling.authorize({
        tenantId: req.tenantId,
        capability: req.capability,
        projection: {
          estimatedCents: tokensToCents(maxTokens),
          estimatedTokens: maxTokens,
          requests: 1,
        },
      });
    }

    const startedAt = Date.now();
    const endpoint = this.flag.endpointFor(req.tenantId);
    const model = req.model ?? this.flag.modelFor(req.tenantId, req.capability);
    const body = {
      capability: req.capability,
      model,
      temperature: req.temperature ?? 0,
      max_tokens: maxTokens,
      response_schema: req.responseSchema ?? null,
      features: req.features,
      prompt: req.prompt,
    };
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.flag.apiKeyFor(req.tenantId)}`,
    };

    const res = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new LlmRunnerError(
        `LLM call failed: HTTP ${res.status}: ${await res.text().catch(() => '')}`,
      );
    }
    const json = (await res.json()) as {
      content: string;
      tokensIn?: number;
      tokensOut?: number;
      model: string;
    };
    const tokensIn = json.tokensIn ?? 0;
    const tokensOut = json.tokensOut ?? 0;
    const costCents = tokensToCents(tokensIn + tokensOut);

    if (this.ceiling) {
      await this.ceiling.reportSpend({
        tenantId: req.tenantId,
        capability: req.capability,
        costCents,
        tokens: tokensIn + tokensOut,
      });
    }

    return {
      content: json.content ?? '',
      tokensIn,
      tokensOut,
      durationMs: Date.now() - startedAt,
      model: json.model ?? model,
      costCents,
    };
  }
}

/**
 * Thrown when the LLM feature flag is OFF. Provider code should
 * catch this and fall back to the deterministic heuristic path.
 */
export class LlmOptedOutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmOptedOutError';
  }
}

/**
 * Thrown on a real HTTP failure. Provider code may retry or
 * fall back to abstention.
 */
export class LlmRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmRunnerError';
  }
}
