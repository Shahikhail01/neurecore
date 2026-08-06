/**
 * Hermes Adapter — NestJS module bridging NeureCore to the upstream Hermes
 * execution sidecar.
 *
 * Plan ref: NC-AWL-IMP-2 §1.3 (Phase 1.3)
 *
 * The sidecar (`neurecore/infra/hermes-sidecar/`) is an isolated Python
 * service that wraps the vendored upstream `NousResearch/hermes-agent`.
 * It speaks HTTP + HMAC-scoped JWTs. The gateway (this module) is the
 * only thing in NeureCore that knows how to talk to it.
 *
 * Responsibilities:
 *   1. Mint short-lived (≤15 min) HMAC tokens for each execution request.
 *   2. Proxy 5 endpoints (start/resume/cancel/getStatus/submitApproval)
 *      to the sidecar over the internal network.
 *   3. Receive events from the sidecar's webhook and translate them to
 *      HermesAuditLog rows (Phase 1.3 wires the webhook; the audit-log
 *      writer is a Phase 1.4 deliverable).
 *
 * The gateway NEVER trusts the sidecar's response with tenant data —
 * every claim is verified against the JWT claims we minted. The sidecar
 * is treated as a deny-by-default guest.
 *
 * **Architectural boundaries (per the approved plan):**
 *   - Conversation caching (the upstream's most-cherished property) is
 *     preserved by passing a stable `executionId` as the upstream's
 *     `session_id`. This module never mutates the `session_id` mid-flight.
 *   - The gateway owns the audit trail; the sidecar only emits events.
 *   - Tools are gated by the gateway's RBAC layer, not by the sidecar's
 *     toolset selection. The sidecar receives a verified `allowedTools`
 *     list in the token's claims.
 */

import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../../config/configuration.module';
import { HermesAdapterController } from './controllers/hermes-adapter.controller';
import { HermeSidecarEventsController } from './controllers/hermes-sidecar-events.controller';
import { HermesAdapterService } from './services/hermes-adapter.service';
import { HermesTokenService } from './services/token.service';
import { HermeEventsIngestService } from './services/events-ingest.service';
import { HermesToolGatewayController } from './controllers/hermes-tool-gateway.controller';
import { ScopedToolGatewayService } from './tools/scoped-tool-gateway.service';
import { CustomersModule } from '../customers/customers.module';
import { ProjectsModule } from '../projects/projects.module';
import { GoalsModule } from '../goals/goals.module';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MemoryModule } from '../memory/memory.module';
import { HermesModelLeaseController } from './controllers/hermes-model-lease.controller';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AiTwinModule } from '../ai-twin/ai-twin.module';

@Module({
  imports: [
    ConfigurationModule,
    CustomersModule,
    ProjectsModule,
    GoalsModule,
    OrchestrationModule,
    ApprovalsModule,
    NotificationsModule,
    MemoryModule,
    // Phase 10.3 — Creatio AI parity: the scoped-tool gateway injects
    // parity services as chat tools. AnalyticsModule provides
    // PredictionService (lead scoring / forecast); AiTwinModule provides
    // AiTwinService. The other injected services (QuoteService,
    // CaseTriageService, etc. via Phase7Module; ChannelService via
    // ChannelsModule) are @Global so they resolve without an explicit
    // import here.
    AnalyticsModule,
    AiTwinModule,
  ],
  controllers: [
    HermesAdapterController,
    HermeSidecarEventsController,
    HermesToolGatewayController,
    HermesModelLeaseController,
  ],
  providers: [
    HermesAdapterService,
    HermesTokenService,
    HermeEventsIngestService,
    ScopedToolGatewayService,
  ],
  exports: [
    HermesAdapterService,
    HermesTokenService,
  ],
})
export class HermesAdapterModule {}
