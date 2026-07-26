// src/modules/tenant-flags/tenant-flags.controller.ts
import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { TenantFlagsService, FeatureFlag } from './tenant-flags.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('tenant-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class TenantFlagsController {
  constructor(private readonly flags: TenantFlagsService) {}

  @Get(':flag')
  async getFlag(
    @Param('flag') flag: FeatureFlag,
    @CurrentUser() user: { tenantId: string },
  ) {
    const enabled = await this.flags.isEnabled(flag, user.tenantId);
    return { flag, enabled };
  }

  @Post(':flag')
  async setFlag(
    @Param('flag') flag: FeatureFlag,
    @Body() body: { enabled: boolean },
    @CurrentUser() user: { tenantId: string; id: string },
  ) {
    await this.flags.setOverride(flag, user.tenantId, body.enabled, user.id);
    return { flag, enabled: body.enabled };
  }
}
