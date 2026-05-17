/**
 * ProtectedRoute Component
 * Wraps routes that require authentication
 * Handles role-based access control
 */

"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUserContext } from "@/user";
import { useRouter } from "next/navigation";
import { Spin } from "antd";

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRoles,
  fallback,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { loading } = useCurrentUserContext();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (requiredRoles && user && !requiredRoles.includes(user.role)) {
      router.push("/unauthorized");
      return;
    }
  }, [isAuthenticated, loading, user, requiredRoles, router]);

  // While the /auth/me request is in-flight, show spinner (not redirect)
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback || null;
  }

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return fallback || null;
  }

  return <>{children}</>;
}
