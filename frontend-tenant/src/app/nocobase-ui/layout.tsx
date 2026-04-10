"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export default function NocoBaseUILayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated, user } = useAuthStore();

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
      <div className="flex h-screen items-center justify-center bg-[#07070a]">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user?.tenantId) return null;

  return <>{children}</>;
}
