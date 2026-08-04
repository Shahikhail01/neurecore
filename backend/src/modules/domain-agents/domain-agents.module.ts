/**
 * Domain Agents — Module.
 *
 * Phase 4 of the Creatio AI parity program. Source plan: §5.6, §5.7, §5.8,
 * §5.15.
 */

import { Module } from '@nestjs/common';
import { DomainAgentRepository } from './domain-agents.repository';
import { DomainAgentService } from './domain-agents.service';
import { DomainAgentsController } from './domain-agents.controller';

@Module({
  controllers: [DomainAgentsController],
  providers: [DomainAgentRepository, DomainAgentService],
  exports: [DomainAgentService, DomainAgentRepository],
})
export class DomainAgentsModule {}
