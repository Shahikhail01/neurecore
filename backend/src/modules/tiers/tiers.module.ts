/**
 * TiersModule - SOLID: Single Responsibility Principle
 *
 * SRP: Only handles tier and agent pool concerns
 * OCP: Extends via interfaces
 * DIP: All dependencies injected, not instantiated
 */

import { Module } from '@nestjs/common';
import { TiersController } from './tiers.controller';
import { TiersService } from './tiers.service';
import { TierProvisioningService } from './services/tier-provisioning.service';
import { AgentPoolService } from './services/agent-pool.service';
import { AgentPoolController } from './agent-pool.controller';
import { TierPoolController } from './tier-pool.controller';
import { TierPoolService } from './services/tier-pool.service';
import { PoolProvisioningService } from './services/pool-provisioning.service';
import { TierEnforcementService } from './services/tier-enforcement.service';
import { PoolSlotGuard } from './guards/pool-slot.guard';

@Module({
  controllers: [
    TiersController,
    AgentPoolController,
    TierPoolController,
  ],
  providers: [
    TiersService,
    TierProvisioningService,
    AgentPoolService,
    TierPoolService,
    PoolProvisioningService,
    TierEnforcementService,
    // PoolSlotGuard temporarily disabled — causes UnknownDependenciesException when used in AgentsModule
  ],
  exports: [
    TiersService,
    TierProvisioningService,
    AgentPoolService,
    TierPoolService,
    PoolProvisioningService,
    TierEnforcementService,
    // PoolSlotGuard temporarily disabled — causes UnknownDependenciesException when used in AgentsModule
  ],
})
export class TiersModule {}
