/**
 * useAuthGuard Hook
 * Provides granular role-based access control
 */

"use client";

import { useCallback } from "react";
import { useAuth } from "./useAuth";

export type UserRole = "admin" | "manager" | "agent" | "viewer";

export interface AuthGuardOptions {
  requiredRoles?: UserRole[];
  requireTenant?: boolean;
}

export function useAuthGuard() {
  const { user, isAuthenticated } = useAuth();

  /**
   * Check if user has a specific role
   */
  const hasRole = useCallback(
    (role: UserRole): boolean => {
      if (!isAuthenticated || !user) return false;
      return user.role === role;
    },
    [user, isAuthenticated],
  );

  /**
   * Check if user has any of the provided roles
   */
  const hasAnyRole = useCallback(
    (roles: UserRole[]): boolean => {
      if (!isAuthenticated || !user) return false;
      return roles.includes(user.role as UserRole);
    },
    [user, isAuthenticated],
  );

  /**
   * Check if user has all provided roles (usually just 1 role per user, so this checks if they have the role)
   */
  const hasAllRoles = useCallback(
    (roles: UserRole[]): boolean => {
      if (!isAuthenticated || !user) return false;
      return roles.includes(user.role as UserRole);
    },
    [user, isAuthenticated],
  );

  /**
   * Granular permission check
   */
  const canAccess = useCallback(
    (resource: string, action: string): boolean => {
      if (!isAuthenticated || !user) return false;

      const permissions: Record<UserRole, Set<string>> = {
        admin: new Set([
          "agents:read",
          "agents:create",
          "agents:update",
          "agents:delete",
          "tasks:read",
          "tasks:create",
          "tasks:update",
          "tasks:delete",
          "approvals:read",
          "approvals:create",
          "approvals:approve",
          "approvals:reject",
          "audit:read",
          "settings:read",
          "settings:update",
        ]),
        manager: new Set([
          "agents:read",
          "agents:create",
          "agents:update",
          "tasks:read",
          "tasks:create",
          "tasks:update",
          "approvals:read",
          "approvals:approve",
          "audit:read",
        ]),
        agent: new Set([
          "agents:read",
          "tasks:read",
          "tasks:update",
          "approvals:read",
          "settings:read",
          "settings:update",
        ]),
        viewer: new Set(["agents:read", "tasks:read", "approvals:read"]),
      };

      const userPermissions = permissions[user.role as UserRole] || new Set();
      return userPermissions.has(`${resource}:${action}`);
    },
    [user, isAuthenticated],
  );

  /**
   * Check if user is admin
   */
  const isAdmin = useCallback(() => {
    return hasRole("admin");
  }, [hasRole]);

  /**
   * Check if user is manager or higher
   */
  const isManagerOrHigher = useCallback(() => {
    return hasAnyRole(["admin", "manager"]);
  }, [hasAnyRole]);

  /**
   * Get user's permission level (0-3, where 3 is admin)
   */
  const getPermissionLevel = useCallback((): number => {
    if (!isAuthenticated || !user) return 0;
    const levels: Record<UserRole, number> = {
      viewer: 0,
      agent: 1,
      manager: 2,
      admin: 3,
    };
    return levels[user.role as UserRole] || 0;
  }, [user, isAuthenticated]);

  return {
    hasRole,
    hasAnyRole,
    hasAllRoles,
    canAccess,
    isAdmin,
    isManagerOrHigher,
    getPermissionLevel,
  };
}
