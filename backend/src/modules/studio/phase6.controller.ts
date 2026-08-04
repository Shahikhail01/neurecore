/**
 * Phase 6 — Studio runtime controller.
 *
 * Mounted under `/api/v1/phase6`:
 *   • Studio codegen (5.13.6/7/8): /studio/codegen/*
 *   • Component publish gate (5.13.11): /marketplace/publish/*
 *   • Scheduler runner (5.13.17 + 5.14.4): /scheduler/*
 *   • SLA timer (5.4.8 + 5.9.5): /sla/*
 *   • Service ops (5.9.6/7, 5.10.2): /landing-pages/*, /field-work-orders/*, /root-causes/*
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
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole, Prisma, StudioCodegenKind } from '@prisma/client';
import { StudioCodegenService } from './studio-codegen.service';
import { ComponentPublishService } from './component-publish.service';
import { SchedulerRunner } from './scheduler-runner';
import { SlaTimerService } from '../sla/sla-timer.service';
import {
  LandingPageService,
  FieldWorkOrderService,
  RootCauseAnalysisService,
} from '../service-ops/service-ops.service';
import { StudioDashboardService } from './studio-dashboard.service';
import { UserLocaleService } from '../localization/user-locale.service';

class CodegenEnqueueDto {
  @IsString() tenantId!: string;
  @IsString() appId!: string;
  @IsEnum(['PROMPT_TO_APP', 'PROMPT_TO_PAGE', 'PROMPT_TO_PROCESS', 'PROMPT_TO_DATA_MODEL'] as const)
  kind!: 'PROMPT_TO_APP' | 'PROMPT_TO_PAGE' | 'PROMPT_TO_PROCESS' | 'PROMPT_TO_DATA_MODEL';
  @IsString() @Length(1, 4000) prompt!: string;
  @IsString() createdBy!: string;
}

class ComponentSubmitDto {
  @IsString() tenantId!: string;
  @IsString() componentId!: string;
  @IsString() submittedBy!: string;
  @IsString() @IsOptional() notes?: string;
}

class ComponentDecideDto {
  @IsString() reviewerId!: string;
  @IsEnum(['ACTIVE', 'REJECTED'] as const) decision!: 'ACTIVE' | 'REJECTED';
  @IsString() @IsOptional() decisionNotes?: string;
}

class ScheduleCreateDto {
  @IsString() @IsOptional() tenantId?: string;
  @IsString() controlId!: string;
  @IsEnum(['ONE_OFF', 'DAILY', 'WEEKLY', 'MONTHLY'] as const)
  kind!: 'ONE_OFF' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  @IsString() @IsOptional() cron?: string;
}

class SlaOpenDto {
  @IsString() tenantId!: string;
  @IsString() subjectId!: string;
  @IsString() subjectKind!: string;
  @IsString() policy!: string;
  @IsDateString() @IsOptional() openedAt?: string;
}

class SlaResolveDto {
  @IsString() tenantId!: string;
  @IsString() resolution!: string;
}

class LandingPageDto {
  @IsString() tenantId!: string;
  @IsString() @Length(1, 64) slug!: string;
  @IsString() @Length(1, 120) displayName!: string;
  @IsObject() @IsOptional() content?: Record<string, unknown>;
}

class FieldWorkOrderDto {
  @IsString() tenantId!: string;
  @IsString() @IsOptional() caseId?: string;
  @IsString() @IsOptional() assigneeId?: string;
  @IsArray() @IsOptional() requiredSkills?: string[];
  @IsDateString() @IsOptional() scheduledFor?: string;
  @IsNumber() @IsOptional() durationMin?: number;
  @IsNumber() @Min(-90) @Max(90) @IsOptional() latitude?: number;
  @IsNumber() @Min(-180) @Max(180) @IsOptional() longitude?: number;
  @IsString() @IsOptional() notes?: string;
}

class RootCauseDto {
  @IsString() tenantId!: string;
  @IsString() triggerId!: string;
  @IsString() cause!: string;
  @IsNumber() @Min(0) @Max(1) confidence!: number;
  @IsArray() @IsOptional() caseIds?: string[];
  @IsArray() @IsOptional() remediation?: unknown[];
}

class DashboardDto {
  @IsString() tenantId!: string;
  @IsString() @Length(1, 64) slug!: string;
  @IsString() @Length(1, 120) displayName!: string;
  @IsObject() @IsOptional() layout?: Record<string, unknown>;
}

class DashboardTileComputeDto {
  @IsString() tenantId!: string;
  @IsString() dataSource!: string;
  @IsObject() @IsOptional() filters?: Record<string, unknown>;
  @IsObject() @IsOptional() options?: Record<string, unknown>;
}

class UserLocaleDto {
  @IsString() userId!: string;
  @IsString() tenantId!: string;
  @IsString() @Length(2, 12) localeId!: string;
}

@Controller({ path: 'phase6', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.AUDITOR,
  UserRole.PLATFORM_ADMIN,
  UserRole.SUPER_ADMIN,
)
export class StudioRuntimeController {
  constructor(
    private readonly codegen: StudioCodegenService,
    private readonly publish: ComponentPublishService,
    private readonly scheduler: SchedulerRunner,
    private readonly sla: SlaTimerService,
    private readonly landing: LandingPageService,
    private readonly fwo: FieldWorkOrderService,
    private readonly rca: RootCauseAnalysisService,
    private readonly dashboards: StudioDashboardService,
    private readonly userLocale: UserLocaleService,
  ) {}

  // ─── Studio codegen (5.13.6/7/8) ──────────────────────────────

  @Get('studio/codegen/templates')
  listTemplates() {
    return this.codegen.listTemplates();
  }

  @Post('studio/codegen/jobs')
  @HttpCode(HttpStatus.CREATED)
  enqueueJob(@Body() dto: CodegenEnqueueDto) {
    return this.codegen.enqueueJob({
      ...dto,
      kind: dto.kind as unknown as StudioCodegenKind,
    });
  }

  @Get('studio/codegen/jobs')
  listJobs(@Query('tenantId') tenantId: string, @Query('appId') appId?: string) {
    return this.codegen.listJobs(tenantId, appId);
  }

  @Post('studio/codegen/jobs/:id/run')
  @HttpCode(HttpStatus.OK)
  async runJob(
    @Query('tenantId') tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.codegen.runJob(tenantId, id);
    return this.codegen.findJob(tenantId, id);
  }

  // ─── Marketplace publish (5.13.11) ───────────────────────────

  @Post('marketplace/submit')
  @HttpCode(HttpStatus.CREATED)
  submit(@Body() dto: ComponentSubmitDto) {
    return this.publish.submit(dto);
  }

  @Get('marketplace/pending')
  pending() {
    return this.publish.listPendingReview();
  }

  @Post('marketplace/decide/:id')
  @HttpCode(HttpStatus.OK)
  decide(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ComponentDecideDto) {
    return this.publish.decide({
      requestId: id,
      reviewerId: dto.reviewerId,
      decision: dto.decision,
      decisionNotes: dto.decisionNotes,
    });
  }

  // ─── Scheduler (5.13.17 + 5.14.4) ────────────────────────────

  @Post('scheduler/tick')
  @HttpCode(HttpStatus.OK)
  async tick() {
    return this.scheduler.tick();
  }

  @Post('scheduler/schedules')
  @HttpCode(HttpStatus.CREATED)
  createSchedule(@Body() dto: ScheduleCreateDto) {
    return this.scheduler.createSchedule({
      tenantId: dto.tenantId,
      controlId: dto.controlId,
      kind: dto.kind,
      cron: dto.cron,
    });
  }

  @Get('scheduler/schedules')
  listSchedules(@Query('tenantId') tenantId?: string) {
    return this.scheduler.listSchedules(tenantId);
  }

  // ─── SLA (5.4.8 + 5.9.5) ────────────────────────────────────

  @Get('sla/policies')
  policies() {
    return this.sla.listPolicies();
  }

  @Post('sla/open')
  @HttpCode(HttpStatus.CREATED)
  openSla(@Body() dto: SlaOpenDto) {
    return this.sla.open({
      tenantId: dto.tenantId,
      subjectId: dto.subjectId,
      subjectKind: dto.subjectKind,
      policy: dto.policy,
      openedAt: dto.openedAt ? new Date(dto.openedAt) : undefined,
    });
  }

  @Post('sla/escalate-overdue')
  @HttpCode(HttpStatus.OK)
  escalateOverdue() {
    return this.sla.escalateOverdue();
  }

  @Patch('sla/:id/resolve')
  @HttpCode(HttpStatus.OK)
  resolveSla(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: SlaResolveDto) {
    return this.sla.resolve({
      tenantId: dto.tenantId,
      id,
      resolution: dto.resolution,
    });
  }

  @Get('sla')
  listSla(@Query('tenantId') tenantId: string, @Query('status') status?: string) {
    return this.sla.list(tenantId, status);
  }

  // ─── Service ops (5.9.6/7, 5.10.2) ──────────────────────────

  @Get('landing-pages')
  listLanding(@Query('tenantId') tenantId: string) {
    return this.landing.list(tenantId);
  }

  @Post('landing-pages')
  @HttpCode(HttpStatus.CREATED)
  createLanding(@Body() dto: LandingPageDto) {
    return this.landing.create({
      ...dto,
      content: (dto.content ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  @Post('landing-pages/:id/publish')
  @HttpCode(HttpStatus.OK)
  publishLanding(
    @Query('tenantId') tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.landing.publish(tenantId, id);
  }

  @Get('field-work-orders')
  listFwo(
    @Query('tenantId') tenantId: string,
    @Query('status') status?: string,
  ) {
    return this.fwo.list(tenantId, status as never);
  }

  @Post('field-work-orders')
  @HttpCode(HttpStatus.CREATED)
  createFwo(@Body() dto: FieldWorkOrderDto) {
    return this.fwo.create({
      ...dto,
      scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
    });
  }

  @Post('field-work-orders/:id/dispatch')
  @HttpCode(HttpStatus.OK)
  dispatchFwo(
    @Query('tenantId') tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { assigneeId: string },
  ) {
    return this.fwo.dispatch(tenantId, id, body.assigneeId);
  }

  @Get('root-causes')
  listRca(@Query('tenantId') tenantId: string) {
    return this.rca.list(tenantId);
  }

  @Post('root-causes')
  @HttpCode(HttpStatus.CREATED)
  recordRca(@Body() dto: RootCauseDto) {
    return this.rca.record({
      ...dto,
      remediation: (dto.remediation ?? []) as unknown as Prisma.InputJsonValue,
    });
  }

  // ─── Dashboards (5.13.18) ─────────────────────────────────────

  @Get('dashboards')
  listDashboards(@Query('tenantId') tenantId: string) {
    return this.dashboards.list(tenantId);
  }

  @Post('dashboards')
  @HttpCode(HttpStatus.CREATED)
  createDashboard(@Body() dto: DashboardDto) {
    return this.dashboards.create({
      ...dto,
      layout: (dto.layout ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  @Post('dashboards/compute')
  @HttpCode(HttpStatus.OK)
  async computeDashboardTile(@Body() dto: DashboardTileComputeDto) {
    return this.dashboards.computeTile(dto.tenantId, {
      id: 'ad-hoc',
      type: 'kpi',
      title: dto.dataSource,
      dataSource: dto.dataSource,
      filters: dto.filters ?? {},
      options: dto.options ?? {},
    });
  }

  // ─── Per-user locale (5.20.4) ─────────────────────────────────

  @Post('user-locale')
  @HttpCode(HttpStatus.OK)
  async setUserLocale(@Body() dto: UserLocaleDto) {
    await this.userLocale.setUserLocale(dto);
    return this.userLocale.resolve({
      userId: dto.userId,
      tenantId: dto.tenantId,
    });
  }

  @Post('user-locale/clear')
  @HttpCode(HttpStatus.OK)
  clearUserLocale(@Body() dto: UserLocaleDto) {
    return this.userLocale.clearUserLocale(dto);
  }
}
