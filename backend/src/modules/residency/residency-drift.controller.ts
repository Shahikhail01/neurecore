/**
 * Residency + Drift — Controller.
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
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import {
  ResidencyEnforcementMode,
  TenantRegion,
} from '@prisma/client';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  ResidencyService,
  DriftService,
} from './residency-drift.service';

class SetRegionDto {
  @IsString() tenantId!: string;
  @IsEnum(TenantRegion) region!: TenantRegion;
  @IsEnum(ResidencyEnforcementMode) @IsOptional() enforcementMode?: ResidencyEnforcementMode;
  @IsObject() @IsOptional() overrides?: Record<string, unknown>;
}

class EnforceDto {
  @IsString() tenantId!: string;
  @IsString() targetRegion!: string;
  @IsString() dataPlane!: string;
}

class RecordBaselineDto {
  @IsString() @IsOptional() tenantId?: string;
  @IsString() modelId!: string;
  @IsObject() features!: Record<string, { mean: number; stdDev: number; count: number }>;
  @IsOptional() sampleSize?: number;
}

class RunBacktestDto {
  @IsString() @IsOptional() tenantId?: string;
  @IsString() modelId!: string;
  @IsObject() features!: Record<string, { mean: number; stdDev: number; count: number }>;
}

@Controller({ path: 'residency', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.AUDITOR,
  UserRole.PLATFORM_ADMIN,
  UserRole.SUPER_ADMIN,
)
export class ResidencyController {
  constructor(
    private readonly residency: ResidencyService,
    private readonly drift: DriftService,
  ) {}

  // ─── Regions ──────────────────────────────────────────

  @Get('regions')
  listRegions() {
    return this.residency.listRegions();
  }

  @Get('tenant')
  listTenantRegions(@Query('tenantId') tenantId: string) {
    return this.residency.list(tenantId);
  }

  @Post('tenant/region')
  @HttpCode(HttpStatus.OK)
  setTenantRegion(@Body() dto: SetRegionDto) {
    return this.residency.setRegion(dto);
  }

  @Get('tenant/region/resolve')
  resolveTenantRegion(@Query('tenantId') tenantId: string) {
    return this.residency.resolve(tenantId);
  }

  @Post('enforce')
  @HttpCode(HttpStatus.OK)
  async enforce(@Body() dto: EnforceDto) {
    await this.residency.enforce({
      tenantId: dto.tenantId,
      targetRegion: dto.targetRegion as TenantRegion,
      dataPlane: dto.dataPlane,
    });
    return { allowed: true };
  }

  // ─── Drift ────────────────────────────────────────────

  @Post('drift/baseline')
  @HttpCode(HttpStatus.CREATED)
  recordBaseline(@Body() dto: RecordBaselineDto) {
    return this.drift.recordBaseline({
      tenantId: dto.tenantId,
      modelId: dto.modelId,
      features: dto.features,
      sampleSize: dto.sampleSize ?? Object.keys(dto.features).length,
    });
  }

  @Post('drift/backtest')
  @HttpCode(HttpStatus.OK)
  runBacktest(@Body() dto: RunBacktestDto) {
    return this.drift.runBacktest({
      tenantId: dto.tenantId,
      modelId: dto.modelId,
      features: dto.features,
    });
  }

  @Get('drift/evaluations')
  listEvaluations(
    @Query('tenantId') tenantId?: string,
    @Query('modelId') modelId?: string,
  ) {
    return this.drift.listEvaluations({ tenantId, modelId });
  }
}
