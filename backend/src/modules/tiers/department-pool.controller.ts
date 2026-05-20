import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditLog } from '../../common/decorators/auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateDepartmentPoolSlotDto,
  ReorderDepartmentPoolDto,
  UpdateDepartmentPoolSlotDto,
} from './dto/department-pool.dto';
import { TierCompositionService } from './services/tier-composition.service';

@Controller({ path: 'tiers', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentPoolController {
  constructor(
    private readonly tierCompositionService: TierCompositionService,
  ) {}

  @Get(':tierId/department-pool')
  @Roles(UserRole.SUPER_ADMIN)
  getDepartmentPoolByTier(@Param('tierId', ParseUUIDPipe) tierId: string) {
    return this.tierCompositionService.findDepartmentTemplatesByTierId(tierId);
  }

  @Post(':tierId/department-pool/slots')
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog('TIER_DEPARTMENT_POOL_SLOT_CREATE')
  createDepartmentPoolSlot(
    @Param('tierId', ParseUUIDPipe) tierId: string,
    @Body() dto: CreateDepartmentPoolSlotDto,
  ) {
    return this.tierCompositionService.addDepartmentTemplateToTier({
      tierId,
      departmentTemplateId: dto.departmentTemplateId,
      slot: dto.slot,
      slotType: dto.slotType,
      isRequired: dto.isRequired,
      isDefaultSelected: dto.isDefaultSelected,
    });
  }

  @Patch(':tierId/department-pool/slots/:slotId')
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog('TIER_DEPARTMENT_POOL_SLOT_UPDATE')
  updateDepartmentPoolSlot(
    @Param('tierId', ParseUUIDPipe) tierId: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Body() dto: UpdateDepartmentPoolSlotDto,
  ) {
    void tierId;
    return this.tierCompositionService.updateDepartmentTemplateEntry(slotId, {
      slot: dto.slot,
      slotType: dto.slotType,
      isRequired: dto.isRequired,
      isDefaultSelected: dto.isDefaultSelected,
    });
  }

  @Delete(':tierId/department-pool/slots/:slotId')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLog('TIER_DEPARTMENT_POOL_SLOT_DELETE')
  async deleteDepartmentPoolSlot(
    @Param('tierId', ParseUUIDPipe) tierId: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
  ) {
    void tierId;
    await this.tierCompositionService.removeDepartmentTemplateFromTier(slotId);
  }

  @Post(':tierId/department-pool/reorder')
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog('TIER_DEPARTMENT_POOL_REORDER')
  reorderDepartmentPool(
    @Param('tierId', ParseUUIDPipe) tierId: string,
    @Body() dto: ReorderDepartmentPoolDto,
  ) {
    return this.tierCompositionService.reorderDepartmentTemplates(
      tierId,
      dto.orderedIds,
    );
  }
}
