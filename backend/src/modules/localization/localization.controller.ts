/**
 * Localization — Controller.
 */

import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { LocalizationService } from './localization.service';

class SetTenantLocaleDto {
  @IsString() @Length(2, 12) localeId!: string;
}

@Controller({ path: 'localization', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SUPER_ADMIN,
)
export class LocalizationController {
  constructor(private readonly service: LocalizationService) {}

  @Get('catalog')
  catalog() {
    return this.service.listCatalog();
  }

  @Get('tenant')
  async resolve(@Query('tenantId') tenantId: string) {
    return this.service.resolveTenantLocale(tenantId);
  }

  @Patch('tenant')
  async setTenant(
    @Query('tenantId') tenantId: string,
    @Body() dto: SetTenantLocaleDto,
  ) {
    return this.service.setTenantLocale(tenantId, dto.localeId);
  }
}
