import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatSseService } from './chat-sse.service';
import { ChatHistoryService } from './chat-history.service';
import { ModelsModule } from '../models/models.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AgentsModule } from '../agents/agents.module';
import { HermesModule } from '../hermes/hermes.module';
import { MetricsModule } from '../metrics/metrics.module';
import { HermesAdapterModule } from '../hermes-adapter/hermes-adapter.module';

@Module({
  imports: [ModelsModule, DatabaseModule, AgentsModule, HermesModule, MetricsModule, HermesAdapterModule],
  controllers: [ChatController],
  providers: [ChatService, ChatSseService, ChatHistoryService],
  exports: [ChatService, ChatHistoryService],
})
export class ChatModule {}
