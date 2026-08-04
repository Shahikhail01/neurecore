/**
 * Channels — Module.
 *
 * Phase 5 of the Creatio AI parity program. Source plan: §5.16.
 *
 * Registers all 12 OOB channel adapters on boot, exports the registry
 * + service so chat / hermes / agents can dispatch outbound + ingest
 * inbound events.
 */

import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { ChannelRegistry, registerOobChannelAdapters } from './channel-adapter.registry';
import { ChannelRepository } from './channel.repository';
import { ChannelService } from './channel.service';
import { ChannelsController } from './channel.controller';

@Global()
@Module({
  controllers: [ChannelsController],
  providers: [ChannelRegistry, ChannelRepository, ChannelService],
  exports: [ChannelRegistry, ChannelService],
})
export class ChannelsModule implements OnModuleInit {
  private readonly logger = new Logger(ChannelsModule.name);

  constructor(private readonly registry: ChannelRegistry) {}

  onModuleInit(): void {
    registerOobChannelAdapters(this.registry);
    this.logger.log(
      `ChannelsModule: registered ${this.registry.list().length} OOB adapters`,
    );
  }
}
