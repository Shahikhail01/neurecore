/**
 * Phase 21 — LlmFeatureFlagService.
 *
 * Per-tenant opt-in for the LLM runner. By default, every tenant has
 * `enabled=false` for every capability — Phase 21 is *strictly
 * additive*. Ops flips the flag on for specific tenants / capabilities
 * via Ops API or environment-level default.
 *
 * Env vars:
 *   LLM_DEFAULT_ENABLED=true   → enable for ALL tenants (use sparingly)
 *   LLM_ENDPOINT               → the LLM upstream endpoint
 *   LLM_DEFAULT_MODEL          → default model (e.g. "deepseek-chat")
 *   LLM_API_KEY                → upstream API key
 */

import { Injectable, Logger } from '@nestjs/common';

export interface LlmFeatureFlag {
  enabled: boolean;
  endpoint: string;
  model: string;
  apiKey: string;
}

@Injectable()
export class LlmFeatureFlagService {
  private readonly logger = new Logger(LlmFeatureFlagService.name);

  private readonly globalDefaultEnabled =
    (process.env['LLM_DEFAULT_ENABLED'] ?? '').toLowerCase() === 'true';
  private readonly endpoint = process.env['LLM_ENDPOINT'] ?? 'http://localhost:9999/llm';
  private readonly model = process.env['LLM_DEFAULT_MODEL'] ?? 'deepseek-chat';
  private readonly apiKey = process.env['LLM_API_KEY'] ?? '';

  /**
   * Per-tenant, per-capability feature flag lookup. By default
   * returns the global default. Operators can override at runtime
   * by adding rows to the `LLM_FEATURE_FLAGS` env var in the form
   * `tenantId:capability=true|false` separated by commas.
   */
  async isEnabled(tenantId: string, capability: string): Promise<boolean> {
    if (!tenantId || tenantId === '*') return false;
    const overrides = this.parseOverrides();
    const key = `${tenantId}:${capability}`;
    if (key in overrides) return overrides[key]!;
    return this.globalDefaultEnabled;
  }

  endpointFor(_tenantId: string): string {
    return this.endpoint;
  }

  modelFor(_tenantId: string, _capability: string): string {
    return this.model;
  }

  apiKeyFor(_tenantId: string): string {
    return this.apiKey;
  }

  private parseOverrides(): Record<string, boolean> {
    const raw = process.env['LLM_FEATURE_FLAGS'] ?? '';
    if (!raw) return {};
    const out: Record<string, boolean> = {};
    for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim().toLowerCase() === 'true';
      out[k] = v;
    }
    return out;
  }
}
