/**
 * Sales Outreach Orchestrator — Controller.
 */

import {
  Body,
  Controller,
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
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalPolicyKind } from '@prisma/client';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SalesOutreachOrchestrator } from './sales-outreach-orchestrator.service';

class OutreachStepDto {
  @IsString() channelKind!: string;
  @IsString() actionName!: string;
  @IsInt() @Min(1) @Max(5) riskTier!: number;
  @IsInt() @Min(0) @IsOptional() delayMs?: number;
}

class ScheduleDto {
  @IsString() tenantId!: string;
  @IsString() campaignId!: string;
  @IsString() contactId!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutreachStepDto)
  steps!: OutreachStepDto[];
  @IsEnum(ApprovalPolicyKind) @IsOptional() policyKind?: ApprovalPolicyKind;
}

class MarkSentDto {
  @IsString() providerId?: string;
}

class MarkFailedDto {
  @IsString() errorMessage!: string;
}

class EnvConfigDto {
  @IsString() tenantId!: string;
  @IsString() environmentId!: string;
  @IsString() @IsOptional() pipelineId?: string;
  @IsOptional() destructiveAllowed?: boolean;
  @IsOptional() productionAllowed?: boolean;
}

class MobileSessionDto {
  @IsString() tenantId!: string;
  @IsString() connectionId!: string;
  @IsString() userId!: string;
  @IsOptional() latitude?: number;
  @IsOptional() longitude?: number;
}

@Controller({ path: 'sales-outreach', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SUPER_ADMIN,
)
export class SalesOutreachController {
  constructor(private readonly orchestrator: SalesOutreachOrchestrator) {}

  @Post('policies/seed')
  @HttpCode(HttpStatus.OK)
  async seedPolicies(@Body() body: { tenantId: string }) {
    const created = await this.orchestrator.ensureOobPolicies(body.tenantId);
    return { created };
  }

  @Get('policies')
  listPolicies(@Query('tenantId') tenantId: string) {
    return this.orchestrator.listPolicies(tenantId);
  }

  @Post('schedule')
  @HttpCode(HttpStatus.CREATED)
  schedule(@Body() dto: ScheduleDto) {
    return this.orchestrator.schedule(dto);
  }

  @Get('runs')
  listRuns(@Query('tenantId') tenantId: string, @Query('campaignId') campaignId?: string) {
    return this.orchestrator.listRuns(tenantId, campaignId);
  }

  @Post('runs/:id/mark-sent')
  @HttpCode(HttpStatus.OK)
  markSent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: MarkSentDto,
  ) {
    return this.orchestrator.markSent(id, body.providerId);
  }

  @Post('runs/:id/mark-failed')
  @HttpCode(HttpStatus.OK)
  markFailed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: MarkFailedDto,
  ) {
    return this.orchestrator.markFailed(id, body.errorMessage);
  }

  // ─── ALM environment config ─────────────────────────────

  @Post('env-config')
  @HttpCode(HttpStatus.OK)
  upsertEnvConfig(@Body() dto: EnvConfigDto) {
    return this.orchestrator.upsertEnvironmentConfig({
      tenantId: dto.tenantId,
      environmentId: dto.environmentId,
      pipelineId: dto.pipelineId,
      destructiveAllowed: dto.destructiveAllowed,
      productionAllowed: dto.productionAllowed,
    });
  }

  @Get('env-config')
  listEnvConfigs(@Query('tenantId') tenantId: string) {
    return this.orchestrator.listEnvironmentConfigs(tenantId);
  }

  // ─── Mobile omnichannel session ──────────────────────

  @Post('mobile-session')
  @HttpCode(HttpStatus.OK)
  recordMobile(@Body() dto: MobileSessionDto) {
    return this.orchestrator.recordMobileSession(dto);
  }

  @Get('mobile-sessions')
  listMobile(@Query('tenantId') tenantId: string) {
    return this.orchestrator.listMobileSessions(tenantId);
  }
}
