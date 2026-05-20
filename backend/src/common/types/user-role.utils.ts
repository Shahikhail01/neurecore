import { UserRole } from '@prisma/client';

export const PLATFORM_ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
];

export const PLATFORM_OPERATOR_ROLES: readonly UserRole[] = [
  ...PLATFORM_ADMIN_ROLES,
  UserRole.SUPPORT,
];

export const PLATFORM_AUDITOR_ROLES: readonly UserRole[] = [
  ...PLATFORM_ADMIN_ROLES,
  UserRole.SECURITY_OFFICER,
  UserRole.SUPPORT,
];

export const TENANT_ADMIN_ROLES: readonly UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
];

export function hasRole(
  role: UserRole | string | null | undefined,
  allowedRoles: readonly UserRole[],
): boolean {
  return (
    role !== undefined &&
    role !== null &&
    allowedRoles.includes(role as UserRole)
  );
}

export function isPlatformAdminRole(
  role: UserRole | string | null | undefined,
): boolean {
  return hasRole(role, PLATFORM_ADMIN_ROLES);
}

export function isPlatformOperatorRole(
  role: UserRole | string | null | undefined,
): boolean {
  return hasRole(role, PLATFORM_OPERATOR_ROLES);
}

export function isPlatformAuditorRole(
  role: UserRole | string | null | undefined,
): boolean {
  return hasRole(role, PLATFORM_AUDITOR_ROLES);
}

export function isTenantAdminRole(
  role: UserRole | string | null | undefined,
): boolean {
  return hasRole(role, TENANT_ADMIN_ROLES);
}
