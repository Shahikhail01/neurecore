/**
 * command-center.module.ts
 *
 * Module for command center aggregation endpoints.
 * Orchestrates dashboard data from multiple sources.
 *
 * SOLID: SRP - Only command center concerns
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database/database.module';
import { ServiceGatewayFlagsModule } from '@/modules/service-gateway-v2/rollout/service-gateway-flags.module';
import { CommandCenterController } from './controllers/command-center.controller';
import { CommandCenterService } from './services/command-center.service';
import { InventoryService } from './services/inventory.service';
import { QualityService } from './services/quality.service';
import { CostService } from './services/cost.service';
import { ModelHealthService } from './services/model-health.service';
import { ChannelHealthService } from './services/channel-health.service';
import { SecurityEventsService } from './services/security-events.service';
import { KillSwitchService } from './services/kill-switch.service';

@Module({
  imports: [DatabaseModule, ServiceGatewayFlagsModule],
  controllers: [CommandCenterController],
  providers: [
    CommandCenterService,
    InventoryService,
    QualityService,
    CostService,
    ModelHealthService,
    ChannelHealthService,
    SecurityEventsService,
    KillSwitchService,
  ],
  exports: [
    CommandCenterService,
    InventoryService,
    QualityService,
    CostService,
    ModelHealthService,
    ChannelHealthService,
    SecurityEventsService,
    KillSwitchService,
  ],
})
export class CommandCenterModule {}
