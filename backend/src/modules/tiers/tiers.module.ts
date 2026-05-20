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
import { DepartmentPoolController } from './department-pool.controller';
import { TierPoolService } from './services/tier-pool.service';
import { PoolProvisioningService } from './services/pool-provisioning.service';
import { TierEnforcementService } from './services/tier-enforcement.service';
import { PoolSlotGuard } from './guards/pool-slot.guard';
import { TierCompositionService } from './services/tier-composition.service';
import { TenantDeploymentService } from './services/tenant-deployment.service';
import { TenantResourcePolicyService } from './services/tenant-resource-policy.service';
import { AssignmentService } from './services/assignment.service';
import { DepartmentPoolProvisioningService } from './services/department-pool-provisioning.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [
    TiersController,
    AgentPoolController,
    TierPoolController,
    DepartmentPoolController,
  ],
  providers: [
    TiersService,
    TierProvisioningService,
    AgentPoolService,
    TierPoolService,
    PoolProvisioningService,
    TierEnforcementService,
    TierCompositionService,
    TenantDeploymentService,
    TenantResourcePolicyService,
    AssignmentService,
    DepartmentPoolProvisioningService,
    // PoolSlotGuard temporarily disabled — causes UnknownDependenciesException when used in AgentsModule
  ],
  exports: [
    TiersService,
    TierProvisioningService,
    AgentPoolService,
    TierPoolService,
    PoolProvisioningService,
    TierEnforcementService,
    TierCompositionService,
    TenantDeploymentService,
    TenantResourcePolicyService,
    AssignmentService,
    DepartmentPoolProvisioningService,
    // PoolSlotGuard temporarily disabled — causes UnknownDependenciesException when used in AgentsModule
  ],
})
export class TiersModule {}
