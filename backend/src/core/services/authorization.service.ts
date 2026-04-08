/**
 * Authorization Service
 * Checks permissions and enforces multi-tenancy
 * SOLID: Single Responsibility - Authorization only
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

import { Injectable } from '@nestjs/common';
import { JwtPayload, UserRole } from './auth.service';
import { hasPermission, ROLE_PERMISSIONS } from '../guards/roles.guard';
import { AuditLogService } from './audit-log.service';

/**
 * Field visibility rules (what roles can see what fields)
 */
const FIELD_VISIBILITY: Record<string, UserRole[]> = {
  // cost fields: only admin and agent_manager can see
  'agents.hourlyRate': [UserRole.ADMIN, UserRole.AGENT_MANAGER],
  'agents.totalCostSpent': [UserRole.ADMIN, UserRole.AGENT_MANAGER],
  'tasks.estimatedCost': [UserRole.ADMIN, UserRole.AGENT_MANAGER],
  'tasks.actualCost': [UserRole.ADMIN, UserRole.AGENT_MANAGER],
  'approvals.budgetImpact': [UserRole.ADMIN, UserRole.TASK_APPROVER],

  // Internal notes: only admin
  'agents.internalNotes': [UserRole.ADMIN],
  'tasks.internalNotes': [UserRole.ADMIN],
};

/**
 * AuthorizationService - Permission checking and field access control
 * SOLID:
 * - S: Only authorization concerns
 * - O: Can extend field visibility without changing code
 * - L: Substitutable with IAuthorization interface (future)
 * - I: Uses narrow interfaces (JwtPayload, hasPermission function)
 * - D: Dependencies injected (AuditLogService)
 */
@Injectable()
export class AuthorizationService {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Check if user can perform action on resource
   * @param user JWT payload
   * @param resource Resource name (agents, tasks, approvals)
   * @param action Action (create, read, update, delete)
   * @returns true if allowed, false otherwise
   */
  canPerformAction(
    user: JwtPayload,
    resource: string,
    action: string,
  ): boolean {
    return hasPermission(user.role, resource, action);
  }

  /**
   * Check if user can access tenant data
   * @param user JWT payload
   * @param tenantId Tenant to access
   * @returns true if user belongs to tenant
   */
  canAccessTenant(user: JwtPayload, tenantId: string): boolean {
    return user.tenantId === tenantId;
  }

  /**
   * Get visible fields for user's role
   * Filters out sensitive fields user isn't authorized to see
   * @param user JWT payload
   * @param resource Resource name
   * @returns Array of field names user can see
   */
  getVisibleFields(user: JwtPayload, resource: string): string[] {
    const hiddenFields: string[] = [];

    // Check each field's visibility
    Object.entries(FIELD_VISIBILITY).forEach(([field, allowedRoles]) => {
      if (field.startsWith(resource + '.')) {
        if (!allowedRoles.includes(user.role)) {
          hiddenFields.push(field.split('.')[1]);
        }
      }
    });

    return hiddenFields;
  }

  /**
   * Filter object to remove fields user can't see
   * @param user JWT payload
   * @param resource Resource name
   * @param record Data object
   * @returns Filtered object with hidden fields removed
   */
  filterFieldsByRole(
    user: JwtPayload,
    resource: string,
    record: Record<string, any>,
  ): Record<string, any> {
    const filteredRecord = { ...record };
    const hiddenFields = this.getVisibleFields(user, resource);

    hiddenFields.forEach((field) => {
      delete filteredRecord[field];
    });

    return filteredRecord;
  }

  /**
   * Filter array of records
   * @param user JWT payload
   * @param resource Resource name
   * @param records Array of data objects
   * @returns Array of filtered records
   */
  filterRecordsByRole(
    user: JwtPayload,
    resource: string,
    records: Record<string, any>[],
  ): Record<string, any>[] {
    return records.map((record) =>
      this.filterFieldsByRole(user, resource, record),
    );
  }

  /**
   * Check if user can access specific record
   * Owner can always access own records
   * Admins can access anything in their tenant
   * @param user JWT payload
   * @param resource Resource name
   * @param recordOwnerId Owner of record
   * @returns true if allowed
   */
  canAccessRecord(
    user: JwtPayload,
    resource: string,
    recordOwnerId: string,
  ): boolean {
    // Admin can access anything
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // User can access own records
    if (user.userId === recordOwnerId) {
      return true;
    }

    // Manager can access team members' records
    if (user.role === UserRole.AGENT_MANAGER && resource === 'agents') {
      return true;
    }

    return false;
  }

  /**
   * Get permission matrix for user's role
   * @param user JWT payload
   * @returns Permission object for role
   */
  getRolePermissions(user: JwtPayload): Record<string, string[]> {
    return ROLE_PERMISSIONS[user.role] || {};
  }

  /**
   * Get list of allowed actions for user on resource
   * @param user JWT payload
   * @param resource Resource name
   * @returns Array of allowed actions
   */
  getAllowedActions(user: JwtPayload, resource: string): string[] {
    const permissions = this.getRolePermissions(user);
    return permissions[resource] || [];
  }

  /**
   * Check if user can bulk-delete records
   * Requires admin role
   * @param user JWT payload
   * @returns true only for admin
   */
  canBulkDelete(user: JwtPayload): boolean {
    return user.role === UserRole.ADMIN;
  }

  /**
   * Check if user can export data
   * Requires admin or manager role
   * @param user JWT payload
   * @returns true for admin/manager
   */
  canExportData(user: JwtPayload): boolean {
    return [UserRole.ADMIN, UserRole.AGENT_MANAGER].includes(user.role);
  }

  /**
   * Check if user can modify settings
   * Only admin
   * @param user JWT payload
   * @returns true only for admin
   */
  canModifySettings(user: JwtPayload): boolean {
    return user.role === UserRole.ADMIN;
  }

  /**
   * Check if user can manage users (create, delete)
   * Only admin
   * @param user JWT payload
   * @returns true only for admin
   */
  canManageUsers(user: JwtPayload): boolean {
    return user.role === UserRole.ADMIN;
  }

  /**
   * Check if user can view audit logs
   * Only admin
   * @param user JWT payload
   * @returns true only for admin
   */
  canViewAuditLogs(user: JwtPayload): boolean {
    return user.role === UserRole.ADMIN;
  }

  /**
   * Check if user can view cost reports
   * Admin and manager
   * @param user JWT payload
   * @returns true for admin/manager
   */
  canViewCostReports(user: JwtPayload): boolean {
    return [UserRole.ADMIN, UserRole.AGENT_MANAGER].includes(user.role);
  }
}
