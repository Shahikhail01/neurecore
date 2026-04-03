"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/authStore";
import type { AuthUser } from "@/types/auth.types";
import { TopBar, type AutonomyLevel } from "@/components/layout/TopBar";
import { InspectorPanel } from "@/components/layout/InspectorPanel";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { ConversationPanel } from "@/components/chat/ConversationPanel";
import { useActivityStream } from "@/hooks/useActivityStream";
import { registerTenantCommands } from "@/services/register-commands";
import {
  Inbox,
  ShieldCheck,
  Bot,
  Building2,
  ListTodo,
  Workflow,
  Target,
  BarChart2,
  DollarSign,
  Activity,
  Plug,
  CreditCard,
  Settings,
  ChevronDown,
  LogOut,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// ─── Grouped Navigation ───────────────────────────────────────────────────────
interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: boolean; // show dynamic count badge
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Home",
    items: [
      { label: "AI Office", href: "/dashboard-v2", icon: Sparkles },
      { label: "Inbox", href: "/inbox", icon: Inbox, badge: true },
      {
        label: "Approvals",
        href: "/approvals",
        icon: ShieldCheck,
        badge: true,
      },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "Agents", href: "/agents", icon: Bot },
      { label: "Departments", href: "/departments", icon: Building2 },
    ],
  },
  {
    label: "Work",
    items: [
      { label: "Tasks", href: "/tasks", icon: ListTodo },
      { label: "Workflows", href: "/workflows", icon: Workflow },
      { label: "Goals", href: "/goals", icon: Target },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart2 },
      { label: "Costs", href: "/costs", icon: DollarSign },
      { label: "Activity", href: "/activity", icon: Activity },
    ],
  },
  {
    label: "Configure",
    items: [
      { label: "Connectors", href: "/connectors", icon: Plug },
      { label: "Billing", href: "/billing", icon: CreditCard },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

// Flat list for page title lookup
const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

export default function TenantShell({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const clearUser = useAuthStore((s) => s.clearUser);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [autonomy, setAutonomy] = useState<AutonomyLevel>("assist");

  useActivityStream();

  useEffect(() => {
    return registerTenantCommands(router);
  }, [router]);

  async function handleLogout() {
    await authService.logout();
    clearUser();
    router.push("/login");
  }

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const pageTitle =
    ALL_NAV.find(
      (n) => pathname === n.href || pathname.startsWith(n.href + "/"),
    )?.label ?? "Dashboard";

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-zinc-100">
      {/* ── Left Sidebar ────────────────────────────────────── */}
      <aside className="w-[220px] shrink-0 border-r border-surface-border flex flex-col bg-surface-raised">
        {/* Brand */}
        <div className="px-4 py-4 border-b border-surface-border">
          <div className="flex items-center gap-2">
            {user.tenant?.logoUrl ? (
              <img
                src={user.tenant.logoUrl}
                alt={user.tenant.name}
                className="w-7 h-7 rounded-lg object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {(user.tenant?.name ?? "N").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <span className="text-sm font-bold tracking-wide text-zinc-100 truncate block">
                {user.tenant?.name ?? "NeureCore"}
              </span>
              <div className="text-[10px] text-zinc-500 -mt-0.5">
                {user.tenant?.tier?.name ?? "AI Office"}
              </div>
            </div>
          </div>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {NAV_GROUPS.map((group) => {
            const isCollapsed = collapsedGroups.has(group.label);
            return (
              <div key={group.label}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-400 transition"
                >
                  {group.label}
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                </button>

                {/* Group items */}
                {!isCollapsed && (
                  <div className="space-y-0.5 mt-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active =
                        pathname === item.href ||
                        pathname.startsWith(item.href + "/");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition group ${
                            active
                              ? "bg-violet-600/15 text-violet-300 font-medium border border-violet-500/20"
                              : "text-zinc-400 hover:bg-surface-overlay hover:text-zinc-200 border border-transparent"
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 flex-shrink-0 ${
                              active
                                ? "text-violet-400"
                                : "text-zinc-500 group-hover:text-zinc-400"
                            }`}
                          />
                          <span className="flex-1 truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-3 border-t border-surface-border">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-300">
              {user.firstName?.[0]}
              {user.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-300 font-medium truncate">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-[10px] text-zinc-500 truncate">
                {user.email}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-xs text-zinc-500 hover:bg-surface-overlay hover:text-zinc-300 transition"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Content column ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          title={pageTitle}
          user={user}
          autonomy={autonomy}
          onAutonomyChange={setAutonomy}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {/* ── Portals (rendered once at root) ─────────────────── */}
      <InspectorPanel />
      <CommandPalette />
      <ConversationPanel />
    </div>
  );
}
