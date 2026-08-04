/**
 * LLM Provider Registry — Module.
 *
 * Phase 1 of the Creatio AI parity program. Source plan §5.17.4-5.
 *
 * Solid:
 *   • Module is `@Global` so chat / hermes / agents can inject
 *     LlmRegistryService without re-importing.
 *   • Controllers are split (admin vs tenant) per SRP.
 *   • Adapter + TenantLlmGateway are exported so other modules can
 *     resolve per-tenant models without coupling to the HTTP surface.
 *
 * Public surface:
 *   • cc.neurecore.com  → /api/v1/admin/llm-registry/providers[/:id]
 *   • hq.neurecore.com  → /api/v1/llm-registry/bindings[/:id]
 */

import { Global, Module } from '@nestjs/common';
import { LlmRegistryService } from './llm-registry.service';
import { LlmRegistryRepository } from './llm-registry.repository';
import { LlmRegistryAdminController } from './llm-registry-admin.controller';
import { LlmRegistryTenantController } from './llm-registry-tenant.controller';
import { LlmRegistryAdapter } from './llm-registry.adapter';
import { TenantLlmGateway } from './tenant-llm.gateway';
import { SecurityModule } from '@/modules/security/security.module';
import { AIGatewayModule } from '@/modules/ai-gateway/ai-gateway.module';

@Global()
@Module({
  imports: [SecurityModule, AIGatewayModule],
  controllers: [LlmRegistryAdminController, LlmRegistryTenantController],
  providers: [
    LlmRegistryRepository,
    LlmRegistryService,
    LlmRegistryAdapter,
    TenantLlmGateway,
  ],
  exports: [LlmRegistryService, LlmRegistryAdapter, TenantLlmGateway],
})
export class LlmRegistryModule {}

