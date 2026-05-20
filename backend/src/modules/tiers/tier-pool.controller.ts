/**
 * tier-pool.controller.ts — SOLID: Single Responsibility Principle
 *
 * SRP: This controller handles ONLY tier pool CRUD operations.
 * It does NOT manage tiers (TiersController) or agents (AgentsController).
 *
 * IMPORTANT: pool/* routes are defined BEFORE :id routes to prevent Express
 * from matching "pool" as the :id parameter value.
 *
 * DIP: Depends on TierPoolService and PoolProvisioningService abstractions.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { TierPoolService } from './services/tier-pool.service';
import { PoolProvisioningService } from './services/pool-provisioning.service';
import { DepartmentPoolProvisioningService } from './services/department-pool-provisioning.service';
import { TierEnforcementService } from './services/tier-enforcement.service';
import { AgentPoolService } from './services/agent-pool.service';
import {
  CreatePoolSlotDto,
  ProvisionDepartmentFromSlotDto,
  UpdatePoolSlotDto,
  ProvisionToTenantDto,
  ProvisionAgentFromSlotDto,
  ReplaceSlotAgentDto,
} from './dto/pool-provisioning.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TENANT_ADMIN_ROLES } from '../../common/types/user-role.utils';

@Controller({ path: 'tiers', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class TierPoolController {
  constructor(
    private readonly tierPoolService: TierPoolService,
    private readonly poolProvisioningService: PoolProvisioningService,
    private readonly departmentPoolProvisioningService: DepartmentPoolProvisioningService,
    private readonly tierEnforcementService: TierEnforcementService,
    private readonly agentPoolService: AgentPoolService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  // TENANT ADMIN — Pool Status (MUST be before :id routes to avoid "pool" matching :id)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * GET /tiers/pool/status
   * Tenant ADMIN — get current tenant's pool status (which slots filled, remaining)
   */
  @Get('pool/status')
  @Roles(...TENANT_ADMIN_ROLES)
  async getTenantPoolStatus(@CurrentUser() user: any) {
    if (!user?.tenantId) {
      throw new Error('No tenant associated with this user');
    }
    return this.tierPoolService.getPoolStatusForTenant(user.tenantId);
  }

  /**
   * GET /tiers/pool/status/departments
   * Tenant ADMIN — get current tenant's department pool status
   */
  @Get('pool/status/departments')
  @Roles(...TENANT_ADMIN_ROLES)
  async getTenantDepartmentPoolStatus(@CurrentUser() user: any) {
    if (!user?.tenantId) {
      throw new Error('No tenant associated with this user');
    }
    return this.tierPoolService.getDepartmentPoolStatusForTenant(user.tenantId);
  }

  /**
   * POST /tiers/pool/provision-slot
   * Tenant ADMIN — provision an agent from a specific choice slot
   */
  @Post('pool/provision-slot')
  @Roles(...TENANT_ADMIN_ROLES)
  async provisionFromSlot(
    @Body() dto: ProvisionAgentFromSlotDto,
    @CurrentUser() user: any,
  ) {
    if (!user?.tenantId) throw new Error('No tenant associated with this user');
    await this.tierEnforcementService.enforceAgentLimit(user.tenantId);
    return this.poolProvisioningService.provisionFromSlot(
      user.tenantId,
      dto.slotId,
      user.userId,
    );
  }

  /**
   * POST /tiers/pool/provision-department-slot
   * Tenant ADMIN — provision a department from a specific choice slot
   */
  @Post('pool/provision-department-slot')
  @Roles(...TENANT_ADMIN_ROLES)
  async provisionDepartmentFromSlot(
    @Body() dto: ProvisionDepartmentFromSlotDto,
    @CurrentUser() user: any,
  ) {
    if (!user?.tenantId) throw new Error('No tenant associated with this user');
    return this.departmentPoolProvisioningService.provisionFromSlot(
      user.tenantId,
      dto.slotId,
      dto,
      user.userId,
    );
  }

  /**
   * DELETE /tiers/pool/slots/:slotId
   * Tenant ADMIN — release a choice slot (remove the agent)
   */
  @Delete('pool/slots/:slotId')
  @Roles(...TENANT_ADMIN_ROLES)
  async releaseSlot(
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @CurrentUser() user: any,
  ) {
    if (!user?.tenantId) throw new Error('No tenant associated with this user');
    await this.poolProvisioningService.releaseSlot(user.tenantId, slotId);
    return { success: true, slotId, message: 'Slot released successfully' };
  }

  /**
   * PATCH /tiers/pool/slots/:slotId
   * Tenant ADMIN — replace agent in a choice slot with a new template
   */
  @Patch('pool/slots/:slotId')
  @Roles(...TENANT_ADMIN_ROLES)
  async replaceSlotAgent(
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Body() dto: ReplaceSlotAgentDto,
    @CurrentUser() user: any,
  ) {
    if (!user?.tenantId) throw new Error('No tenant associated with this user');
    return this.poolProvisioningService.replaceChoiceSlot(
      user.tenantId,
      slotId,
      dto.newTemplateId,
      user.userId,
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUPER_ADMIN — Tier Pool Slot Management
  // :id here is a UUID — "pool" literal is already handled above so won't match
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * GET /tiers/:id/pool
   * SuperAdmin only — view all pool slots for a tier
   */
  @Get(':id/pool')
  @Roles(UserRole.SUPER_ADMIN)
  async getTierPool(@Param('id', ParseUUIDPipe) tierId: string) {
    const slots = await this.tierPoolService.getSlotsForTier(tierId);
    const fixedSlots = slots.filter((s) => s.slotType === 'FIXED');
    const choiceSlots = slots.filter((s) => s.slotType === 'CHOICE');
    return {
      tierId,
      totalSlots: slots.length,
      fixedCount: fixedSlots.length,
      choiceCount: choiceSlots.length,
      slots,
      fixedSlots,
      choiceSlots,
    };
  }

  /**
   * POST /tiers/:id/pool/slots
   * SuperAdmin only — add a new pool slot to a tier
   */
  @Post(':id/pool/slots')
  @Roles(UserRole.SUPER_ADMIN)
  async createSlot(
    @Param('id', ParseUUIDPipe) tierId: string,
    @Body() dto: CreatePoolSlotDto,
  ) {
    return this.agentPoolService.addToPool({
      tierId,
      templateId: dto.templateId,
      slot: dto.slot,
      slotType: dto.slotType,
      isRequired: dto.isRequired,
      isDefaultSelected: dto.isDefaultSelected,
      defaultBudgetPerDay: dto.defaultBudgetPerDay,
      defaultModel: dto.defaultModel,
    });
  }

  /**
   * PATCH /tiers/:id/pool/slots/:slotId
   * SuperAdmin only — update a pool slot (reorder, change type, defaults)
   */
  @Patch(':id/pool/slots/:slotId')
  @Roles(UserRole.SUPER_ADMIN)
  async updateSlot(
    @Param('id', ParseUUIDPipe) tierId: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Body() dto: UpdatePoolSlotDto,
  ) {
    void tierId;
    return this.agentPoolService.updatePoolEntry(slotId, {
      slot: dto.slot,
      slotType: dto.slotType,
      isRequired: dto.isRequired,
      isDefaultSelected: dto.isDefaultSelected,
      defaultBudgetPerDay: dto.defaultBudgetPerDay,
      defaultModel: dto.defaultModel,
    });
  }

  /**
   * DELETE /tiers/:id/pool/slots/:slotId
   * SuperAdmin only — remove a pool slot (must have no filled agents)
   */
  @Delete(':id/pool/slots/:slotId')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteSlot(
    @Param('id', ParseUUIDPipe) tierId: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
  ) {
    void tierId;
    await this.agentPoolService.removeFromPool(slotId);
    return { success: true, deleted: slotId };
  }

  /**
   * POST /tiers/:id/pool/provision
   * SuperAdmin only — provision pool slots to a specific tenant
   */
  @Post(':id/pool/provision')
  @Roles(UserRole.SUPER_ADMIN)
  async provisionPool(
    @Param('id', ParseUUIDPipe) tierId: string,
    @Body() dto: ProvisionToTenantDto,
    @CurrentUser() user: any,
  ) {
    const results = await this.poolProvisioningService.provisionDefaultPool(
      dto.tenantId,
      user.userId,
    );
    return {
      success: true,
      tenantId: dto.tenantId,
      tierId,
      provisioned: results,
      totalProvisioned: results.length,
    };
  }
}
