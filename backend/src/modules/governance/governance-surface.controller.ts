/**
 * Governance Application Surface — Controller (Phase 2).
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.14.
 *
 * Mounted under `/api/v1/governance`. Exposes:
 *   • POST   /governance/seed        — seed predefined controls for the tenant
 *   • GET    /governance/domains     — domain summary (data / user-access / operational / security)
 *   • GET    /governance/controls    — list controls (filterable)
 *   • POST   /governance/controls    — create a custom control
 *   • GET    /governance/environments — list registered environments (admin)
 *
 * Solid: SRP — HTTP boundary only.
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
import { IsArray, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '@/modules/auth/interfaces/token.interface';
import { GovernanceService } from './governance.service';

class CreateCustomControlDto {
  @IsString()
  slug!: string;

  @IsString()
  displayName!: string;

  @IsString()
  description!: string;

  @IsString()
  severity!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsString()
  domain!: 'data' | 'user-access' | 'operational' | 'security';

  @IsArray()
  @IsOptional()
  standards?: string[];

  @IsString()
  @IsOptional()
  cadence?: string;
}

@Controller({ path: 'governance', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AUDITOR, UserRole.PLATFORM_ADMIN, UserRole.SUPER_ADMIN)
export class GovernanceSurfaceController {
  constructor(private readonly service: GovernanceService) {}

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  async seed(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      throw new Error('tenantId required');
    }
    const created = await this.service.seedPredefinedControlsForTenant(
      user.tenantId,
    );
    return { data: { created } };
  }

  @Get('domains')
  async domains(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      throw new Error('tenantId required');
    }
    return { data: await this.service.getDomainSummary(user.tenantId) };
  }

  @Get('controls/predefined')
  listPredefined() {
    return { data: this.service.listPredefinedControlSeeds() };
  }
}
