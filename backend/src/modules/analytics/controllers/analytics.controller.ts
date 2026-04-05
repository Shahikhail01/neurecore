import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  ForbiddenException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { MaturityService } from '../services/maturity.service';
import { NlReportService } from '../services/nl-report.service';
import { CsvExportService } from '../../../shared/services/csv-export.service';
import { ScoreRequestDto } from '../dto/score-request.dto';
import { ForecastRequestDto } from '../dto/forecast-request.dto';
import { AnomalyRequestDto } from '../dto/anomaly-request.dto';
import { EmbedRequestDto } from '../dto/embed-request.dto';
import { NlReportDto } from '../dto/nl-report.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';

/**
 * AnalyticsController
 * SRP: HTTP routing only — no business logic, delegates to AnalyticsService.
 * ISP: each endpoint accepts a minimal, purpose-specific DTO.
 */
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly maturityService: MaturityService,
    private readonly nlReportService: NlReportService,
    private readonly csvExportService: CsvExportService,
  ) {}

  private resolveTenantId(user: JwtPayload, dtoTenantId?: string): string {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!dtoTenantId)
        throw new BadRequestException('tenantId required for SUPER_ADMIN');
      return dtoTenantId;
    }
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return user.tenantId;
  }

  /** GET /v1/analytics/models */
  @Get('models')
  getModels(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.analyticsService.getModels(
      this.resolveTenantId(user, tenantId),
    );
  }

  /** GET /v1/analytics/summary — dashboard KPI summary for tenant */
  @Get('summary')
  async getSummary(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid =
      user.role === UserRole.SUPER_ADMIN && tenantId
        ? tenantId
        : (user.tenantId ?? null);
    if (!tid && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.analyticsService.getSummary(tid);
  }

  /** GET /v1/analytics/report */
  @Get('report')
  getReport(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.analyticsService.getReport(
      this.resolveTenantId(user, tenantId),
    );
  }

  /** GET /v1/analytics/features */
  @Get('features')
  getFeatures(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getFeatureHistory(
      this.resolveTenantId(user, tenantId),
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /** POST /v1/analytics/score */
  @Post('score')
  @HttpCode(HttpStatus.OK)
  score(@CurrentUser() user: JwtPayload, @Body() dto: ScoreRequestDto) {
    return this.analyticsService.score(
      this.resolveTenantId(user, dto.tenantId),
      dto.features,
    );
  }

  /** POST /v1/analytics/forecast */
  @Post('forecast')
  @HttpCode(HttpStatus.OK)
  forecast(@CurrentUser() user: JwtPayload, @Body() dto: ForecastRequestDto) {
    return this.analyticsService.forecast(
      this.resolveTenantId(user, dto.tenantId),
      dto.periods ?? 30,
    );
  }

  /** POST /v1/analytics/anomaly */
  @Post('anomaly')
  @HttpCode(HttpStatus.OK)
  anomaly(@CurrentUser() user: JwtPayload, @Body() dto: AnomalyRequestDto) {
    return this.analyticsService.detectAnomalies(
      this.resolveTenantId(user, dto.tenantId),
      dto.vectors,
    );
  }

  /** POST /v1/analytics/embed */
  @Post('embed')
  @HttpCode(HttpStatus.OK)
  embed(@CurrentUser() user: JwtPayload, @Body() dto: EmbedRequestDto) {
    return this.analyticsService.embed(
      this.resolveTenantId(user, dto.tenantId),
      dto.texts,
    );
  }

  /** GET /v1/analytics/maturity — agent maturity scorecard (Phase 3.1) */
  @Get('maturity')
  getMaturity(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid =
      user.role === UserRole.SUPER_ADMIN && tenantId
        ? tenantId
        : (user.tenantId ?? null);
    if (!tid && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.maturityService.getMaturityReport(tid!);
  }

  /** GET /v1/analytics/export/csv — download analytics report as CSV (Phase 3.2) */
  @Get('export/csv')
  async exportCsv(
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = this.resolveTenantId(user, tenantId);
    const report = (await this.analyticsService.getReport(tid)) as Record<
      string,
      unknown
    >;
    const rows: Record<string, unknown>[] = Array.isArray(report)
      ? (report as Record<string, unknown>[])
      : [report];
    const csv = this.csvExportService.toCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="analytics-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }

  /** POST /v1/analytics/nl-report — generate a report from natural language (Phase 4.2) */
  @Post('nl-report')
  @HttpCode(HttpStatus.OK)
  async nlReport(@CurrentUser() user: JwtPayload, @Body() dto: NlReportDto) {
    const tid = dto.tenantId ?? user.tenantId ?? undefined;
    return this.nlReportService.generateReport(dto.query, tid);
  }
}
