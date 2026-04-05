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
import { Sidebar } from "@/components/layout/Sidebar";
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

  

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-zinc-100">
      {/* ── Sidebar (extracted) ───────────────────────────────── */}
      <Sidebar navItems={NAV} user={user} pathname={pathname} onLogout={handleLogout} />

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
