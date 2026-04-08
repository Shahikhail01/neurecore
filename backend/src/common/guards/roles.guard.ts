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

/**
 * Permission Matrix - What each role can do
 * Used by authorization service
 */
export const ROLE_PERMISSIONS: Record<UserRole, Record<string, string[]>> = {
  [UserRole.ADMIN]: {
    agents: ['create', 'read', 'update', 'delete'],
    tasks: ['create', 'read', 'update', 'delete'],
    approvals: ['create', 'read', 'update', 'delete', 'approve', 'reject'],
    users: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update'],
    reports: ['read', 'export'],
  },
  [UserRole.AGENT_MANAGER]: {
    agents: ['create', 'read', 'update'],
    tasks: ['create', 'read', 'update'],
    approvals: ['read', 'approve', 'reject'],
    reports: ['read'],
  },
  [UserRole.TASK_APPROVER]: {
    tasks: ['read'],
    approvals: ['read', 'approve', 'reject'],
  },
  [UserRole.VIEWER]: {
    agents: ['read'],
    tasks: ['read'],
    approvals: ['read'],
    reports: ['read'],
  },
};

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
  const permissions = ROLE_PERMISSIONS[userRole];

  if (!permissions) {
    return false;
  }

  const resourcePermissions = permissions[resource];

  if (!resourcePermissions) {
    return false;
  }

  return resourcePermissions.includes(action);
}
