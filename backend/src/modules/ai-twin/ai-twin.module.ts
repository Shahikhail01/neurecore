/**
 * AI Twin — Module.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.3.
 *
 * Module is NOT @Global — only the controller is mounted. The runtime
 * guard is exported so downstream modules (chat, hermes, agent
 * executor) can enforce the permission mirror contract without
 * re-importing the service.
 */

import { Module } from '@nestjs/common';
import { AiTwinRepository } from './ai-twin.repository';
import { AiTwinService } from './ai-twin.service';
import { TwinPermissionMirrorGuard } from './ai-twin.runtime-contract';
import { AiTwinController } from './ai-twin.controller';

@Module({
  controllers: [AiTwinController],
  providers: [AiTwinRepository, AiTwinService, TwinPermissionMirrorGuard],
  exports: [TwinPermissionMirrorGuard, AiTwinService],
})
export class AiTwinModule {}
