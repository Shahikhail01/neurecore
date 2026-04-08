/**
 * AdvancedProtectedRoute Component
 * Advanced route protection with granular permission checking
 */

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Spin, Result } from "antd";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGuard, UserRole } from "@/hooks/useAuthGuard";

interface AdvancedProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  requiredPermissions?: { resource: string; action: string }[];
  fallback?: React.ReactNode;
  requireAny?: boolean; // If true, user needs ANY of the roles/permissions. If false, needs ALL
}

export function AdvancedProtectedRoute({
  children,
  requiredRoles,
  requiredPermissions,
  fallback,
  requireAny = true,
}: AdvancedProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { hasAnyRole, hasAllRoles, canAccess } = useAuthGuard();

  // Still loading auth state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    router.push("/login");
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Redirecting to login..." />
      </div>
    );
  }

  // Check roles
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requireAny
      ? hasAnyRole(requiredRoles)
      : hasAllRoles(requiredRoles);

    if (!hasRequiredRole) {
      return (
        fallback || (
          <Result
            status="403"
            title="Access Denied"
            subTitle="You do not have permission to access this resource."
            extra={
              <button
                onClick={() => router.push("/dashboard")}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Back to Dashboard
              </button>
            }
          />
        )
      );
    }
  }

  // Check permissions
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(
      ({ resource, action }) => canAccess(resource, action),
    );

    if (!hasAllPermissions) {
      return (
        fallback || (
          <Result
            status="403"
            title="Access Denied"
            subTitle="You do not have the required permissions for this action."
            extra={
              <button
                onClick={() => router.push("/dashboard")}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Back to Dashboard
              </button>
            }
          />
        )
      );
    }
  }

  return <>{children}</>;
}
