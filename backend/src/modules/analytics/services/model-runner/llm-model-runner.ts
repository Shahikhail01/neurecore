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
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  LlmFeatureFlagService,
} from './llm-feature-flag.service';

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
}

@Injectable()
export class LlmModelRunner {
  private readonly logger = new Logger(LlmModelRunner.name);

  constructor(
    private readonly flag: LlmFeatureFlagService,
    private readonly fetchImpl: typeof fetch = fetch,
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

    const startedAt = Date.now();
    const endpoint = this.flag.endpointFor(req.tenantId);
    const model = req.model ?? this.flag.modelFor(req.tenantId, req.capability);
    const body = {
      capability: req.capability,
      model,
      temperature: req.temperature ?? 0,
      max_tokens: req.maxTokens ?? 1024,
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
    return {
      content: json.content ?? '',
      tokensIn: json.tokensIn ?? 0,
      tokensOut: json.tokensOut ?? 0,
      durationMs: Date.now() - startedAt,
      model: json.model ?? model,
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
