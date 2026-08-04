/**
 * Lead Scoring Calibration — Controller + Service endpoint.
 *
 * Mounted under `/api/v1/analytics/lead-scoring`. Platform-admin only.
 * Used for the certification gate that drives v3 P-5 sign-off.
 */

import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { LeadScoringCalibration } from '../services/lead-scoring-calibration';

@Controller({ path: 'analytics/lead-scoring', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
export class LeadScoringCalibrationController {
  constructor(private readonly calibration: LeadScoringCalibration) {}

  @Get('calibration')
  certify() {
    return this.calibration.certify();
  }
}
