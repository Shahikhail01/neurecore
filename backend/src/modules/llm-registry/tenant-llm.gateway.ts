/**
 * Tenant-aware LLM Gateway — the per-tenant entry point for LLM calls.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.17.4-5.
 *
 * Why this exists alongside AiGatewayService:
 *   • AiGatewayService resolves the platform-default capability chain
 *     (no per-tenant model selection). Keeping that contract stable
 *     avoids regressing the OpenClaw + LangSmith path.
 *   • Tenant-aware callers (chat, hermes, AI Twin) need to honour the
 *     per-tenant TenantLlmBinding (Phase 1.2) before any platform default.
 *
 * Solid:
 *   • SRP — only resolves a tenant's binding and forwards to the gateway.
 *   • DIP — depends on LlmRegistryAdapter + AiGatewayService abstractions.
 *   • OCP — adding another transport (e.g. Azure) does not touch this file.
 */

import { Injectable, Logger } from '@nestjs/common';
import { LlmRegistryAdapter } from '@/modules/llm-registry/llm-registry.adapter';
import { AiGatewayService } from '@/modules/ai-gateway/ai-gateway.service';

@Injectable()
export class TenantLlmGateway {
  private readonly logger = new Logger(TenantLlmGateway.name);

  constructor(
    private readonly registry: LlmRegistryAdapter,
    private readonly gateway: AiGatewayService,
  ) {}

  /**
   * Resolve the canonical provider for a tenant, log it, and return
   * the link details. Returns null when the tenant has no active binding
   * — the caller should then fall back to its own default chain (e.g.
   * platform-default via AiGatewayService.invoke).
   */
  async resolvePreferredProvider(tenantId: string) {
    return this.registry.resolvePreferredLink(tenantId);
  }

  /**
   * Returns the canonical model id for a tenant (or null if no binding).
   * Downstream callers may use this when they want to send `modelId`
   * into the gateway directly.
   */
  async resolvePreferredModelId(tenantId: string): Promise<string | null> {
    const link = await this.registry.resolvePreferredLink(tenantId);
    return link?.modelId ?? null;
  }
}
