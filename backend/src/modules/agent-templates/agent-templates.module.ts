import { Module } from '@nestjs/common';
import { AgentTemplatesService } from './agent-templates.service';
import { AgentPacksService } from './agent-packs.service';
import { AgentTemplatesController } from './agent-templates.controller';

@Module({
  controllers: [AgentTemplatesController],
  providers: [AgentTemplatesService, AgentPacksService],
  exports: [AgentTemplatesService, AgentPacksService],
})
export class AgentTemplatesModule {}
