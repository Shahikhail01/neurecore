/**
 * Coding Agent SDK Bridge — Controller.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsObject, IsString } from 'class-validator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CodingAgentSdkBridgeService } from './coding-agent-sdk-bridge.service';
import type { SdkVendor } from './coding-agent-sdk-bridge.service';

class ImportDto {
  @IsString() tenantId!: string;
  @IsString() actorId!: string;
  @IsString() vendor!: SdkVendor;
  @IsObject() raw!: Record<string, unknown>;
}

@Controller({ path: 'coding-agents', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SUPER_ADMIN,
)
export class CodingAgentSdkBridgeController {
  constructor(private readonly service: CodingAgentSdkBridgeService) {}

  @Get('vendors')
  listVendors() {
    return this.service.listVendors();
  }

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  import(@Body() dto: ImportDto, @Query('tenantId') _tenantId?: string) {
    return this.service.import(dto);
  }
}
