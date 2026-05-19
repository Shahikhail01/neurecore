"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/authStore";
import type { AuthUser } from "@/types/auth.types";
import { TopBar } from "@/components/layout/TopBar";
import { ActivityStream } from "@/components/layout/ActivityStream";
import { InspectorPanel } from "@/components/layout/InspectorPanel";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { ConversationPanel } from "@/components/chat/ConversationPanel";
import { registerAdminCommands } from "@/services/register-commands";

const NAV = [
  { label: "Overview", href: "/overview", icon: "◈", group: "platform" },
  { label: "Tenants", href: "/tenants", icon: "⬟", group: "platform" },
  { label: "Users", href: "/users", icon: "◫", group: "platform" },
  // ── Library ──────────────────────────────────────────
  {
    label: "Agent Templates",
    href: "/agent-templates",
    icon: "◈",
    group: "library",
  },
  {
    label: "Dept Templates",
    href: "/dept-templates",
    icon: "⬟",
    group: "library",
  },
  {
    label: "Tier Templates",
    href: "/tier-templates",
    icon: "⬡",
    group: "library",
  },
  // ── Live Fleet ───────────────────────────────────────
  { label: "Agent Fleet", href: "/agents", icon: "◈", group: "fleet" },
  // ── Intelligence ─────────────────────────────────────
  { label: "Models", href: "/models", icon: "⬡", group: "intelligence" },
  { label: "Brain Map", href: "/brain", icon: "⬡", group: "intelligence" },
  { label: "Strategy", href: "/strategy", icon: "◈", group: "intelligence" },
  // ── Control ──────────────────────────────────────────
  { label: "Monitoring", href: "/monitoring", icon: "◻", group: "control" },
  { label: "Security", href: "/security", icon: "◌", group: "control" },
  { label: "Connectors", href: "/connectors", icon: "⬟", group: "control" },
  { label: "Billing", href: "/billing", icon: "⬡", group: "control" },
  {
    label: "Infrastructure",
    href: "/infrastructure",
    icon: "◈",
    group: "control",
  },
  { label: "Audit Logs", href: "/audit", icon: "◫", group: "control" },
  // ── Settings ─────────────────────────────────────────
  { label: "Settings", href: "/settings", icon: "⚙", group: "settings" },
];

export default function AdminShell({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const clearUser = useAuthStore((s) => s.clearUser);

  async function handleLogout() {
    await authService.logout();
    clearUser();
    router.push("/login");
  }

  useEffect(() => {
    return registerAdminCommands(router);
  }, [router]);

  const pageTitle =
    NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
      ?.label ?? "Overview";

  const GROUP_LABELS: Record<string, string> = {
    platform: "Platform",
    library: "Library",
    fleet: "Fleet",
    intelligence: "Intelligence",
    control: "Control",
    settings: "Settings",
  };

  // Render nav with group headings
  const rendered: React.ReactNode[] = [];
  let lastGroup = "";
  for (const item of NAV) {
    if (item.group !== lastGroup) {
      rendered.push(
        <div
          key={`grp-${item.group}`}
          className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 select-none"
        >
          {GROUP_LABELS[item.group] ?? item.group}
        </div>,
      );
      lastGroup = item.group;
    }
    const active =
      pathname === item.href || pathname.startsWith(item.href + "/");
    rendered.push(
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
          active
            ? "bg-indigo-600 text-white font-medium"
            : "text-zinc-400 hover:bg-surface-overlay hover:text-white"
        }`}
      >
        <span className="text-xs opacity-70">{item.icon}</span>
        {item.label}
      </Link>,
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-zinc-100">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 border-r border-surface-border flex flex-col bg-surface-raised">
        <div className="px-5 py-4 border-b border-surface-border">
          <span className="text-sm font-bold tracking-widest text-indigo-400 uppercase">
            NeureCore
          </span>
          <div className="text-xs text-zinc-500 mt-0.5">Admin Console</div>
        </div>

        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto">
          {rendered}
        </nav>

        <div className="px-4 py-4 border-t border-surface-border">
          <div className="text-xs text-zinc-400 font-medium truncate mb-0.5">
            {user.firstName} {user.lastName}
          </div>
          <div className="text-xs text-zinc-500 truncate mb-2">
            {user.email}
          </div>
          <span className="inline-block rounded-full bg-indigo-900 text-indigo-300 text-xs px-2 py-0.5 font-medium mb-3">
            {user.role}
          </span>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-surface-border px-3 py-1.5 text-xs text-zinc-400 hover:bg-surface-overlay hover:text-white transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Content column ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={pageTitle} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
        <ActivityStream />
      </div>

      {/* ── Portals ─────────────────────────────────────────── */}
      <InspectorPanel />
      <CommandPalette />
      <ConversationPanel />
    </div>
  );
}
