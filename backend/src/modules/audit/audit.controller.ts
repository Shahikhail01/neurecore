import {
  Controller,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditService } from './audit.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

/**
 * AuditController — SRP: exposes audit-log query endpoints only.
 * RBAC: tenant users see their own logs; admins see platform-wide.
 */
@Controller({ path: 'audit-logs', version: '1' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** Platform-wide audit log — super-admin / platform-admin only */
  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.AUDITOR,
  )
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ) {
    return this.auditService.findAll({
      tenantId,
      actor,
      action,
      resource,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: Number(page),
      limit: Number(limit),
    });
  }

  /** Tenant-scoped audit log — owner/admin of that tenant */
  @Get('tenant')
  findForTenant(
    @CurrentUser() user: JwtPayload,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.auditService.findAll({
      tenantId: user.tenantId,
      action,
      resource,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: Number(page),
      limit: Number(limit),
    });
  }

  /** Per-agent audit trail (plan: GET /governance/audit/:agentId) */
  @Get('agent/:agentId')
  findByAgent(
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentUser() user: JwtPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.auditService.findByAgent(agentId, user.tenantId, {
      page: Number(page),
      limit: Number(limit),
    });
  }
}
