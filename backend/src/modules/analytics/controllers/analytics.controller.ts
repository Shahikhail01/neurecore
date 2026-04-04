import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  ForbiddenException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';
import { ScoreRequestDto } from '../dto/score-request.dto';
import { ForecastRequestDto } from '../dto/forecast-request.dto';
import { AnomalyRequestDto } from '../dto/anomaly-request.dto';
import { EmbedRequestDto } from '../dto/embed-request.dto';
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
  constructor(private readonly analyticsService: AnalyticsService) {}

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
}
