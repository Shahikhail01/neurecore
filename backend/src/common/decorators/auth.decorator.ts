/**
 * Custom Decorators for Authentication
 * Provides @CurrentUser() and @Roles() decorators
 * SOLID: Interface Segregation - One decorator per concern
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { JwtPayload, UserRole } from '../services/auth.service';

/**
 * @CurrentUser() decorator
 * Injects user payload from JWT into controller parameter
 *
 * Usage:
 * @Post('agents')
 * async createAgent(@CurrentUser() user: JwtPayload) {
 *   // user is automatically injected
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: undefined, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * @CurrentTenantId() decorator
 * Injects tenant ID from JWT into controller parameter
 *
 * Usage:
 * @Get('agents')
 * async getAgents(@CurrentTenantId() tenantId: string) {
 *   // Returns agents only for this tenant
 * }
 */
export const CurrentTenantId = createParamDecorator(
  (data: undefined, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest();
    return request.tenantId;
  },
);

/**
 * @Roles() decorator
 * Marks which roles can access an endpoint
 * Must be paired with RolesGuard
 *
 * Usage:
 * @Post('agents')
 * @Roles('admin', 'agent_manager')
 * async createAgent() {
 *   // Only admin or agent_manager can access
 * }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

/**
 * @Public() decorator
 * Marks endpoint as public (no auth required)
 * Must be paired with JwtAuthGuard
 *
 * Usage:
 * @Post('auth/login')
 * @Public()
 * async login() {
 *   // No auth required
 * }
 */
export const Public = () => SetMetadata('isPublic', true);

/**
 * @AuditLog() decorator
 * Marks endpoint for automatic audit logging
 *
 * Usage:
 * @Post('agents')
 * @AuditLog('CREATE_AGENT')
 * async createAgent() {
 *   // Automatically logged
 * }
 */
export const AuditLog = (action: string) => SetMetadata('auditAction', action);

/**
 * @RequireTenantAccess() decorator
 * Verifies user has access to requested tenant
 *
 * Usage:
 * @Get(':tenantId/agents')
 * @RequireTenantAccess()
 * async getAgents(@Param('tenantId') tenantId: string) {
 *   // Only accessible if user belongs to tenantId
 * }
 */
export const RequireTenantAccess = () =>
  SetMetadata('requireTenantAccess', true);
