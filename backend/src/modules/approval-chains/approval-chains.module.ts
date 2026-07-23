/**
 * approval-chains module — NestJS Module
 *
 * Phase 4: Approval chain resolution.
 * Stage 2 Phase 2A: Industry-specific approval addons registered via registry.
 *
 * SOLID: Single Responsibility — wires approval chain dependencies.
 * DIP: binds IApprovalChainRepository to PrismaApprovalChainRepository via token.
 * OCP: New industry addon = new provider entry. Zero changes to base service.
 *
 * Audit-remediation: imports DeliverablesModule to obtain DELIVERABLE_REPOSITORY
 * for tenant-scoped deliverable lookup used by resolveChain.
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { ApprovalChainsController } from './approval-chains.controller';
import { ApprovalChainsService } from './approval-chains.service';
import { PrismaApprovalChainRepository } from './repositories/prisma-approval-chain.repository';
import { APPROVAL_CHAIN_REPOSITORY } from './interfaces/approval-chain.interface';
import { ApprovalAddonRegistry } from './addons/approval-addon.registry';
import { FinancialApprovalAddon } from './addons/financial-approval.addon';
import { HealthcareApprovalAddon } from './addons/healthcare-approval.addon';
import { BusinessTechnologyApprovalAddon } from './addons/business-technology-approval.addon';
import { ConsumerCommerceApprovalAddon } from './addons/consumer-commerce-approval.addon';
import { IndustrialInfraApprovalAddon } from './addons/industrial-infra-approval.addon';
import { PublicSocialApprovalAddon } from './addons/public-social-approval.addon';
import { AgricultureFoodApprovalAddon } from './addons/agriculture-food-approval.addon';
import { DefaultApprovalAddon } from './addons/default-approval.addon';
import { DeliverablesModule } from '../deliverables/deliverables.module';
import { TiersModule } from '../tiers/tiers.module';

@Module({
  imports: [DeliverablesModule, TiersModule],
  controllers: [ApprovalChainsController],
  providers: [
    ApprovalChainsService,
    {
      provide: APPROVAL_CHAIN_REPOSITORY,
      useClass: PrismaApprovalChainRepository,
    },
    ApprovalAddonRegistry,
    FinancialApprovalAddon,
    HealthcareApprovalAddon,
    BusinessTechnologyApprovalAddon,
    ConsumerCommerceApprovalAddon,
    IndustrialInfraApprovalAddon,
    PublicSocialApprovalAddon,
    AgricultureFoodApprovalAddon,
    DefaultApprovalAddon,
  ],
  exports: [ApprovalChainsService, ApprovalAddonRegistry],
})
export class ApprovalChainsModule implements OnModuleInit {
  constructor(
    private readonly registry: ApprovalAddonRegistry,
    private readonly financialAddon: FinancialApprovalAddon,
    private readonly healthcareAddon: HealthcareApprovalAddon,
    private readonly businessTechAddon: BusinessTechnologyApprovalAddon,
    private readonly consumerCommerceAddon: ConsumerCommerceApprovalAddon,
    private readonly industrialInfraAddon: IndustrialInfraApprovalAddon,
    private readonly publicSocialAddon: PublicSocialApprovalAddon,
    private readonly agricultureFoodAddon: AgricultureFoodApprovalAddon,
    private readonly defaultAddon: DefaultApprovalAddon,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.financialAddon);
    this.registry.register(this.healthcareAddon);
    this.registry.register(this.businessTechAddon);
    this.registry.register(this.consumerCommerceAddon);
    this.registry.register(this.industrialInfraAddon);
    this.registry.register(this.publicSocialAddon);
    this.registry.register(this.agricultureFoodAddon);
    this.registry.register(this.defaultAddon);
  }
}
