"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Building2, ArrowRight } from "lucide-react";
import type { ProvisioningStatusDto } from "@/types/onboarding.types";
import { ProvisioningProvider } from "@/types/onboarding.types";

const SESSION_DISMISSED_KEY = "wp_banner_dismissed";

interface WorkspaceProvisioningBannerProps {
  status: ProvisioningStatusDto | null;
}

export function WorkspaceProvisioningBanner({
  status,
}: WorkspaceProvisioningBannerProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1";
  });

  // Only render when there is genuinely pending setup
  if (
    !status ||
    !status.hasPendingSetup ||
    status.status !== "PENDING_CONNECT" ||
    dismissed
  ) {
    return null;
  }

  const providerLabel =
    status.provider === ProvisioningProvider.GOOGLE_WORKSPACE
      ? "Google Workspace"
      : status.provider === ProvisioningProvider.MICROSOFT_365
        ? "Microsoft 365"
        : "workspace";

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const handleSetup = () => {
    router.push("/settings?tab=workspace");
  };

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-900/10 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Building2 className="h-4 w-4 flex-shrink-0 text-amber-400" />
        <p className="text-sm text-amber-200 truncate">
          <span className="font-medium">Workspace setup pending</span>
          {" — "}connect your {providerLabel} admin account to provision
          corporate emails
          {status.pendingCount > 0
            ? ` for ${status.pendingCount} team member${status.pendingCount !== 1 ? "s" : ""}`
            : ""}
          .
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleSetup}
          className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-400"
        >
          Set up now
          <ArrowRight className="h-3 w-3" />
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss workspace setup banner"
          className="rounded-md p-1 text-amber-400/60 transition hover:text-amber-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
