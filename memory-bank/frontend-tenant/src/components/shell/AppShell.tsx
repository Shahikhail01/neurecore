"use client";
// ─── AppShell v2 ──────────────────────────────────────────────────────────────
// S — Single Responsibility: layout orchestration only — nav config, keyboard
//     shortcuts, and sidebar collapse. Delegates AI panel, search, and autonomy
//     selector to focused sub-components.
// O — Open/Closed: new nav groups added via NAV_GROUPS constant; never modify
//     the render tree directly.
// D — Dependency Inversion: all state via store abstractions; no localStorage.

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  GitBranch,
  Bell,
  BarChart3,
  Building2,
  FolderOpen,
  Target,
  Network,
  Activity,
  RefreshCw,
  Plug,
  CreditCard,
  DollarSign,
  TrendingUp,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { useAuthStore } from "@/stores/authStore";
import { useUIPreferencesStore } from "@/shared/stores/uiPreferencesStore";
import { useCommandStore } from "@/stores/commandStore";
import { authService } from "@/services/auth.service";
import { cn } from "@/lib/utils";

import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { GlobalSearchBar } from "./GlobalSearchBar";
import { AutonomyPill } from "./AutonomyPill";
import { RightAIPanel } from "./RightAIPanel";
import { registerTenantCommands } from "@/services/register-commands";

// ─── Navigation config (OCP: add entries here — AppShell never changes) ───────
interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { icon: LayoutDashboard, label: "AI Office", href: "/dashboard" },
      { icon: Bell, label: "Inbox", href: "/inbox" },
      { icon: Activity, label: "Activity", href: "/activity" },
    ],
  },
  {
    label: "Work",
    items: [
      { icon: CheckSquare, label: "Tasks", href: "/tasks" },
      { icon: GitBranch, label: "Workflows", href: "/workflows" },
      { icon: FolderOpen, label: "Projects", href: "/projects" },
      { icon: RefreshCw, label: "Routines", href: "/routines" },
      { icon: Zap, label: "Approvals", href: "/approvals" },
    ],
  },
  {
    label: "Org",
    items: [
      { icon: Users, label: "Team", href: "/agents" },
      { icon: Building2, label: "Departments", href: "/departments" },
      { icon: Network, label: "Org Chart", href: "/org-chart" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { icon: BarChart3, label: "Analytics", href: "/analytics" },
      { icon: Target, label: "Goals", href: "/goals" },
      { icon: TrendingUp, label: "Strategy", href: "/strategy" },
      { icon: DollarSign, label: "Costs", href: "/costs" },
    ],
  },
  {
    label: "Platform",
    items: [
      { icon: Plug, label: "Connectors", href: "/connectors" },
      { icon: CreditCard, label: "Billing", href: "/billing" },
      { icon: Settings, label: "Settings", href: "/settings" },
    ],
  },
];

// ─── AppShell ─────────────────────────────────────────────────────────────────
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const { user, clearUser } = useAuthStore();
  const { sidebarCollapsed, setSidebarCollapsed, aiPanelOpen, toggleAIPanel } =
    useUIPreferencesStore();
  const { openPalette } = useCommandStore();

  // Register navigation commands once on mount
  useEffect(() => {
    const unregister = registerTenantCommands(router);
    return unregister;
  }, [router]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openPalette();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        toggleAIPanel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openPalette, toggleAIPanel]);

  async function handleLogout() {
    try {
      await authService.logout();
    } catch {
      /* swallow — always clear local state */
    }
    clearUser();
    router.replace("/login");
  }

  // Derive avatar initials
  const initials =
    user?.firstName || user?.lastName
      ? `${user.firstName} ${user.lastName}`
          .trim()
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : (user?.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-text-primary">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col border-r border-surface-border bg-surface-raised transition-all duration-normal ease-out-expo flex-shrink-0",
          sidebarCollapsed ? "w-[56px]" : "w-56",
        )}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div
          className={cn(
            "flex items-center gap-2 border-b border-surface-border px-3 h-12 flex-shrink-0",
            sidebarCollapsed && "justify-center px-0",
          )}
        >
          <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center flex-shrink-0">
            <span
              className="text-brand-foreground text-xs font-bold select-none"
              aria-hidden="true"
            >
              N
            </span>
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-body text-text-primary truncate">
              {user?.tenant?.name ?? "NeureCore"}
            </span>
          )}
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 hide-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-1">
              {!sidebarCollapsed && (
                <p className="px-3 pt-3 pb-1 text-micro font-semibold uppercase tracking-widest text-text-secondary">
                  {group.label}
                </p>
              )}
              {group.items.map(({ icon: Icon, label, href }) => {
                const active =
                  pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    title={sidebarCollapsed ? label : undefined}
                    className={cn(
                      "flex items-center gap-3 mx-1 px-2 py-2 rounded-input text-body transition-colors duration-fast",
                      active
                        ? "bg-brand/20 text-brand"
                        : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary",
                      sidebarCollapsed && "justify-center px-0 mx-1",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon
                      className="w-4 h-4 flex-shrink-0"
                      aria-hidden="true"
                    />
                    {!sidebarCollapsed && (
                      <span className="truncate">{label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom: collapse toggle + user row */}
        <div className="border-t border-surface-border p-2 flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            className={cn(
              "flex items-center gap-3 w-full px-2 py-1.5 rounded-input text-body text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors duration-fast",
              sidebarCollapsed && "justify-center px-0",
            )}
          >
            {sidebarCollapsed ? (
              <ChevronRight
                className="w-4 h-4 flex-shrink-0"
                aria-hidden="true"
              />
            ) : (
              <>
                <ChevronLeft
                  className="w-4 h-4 flex-shrink-0"
                  aria-hidden="true"
                />
                <span>Collapse</span>
              </>
            )}
          </button>

          {/* User */}
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-input mt-0.5",
              sidebarCollapsed && "justify-center px-0",
            )}
          >
            <div
              className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-micro font-bold text-brand-foreground flex-shrink-0"
              aria-hidden="true"
            >
              {initials}
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-caption font-medium text-text-primary truncate">
                    {user
                      ? `${user.firstName} ${user.lastName}`.trim() ||
                        user.email
                      : ""}
                  </p>
                  <p className="text-micro text-text-secondary truncate capitalize">
                    {user?.role?.toLowerCase() ?? "user"}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  aria-label="Sign out"
                  className="text-text-secondary hover:text-status-risk transition-colors duration-fast"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top strip */}
        <header className="h-12 flex-shrink-0 flex items-center justify-between px-4 border-b border-surface-border bg-surface-raised gap-3">
          <div className="flex-1 min-w-0">
            <GlobalSearchBar onOpenPalette={openPalette} />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <AutonomyPill />

            {/* AI panel toggle */}
            <button
              onClick={toggleAIPanel}
              title="Toggle AI panel (⌘/)"
              aria-label="Toggle AI assistant panel"
              aria-pressed={aiPanelOpen}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-input text-caption font-medium transition-colors duration-fast",
                aiPanelOpen
                  ? "bg-brand/20 text-brand"
                  : "bg-surface-overlay text-text-secondary hover:bg-surface-muted hover:text-text-primary",
              )}
            >
              <span className="text-sm select-none" aria-hidden="true">
                ✦
              </span>
              <span>AI</span>
            </button>

            {/* Tenant tier badge */}
            <span className="px-2 py-0.5 rounded-pill bg-brand/20 text-brand text-micro font-semibold capitalize">
              {user?.tenant?.tier?.name ?? "Starter"}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {/* ── Right AI panel (handles both docked & slide-in) ── */}
      <RightAIPanel />

      {/* ── Global command palette overlay ──────────────────── */}
      <CommandPalette />
    </div>
  );
}
