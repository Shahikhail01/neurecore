import { Module, forwardRef } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { SkillRegistryController } from './skill-registry.controller';
import { ChatService } from './chat.service';
import { ChatSseService } from './chat-sse.service';
import { ChatHistoryService } from './chat-history.service';
import { PageContextGateway } from './page-context.gateway';
import { ResponseLocalizer } from './multilingual/response-localizer';
import { ChatExportService } from './services/chat-export.service';
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
  ],
  controllers: [ChatController, SkillRegistryController],
  providers: [
    ChatService,
    ChatSseService,
    ChatHistoryService,
    PageContextGateway,
    ResponseLocalizer,
    ChatExportService,
  ],
  exports: [
    ChatService,
    ChatHistoryService,
    PageContextGateway,
    ResponseLocalizer,
    ChatExportService,
  ],
})
export class ChatModule {}
