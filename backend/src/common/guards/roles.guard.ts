/**
 * Role-Based Access Control Guard
 * Enforces role-based restrictions on endpoints
 * SOLID: Single Responsibility - Role checking only
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../decorators/auth.decorator';
import { AuditLogService } from '../services/audit-log.service';
import {
  hasLegacyPermission,
  LEGACY_ROLE_PERMISSIONS,
} from '../../core/services/legacy-authorization.constants';

/**
 * RolesGuard - Enforces role-based access control
 * Must be used with @Roles() decorator
 *
 * Usage:
 * @Post('agents')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('admin', 'agent_manager')
 * async createAgent() {}
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private auditLogService: AuditLogService,
  ) {}

  /**
   * Check if user's role is in allowed roles
   * @param context Execution context
   * @returns true if role allowed, throws otherwise
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<UserRole[]>(
      'roles',
      context.getHandler(),
    );

    // If no roles defined, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context not found');
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      await this.auditLogService.logSecurityEvent({
        userId: user.userId,
        action: 'AUTHORIZATION_FAILED',
        resource: request.path,
        details: {
          userRole: user.role,
          requiredRoles,
          method: request.method,
        },
        status: 'DENIED',
      });

      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}

export const ROLE_PERMISSIONS = LEGACY_ROLE_PERMISSIONS;

/**
 * Check if user has permission for resource + action
 * @param userRole User's role
 * @param resource Resource name (e.g., 'agents', 'tasks')
 * @param action Action name (e.g., 'create', 'delete')
 * @returns true if permitted, false otherwise
 */
export function hasPermission(
  userRole: UserRole,
  resource: string,
  action: string,
): boolean {
  return hasLegacyPermission(userRole, resource, action);
}
