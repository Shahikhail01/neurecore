import { Module, forwardRef } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatExportController } from './controllers/chat-export.controller';
import { SkillRegistryController } from './skill-registry.controller';
import { ChatService } from './chat.service';
import { ChatSseService } from './chat-sse.service';
import { ChatHistoryService } from './chat-history.service';
import { PageContextGateway } from './page-context.gateway';
import { ResponseLocalizer } from './multilingual/response-localizer';
import { MultilingualHandler } from './multilingual/multilingual.handler';
import { ChatExportService } from './services/chat-export.service';
import {
  ChatExportAuditSink,
  CHAT_EXPORT_AUDIT_SINK,
} from './services/chat-export-audit-sink';
import { ModelsModule } from '../models/models.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AgentsModule } from '../agents/agents.module';
import { HermesModule } from '../hermes/hermes.module';
import { MetricsModule } from '../metrics/metrics.module';
import { HermesAdapterModule } from '../hermes-adapter/hermes-adapter.module';
import { ChatResponseModule } from './responses/chat-response.module';
import { ServiceGatewayV2Module } from '../service-gateway-v2/service-gateway-v2.module';
import { RoutingDecisionsModule } from '../routing-decisions/routing-decisions.module';
import { SkillRegistryModule } from '../skill-registry/skill-registry.module';
import { AuditModule } from '../audit/audit.module';
import { AgentRuntimeModule } from '../agent-runtime/agent-runtime.module';
import { AGENT_CHAT_DISPATCHER } from '../agent-runtime/runtime/agent-runtime-chat-dispatcher';

@Module({
  imports: [
    ModelsModule,
    DatabaseModule,
    AgentsModule,
    HermesModule,
    MetricsModule,
    HermesAdapterModule,
    ChatResponseModule,
    forwardRef(() => ServiceGatewayV2Module),
    RoutingDecisionsModule,
    SkillRegistryModule, // Phase 11 — SkillRegistry is global
    AuditModule,
    AgentRuntimeModule, // Phase 23 — chat can dispatch to the agent runtime
  ],
  controllers: [ChatController, ChatExportController, SkillRegistryController],
  providers: [
    ChatService,
    ChatSseService,
    ChatHistoryService,
    PageContextGateway,
    ResponseLocalizer,
    MultilingualHandler,
    ChatExportService,
    ChatExportAuditSink,
    { provide: CHAT_EXPORT_AUDIT_SINK, useExisting: ChatExportAuditSink },
  ],
  exports: [
    ChatService,
    ChatHistoryService,
    PageContextGateway,
    ResponseLocalizer,
    MultilingualHandler,
    ChatExportService,
  ],
})
export class ChatModule {}
