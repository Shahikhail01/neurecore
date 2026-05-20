import { UserRole } from './auth.service';

export const LEGACY_ROLE_PERMISSIONS: Record<UserRole, Record<string, string[]>> = {
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

export function hasLegacyPermission(
  userRole: UserRole,
  resource: string,
  action: string,
): boolean {
  const permissions = LEGACY_ROLE_PERMISSIONS[userRole];

  if (!permissions) {
    return false;
  }

  const resourcePermissions = permissions[resource];

  if (!resourcePermissions) {
    return false;
  }

  return resourcePermissions.includes(action);
}