/**
 * command-center.module.ts
 *
 * Module for command center aggregation endpoints.
 * Orchestrates dashboard data from multiple sources.
 *
 * SOLID: SRP - Only command center concerns.
 *
 * Phase 14: additionally wires typed wrappers:
 *   - CostCentsService                  (P14 budget math — integer cents)
 *   - InventoryWithHygieneService       (P14 dashboard summary derivations)
 *   - KillSwitchTenantScopeService      (P14 tenant-scope guardrail)
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database/database.module';
import { ServiceGatewayFlagsModule } from '@/modules/service-gateway-v2/rollout/service-gateway-flags.module';
import { CommandCenterController } from './controllers/command-center.controller';
import { CommandCenterService } from './services/command-center.service';
import { InventoryService } from './services/inventory.service';
import { QualityService } from './services/quality.service';
import { CostService } from './services/cost.service';
import { CostCentsService } from './services/cost.cents.service';
import { ModelHealthService } from './services/model-health.service';
import { ChannelHealthService } from './services/channel-health.service';
import { SecurityEventsService } from './services/security-events.service';
import { KillSwitchService } from './services/kill-switch.service';
import { KillSwitchTenantScopeService } from './services/kill-switch.tenant-scope.service';
import { InventoryWithHygieneService } from './services/inventory-with-hygiene.service';

@Module({
  imports: [DatabaseModule, ServiceGatewayFlagsModule],
  controllers: [CommandCenterController],
  providers: [
    CommandCenterService,
    InventoryService,
    QualityService,
    CostService,
    CostCentsService,
    ModelHealthService,
    ChannelHealthService,
    SecurityEventsService,
    KillSwitchService,
    KillSwitchTenantScopeService,
    InventoryWithHygieneService,
  ],
  exports: [
    CommandCenterService,
    InventoryService,
    QualityService,
    CostService,
    CostCentsService,
    ModelHealthService,
    ChannelHealthService,
    SecurityEventsService,
    KillSwitchService,
    KillSwitchTenantScopeService,
    InventoryWithHygieneService,
  ],
})
export class CommandCenterModule {}
