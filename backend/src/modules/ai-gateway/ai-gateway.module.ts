/**
 * AI Gateway Module
 *
 * Wires the gateway's collaborating classes. The module is `@Global`
 * so any consumer (chat, hermes, agents, COS, …) can inject
 * `AiGatewayService` without re-importing the module.
 *
 * Architectural rules (from ai-gateway-imp-plan.md §2):
 *   - One entry point: `AiGatewayService`.
 *   - Helpers (transport, resolver, breaker, …) are exported only when
 *     a test or admin endpoint needs them. Production code should
 *     never import them directly.
 *
 * SOLID: SRP — this module owns gateway composition; it does not
 * implement LLM logic itself.
 */

import { Global, Module } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';
import { CostAttributorService } from './cost/cost-attributor.service';
import { FallbackChainBuilder } from './failover/fallback-chain';
import { StructuredLogger } from './observability/structured-logger';
import { LangSmithSink } from './observability/langsmith-sink';
import { AiModelRepository } from './selection/ai-model.repository';
import { CapabilityResolver } from './selection/capability-resolver';
import { HttpLlmTransport } from './transport/http-llm.transport';
import { OpenClawGatewayService } from './openclaw-gateway.service';
import { LangSmithTracingService } from './langsmith-tracing.service';
import { OPENCLAW_CONFIG } from './openclaw-gateway.tokens';
import { ModelsAdminController } from './controllers/models-admin.controller';
import { ModelsReadController } from './controllers/models-read.controller';
import { AiProvidersController } from './controllers/ai-providers.controller';
import { SecretProviderService } from '../security/providers/secret.provider';
import { ConnectorsModule } from '../connectors/connectors.module';

@Global()
@Module({
  imports: [ConnectorsModule],
  controllers: [ModelsAdminController, ModelsReadController, AiProvidersController],
  providers: [
    // OpenClaw + LangSmith are unchanged (per plan §3.1 row S34/S35:
    // they continue to live here alongside the gateway for now; the
    // plan moves them out in a later cleanup PR. Keeping them here
    // preserves the existing API surface and import graph.)
    {
      provide: OPENCLAW_CONFIG,
      useFactory: (secrets: { getOpenClawApiKey(): string }) => ({
        endpoint: 'https://api.openclaw.ai/v1',
        apiKey: secrets.getOpenClawApiKey(),
        timeout: 30_000,
        retryAttempts: 3,
        enableTracing: true,
      }),
      inject: [SecretProviderService],
    },
    OpenClawGatewayService,
    LangSmithTracingService,
    // AI Gateway v2 collaborators
    HttpLlmTransport,
    AiModelRepository,
    FallbackChainBuilder,
    CapabilityResolver,
    CostAttributorService,
    StructuredLogger,
    LangSmithSink,
    AiGatewayService,
  ],
  exports: [
    OpenClawGatewayService,
    LangSmithTracingService,
    LangSmithSink,
    AiGatewayService,
  ],
})
export class AIGatewayModule {}
