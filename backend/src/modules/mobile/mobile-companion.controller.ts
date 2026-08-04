/**
 * Mobile Companion — Controller.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { MobileCompanionService } from './mobile-companion.service';

class RegisterDeviceDto {
  @IsString() tenantId!: string;
  @IsString() userId!: string;
  @IsString() @Length(1, 32) platform!: string;
  @IsString() @Length(8, 256) pushToken!: string;
  @IsString() @IsOptional() deviceModel?: string;
  @IsString() @IsOptional() osVersion?: string;
  @IsString() @Matches(/^\d+\.\d+\.\d+$/) @IsOptional() appVersion?: string;
}

@Controller({ path: 'mobile', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SUPER_ADMIN,
)
export class MobileCompanionController {
  constructor(private readonly service: MobileCompanionService) {}

  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDeviceDto) {
    return this.service.registerDevice(dto);
  }

  @Get('devices')
  list(@Query('tenantId') tenantId: string, @Query('userId') userId: string) {
    return this.service.listDevices(tenantId, userId);
  }

  @Delete('devices/:id')
  @HttpCode(HttpStatus.OK)
  async deregister(
    @Query('tenantId') tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.service.deregisterDevice(tenantId, id);
    return { ok: true };
  }
}
