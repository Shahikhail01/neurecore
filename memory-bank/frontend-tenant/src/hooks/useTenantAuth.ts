"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import type { AuthUser } from "@/types/auth.types";

/** Tenant roles that may access the portal */
const TENANT_ROLES = ["OWNER", "ADMIN", "USER", "AUDITOR"];

/**
 * Guards all tenant portal pages.
 * Waits for Zustand persist hydration before checking auth state,
 * preventing false redirects to /login on page refresh.
 * Returns the authenticated user, or null while loading/redirecting.
 */
export function useTenantAuth(): AuthUser | null {
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user || !TENANT_ROLES.includes(user.role)) {
      router.replace("/login");
    } else if (!user.tenantId) {
      // User is authenticated but has no tenant - redirect to onboarding
      router.replace("/onboarding");
    }
  }, [user, hasHydrated, router]);

  if (!hasHydrated) return null;
  return user && TENANT_ROLES.includes(user.role) ? user : null;
}
