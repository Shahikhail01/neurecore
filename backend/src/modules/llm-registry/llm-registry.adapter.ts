/**
 * LLM Registry Adapter — wires the LLM Provider Registry into the
 * AiGatewayService fallback chain.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.17.4-5.
 *
 * Solid:
 *   • SRP — only resolves provider+model+key for a tenant.
 *   • OCP — adapter does not modify AiGatewayService internals; it
 *     returns a ResolvedModel-compatible shape the existing chain can
 *     consume via a "preferred link".
 *   • DIP — depends on LlmRegistryService abstraction.
 *
 * Behaviour:
 *   • If a tenant has a TenantLlmBinding (status ACTIVE), the adapter
 *     returns a single-link chain built from the binding. This becomes
 *     the FIRST link in the gateway chain.
 *   • If no binding exists, the adapter returns null and the gateway
 *     falls back to its platform-default chain. No bypass, no wildcard.
 */

import { Injectable } from '@nestjs/common';
import { LlmRegistryService } from '@/modules/llm-registry/llm-registry.service';

export interface ResolvedLink {
  providerId: string;
  providerSlug: string;
  providerName: string;
  apiBaseUrl: string;
  aiModelId: string;
  modelId: string;
  displayName: string;
  contextWindow: number;
  costPer1kInput: number | null;
  costPer1kOutput: number | null;
  apiKeyEnv: string; // resolved via secretRef at call time
  apiKey: string; // pre-resolved value (caller MUST NOT log)
}

@Injectable()
export class LlmRegistryAdapter {
  constructor(private readonly registry: LlmRegistryService) {}

  async resolvePreferredLink(tenantId: string): Promise<ResolvedLink | null> {
    const resolved = await this.registry.resolveActiveBindingForTenant(tenantId);
    if (!resolved) return null;
    return {
      providerId: resolved.id,
      providerSlug: resolved.slug,
      providerName: resolved.displayName,
      apiBaseUrl: resolved.baseUrl,
      aiModelId: resolved.model.id,
      modelId: resolved.model.modelId,
      displayName: resolved.model.displayName,
      contextWindow: resolved.model.contextWindow,
      costPer1kInput: null,
      costPer1kOutput: null,
      // We already hold the resolved key — pass it through to the
      // gateway transport without going through env resolution again.
      apiKeyEnv: 'resolved:' + resolved.slug,
      apiKey: resolved.apiKey,
    };
  }
}
