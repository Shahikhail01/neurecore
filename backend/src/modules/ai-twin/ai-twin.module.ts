/**
 * AI Twin — Module.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.3.
 *
 * Module is NOT @Global — only the controller is mounted. The runtime
 * guard is exported so downstream modules (chat, hermes, agent
 * executor) can enforce the permission mirror contract without
 * re-importing the service.
 *
 * R2 follow-up: imports `AgentsModule` so `OfficialAgentGraph` and
 * `AgentCheckpointService` resolve into `TwinGraphExecutor`. Both
 * services are already exported by `AgentsModule`.
 */

import { Module } from '@nestjs/common';
import { AiTwinRepository } from './ai-twin.repository';
import { AiTwinService } from './ai-twin.service';
import { TwinPermissionMirrorGuard } from './ai-twin.runtime-contract';
import { AiTwinController } from './ai-twin.controller';
import { TwinGraphExecutor } from './twin-graph.executor';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule],
  controllers: [AiTwinController],
  providers: [
    AiTwinRepository,
    AiTwinService,
    TwinPermissionMirrorGuard,
    TwinGraphExecutor,
  ],
  exports: [
    TwinPermissionMirrorGuard,
    AiTwinService,
    TwinGraphExecutor,
  ],
})
export class AiTwinModule {}
