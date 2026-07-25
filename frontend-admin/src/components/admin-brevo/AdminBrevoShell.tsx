"use client";

import { ReactNode } from "react";
import AdminShell from "@/components/AdminShell";
import { useRequirePlatformAdmin } from "@/auth/hooks/useRequirePlatformAdmin";
import { Toaster } from "sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BREVO_TABS = [
  { id: "overview", label: "Overview", href: "/admin/brevo" },
  { id: "tenants", label: "Tenants", href: "/admin/brevo/tenants" },
  { id: "events", label: "Events", href: "/admin/brevo/events" },
  {
    id: "suppressions",
    label: "Suppressions",
    href: "/admin/brevo/suppressions",
  },
  { id: "settings", label: "Settings", href: "/admin/brevo/settings" },
] as const;

interface Props {
  children: ReactNode;
  /** Optional subtitle under the header. */
  subtitle?: string;
}

export default function AdminBrevoShell({ children, subtitle }: Props) {
  const user = useRequirePlatformAdmin();
  const pathname = usePathname();
  if (!user) return null;

  const activeTab =
    BREVO_TABS.find(
      (tab) =>
        pathname === tab.href ||
        (tab.href !== "/admin/brevo" && pathname.startsWith(tab.href)),
    ) ?? BREVO_TABS[0];

  return (
    <AdminShell user={user}>
      <Toaster position="top-right" richColors />
      <div className="flex flex-col h-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-100">
            Brevo Email Admin
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {subtitle ??
              "Platform-wide Brevo overview — quota, tenants, webhook events, and configuration."}
          </p>
        </div>

        <div className="border-b border-zinc-800 mb-6">
          <nav className="flex gap-1 -mb-px">
            {BREVO_TABS.map((tab) => {
              const isActive =
                pathname === tab.href ||
                (tab.href !== "/admin/brevo" &&
                  pathname.startsWith(tab.href));
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                    isActive
                      ? "border-[color:var(--accent-500)] text-[color:var(--accent-400)]"
                      : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </AdminShell>
  );
}
