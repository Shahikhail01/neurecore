/**
 * Compliance Posture Center — Controller.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.18.
 *
 * Mounted under `/api/v1/compliance/posture`. Tenant-scoped — the actor
 * must have a real tenantId; the report is computed for that tenant.
 *
 * Solid: SRP — HTTP boundary only.
 */

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '@/modules/auth/interfaces/token.interface';
import { CompliancePostureService } from './compliance-posture.service';
import { COMPLIANCE_STANDARDS } from './compliance-standards.registry';

@Controller({ path: 'compliance/posture', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AUDITOR, UserRole.PLATFORM_ADMIN, UserRole.SUPER_ADMIN)
export class CompliancePostureController {
  constructor(private readonly service: CompliancePostureService) {}

  @Get('standards')
  listStandards() {
    return { data: COMPLIANCE_STANDARDS };
  }

  @Get('report')
  report(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = tenantId ?? user.tenantId;
    if (!tid) {
      throw new Error('tenantId required');
    }
    return this.service.generateReport(tid);
  }

  @Get('standards/:id')
  standardReport(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = tenantId ?? user.tenantId;
    if (!tid) {
      throw new Error('tenantId required');
    }
    return this.service.generateReportForStandard(
      tid,
      id as Parameters<CompliancePostureService['generateReportForStandard']>[1],
    );
  }
}
