/**
 * Always-on CRM — Controller.
 *
 * Mounted under `/api/v1/always-on`. Tenant-scoped; platform-admin can
 * override via query param.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsString } from 'class-validator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AlwaysOnService } from './always-on.service';

class SetCapabilityDto {
  @IsString() tenantId!: string;
  @IsBoolean() enabled!: boolean;
}

@Controller({ path: 'always-on', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SUPER_ADMIN,
)
export class AlwaysOnController {
  constructor(private readonly service: AlwaysOnService) {}

  @Get('catalog')
  catalog() {
    return this.service.listCatalog();
  }

  @Get('surface')
  async surface(@Query('tenantId') tenantId: string) {
    return this.service.getSurface(tenantId);
  }

  @Patch('capabilities/:capabilityId')
  async setCapability(
    @Param('capabilityId') capabilityId: string,
    @Body() dto: SetCapabilityDto,
  ) {
    await this.service.setCapabilityEnabled({
      tenantId: dto.tenantId,
      capabilityId,
      enabled: dto.enabled,
    });
    return { ok: true };
  }
}
