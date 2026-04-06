"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useUIPreferencesStore } from "@/shared/stores/uiPreferencesStore";

/**
 * Layout for (authenticated) route group.
 * Provides auth guard without AppShell sidebar, for full-screen experiences
 * like the Creatio-inspired home screen.
 */
export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated, user } = useAuthStore();
  const { theme } = useUIPreferencesStore();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (!user?.tenantId) {
      router.replace("/onboarding");
    }
  }, [_hasHydrated, isAuthenticated, user?.tenantId, router]);

  if (!_hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--surface)]">
        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user?.tenantId) return null;

  return (
    <div
      className={theme !== "light" ? "theme-dark" : "theme-light"}
      style={{ minHeight: "100vh" }}
    >
      {children}
    </div>
  );
}
