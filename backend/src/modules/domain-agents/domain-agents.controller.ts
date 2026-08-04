/**
 * Domain Agents — Controller.
 *
 * Mounted under `/api/v1/agents`:
 *   • GET    /api/v1/agents/definitions         — list platform definitions
 *   • POST   /api/v1/agents/seed               — platform admin: seed OOB definitions
 *   • POST   /api/v1/agents/seed-for-tenant    — tenant admin: enable OOB for tenant
 *   • GET    /api/v1/agents/tenant             — list tenant-side state (definitions + overrides)
 *   • PATCH  /api/v1/agents/tenant/:kind       — enable / disable / override risk tier
 *   • GET    /api/v1/agents/executions         — list executions
 *   • POST   /api/v1/agents/executions         — start execution
 *
 * Solid: SRP — HTTP boundary only.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { DomainAgentKind } from '@prisma/client';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '@/modules/auth/interfaces/token.interface';
import { DomainAgentService } from './domain-agents.service';

class SeedForTenantDto {
  @IsString()
  tenantId!: string;
}

class SetTenantBindingDto {
  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  riskTierOverride?: number | null;

  @IsString()
  @IsOptional()
  departmentId?: string | null;
}

class StartExecutionDto {
  @IsString()
  tenantId!: string;

  @IsEnum(DomainAgentKind)
  kind!: DomainAgentKind;

  @IsString()
  @IsOptional()
  actorKind?: 'user' | 'twin' | 'system';

  @IsString()
  @IsOptional()
  triggerSource?: 'manual' | 'schedule' | 'approval' | 'event';

  @IsObject()
  @IsOptional()
  inputs?: Record<string, unknown>;
}

@Controller({ path: 'agents', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.AUDITOR,
  UserRole.PLATFORM_ADMIN,
  UserRole.SUPER_ADMIN,
)
export class DomainAgentsController {
  constructor(private readonly service: DomainAgentService) {}

  @Get('definitions')
  listDefinitions(@Query('domain') domain?: string) {
    return this.service.listPlatformDefinitions({ domain });
  }

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  seedPlatform() {
    return this.service.seedPlatformDefinitions();
  }

  @Post('seed-for-tenant')
  @HttpCode(HttpStatus.OK)
  seedForTenant(@Body() dto: SeedForTenantDto) {
    return this.service.seedPlatformDefinitionsForTenant(dto.tenantId);
  }

  @Get('tenant')
  listForTenant(@Query('tenantId') tenantId: string) {
    return this.service.listForTenant(tenantId);
  }

  @Patch('tenant/:kind')
  async setBinding(
    @CurrentUser() user: JwtPayload,
    @Param('kind') kind: string,
    @Body() dto: SetTenantBindingDto,
    @Query('tenantId') tenantId: string,
  ) {
    return this.service.setTenantBinding({
      tenantId,
      kind: kind as DomainAgentKind,
      enabled: dto.enabled,
      riskTierOverride: dto.riskTierOverride ?? null,
      departmentId: dto.departmentId ?? null,
      actorRoles: [user.role],
    });
  }

  @Get('executions')
  listExecutions(
    @Query('tenantId') tenantId: string,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.service.listExecutions({
      tenantId,
      kind: (kind ?? undefined) as DomainAgentKind | undefined,
      status,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Post('executions')
  @HttpCode(HttpStatus.CREATED)
  startExecution(@Body() dto: StartExecutionDto) {
    return this.service.startExecution({
      tenantId: dto.tenantId,
      kind: dto.kind,
      actorId: 'system', // overwritten by caller when known; default safe
      actorKind: dto.actorKind ?? 'system',
      triggerSource: dto.triggerSource ?? 'manual',
      inputs: dto.inputs,
    });
  }
}
