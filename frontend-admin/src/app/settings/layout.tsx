"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Toaster } from "sonner";

const SETTINGS_TABS = [
  {
    id: "ai",
    label: "AI Providers",
    href: "/settings/ai",
    icon: "🤖",
    description: "Configure AI models and providers",
  },
  {
    id: "tiers",
    label: "Tenant Tiers",
    href: "/settings/tiers",
    icon: "📊",
    description: "Manage subscription tiers",
  },
  {
    id: "email",
    label: "Email System",
    href: "/settings/email",
    icon: "📧",
    description: "Configure email templates and logs",
  },
  {
    id: "audit",
    label: "Audit Logs",
    href: "/settings/audit",
    icon: "📋",
    description: "View platform activity logs",
  },
  {
    id: "general",
    label: "General",
    href: "/settings/general",
    icon: "⚙️",
    description: "Platform settings",
  },
  {
    id: "integrations",
    label: "Integrations",
    href: "/settings/integrations",
    icon: "🔌",
    description: "Third-party integrations and OAuth",
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;

  // Find active tab based on current pathname
  const activeTab =
    SETTINGS_TABS.find(
      (tab) => pathname === tab.href || pathname.startsWith(tab.href + "/"),
    ) ?? SETTINGS_TABS[0];

  return (
    <AdminShell user={user}>
      <Toaster position="top-right" richColors />
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Configure platform-wide settings and integrations
          </p>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-zinc-800 mb-6">
          <nav className="flex gap-1 -mb-px">
            {SETTINGS_TABS.map((tab) => {
              const isActive =
                pathname === tab.href || pathname.startsWith(tab.href + "/");
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
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </AdminShell>
  );
}
