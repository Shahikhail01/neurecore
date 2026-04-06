"use client";

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
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Zap,
  Search,
  Home,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUIPreferencesStore } from "@/shared/stores/uiPreferencesStore";
import { authService } from "@/services/auth.service";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { icon: Home, label: "Home", href: "/home" },
      { icon: LayoutDashboard, label: "AI Office", href: "/dashboard" },
      { icon: Bell, label: "Inbox", href: "/inbox", badge: true },
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const { theme, setTheme, sidebarCollapsed, setSidebarCollapsed } =
    useUIPreferencesStore();
  const isDark = theme !== "light";

  async function handleLogout() {
    try {
      await authService.logout();
    } catch {}
    clearUser();
    router.replace("/login");
  }

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
    <div className="flex h-screen overflow-hidden bg-[var(--surface)] text-[var(--text-primary)]">
      {/* ── Sidebar ─────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col border-r border-[var(--surface-border)] bg-[var(--surface-raised)] transition-all duration-200 flex-shrink-0",
          sidebarCollapsed ? "w-[56px]" : "w-56",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex items-center gap-2 border-b border-[var(--surface-border)] px-3 h-12 flex-shrink-0",
            sidebarCollapsed && "justify-center px-0",
          )}
        >
          {!sidebarCollapsed && (
            <span className="font-bold text-sm tracking-wide text-white truncate">
              {user?.tenant?.name ?? "NeureCore"}
            </span>
          )}
          {sidebarCollapsed && (
            <span className="text-violet-400 font-bold text-base">N</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 hide-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-1">
              {!sidebarCollapsed && (
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
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
                      "flex items-center gap-3 mx-1 px-2 py-2 rounded-md text-sm transition-colors",
                      active
                        ? "bg-violet-600/20 text-violet-400"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]",
                      sidebarCollapsed && "justify-center px-0 mx-1",
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <span className="truncate">{label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom user row */}
        <div
          className={cn(
            "border-t border-[var(--surface-border)] p-2 flex flex-col gap-1 flex-shrink-0",
          )}
        >
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={cn(
              "flex items-center gap-3 w-full px-2 py-1.5 rounded-md text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors",
              sidebarCollapsed && "justify-center px-0",
            )}
          >
            {isDark ? (
              <Sun className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Moon className="w-4 h-4 flex-shrink-0" />
            )}
            {!sidebarCollapsed && (
              <span>{isDark ? "Light mode" : "Dark mode"}</span>
            )}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center gap-3 w-full px-2 py-1.5 rounded-md text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors",
              sidebarCollapsed && "justify-center px-0",
            )}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>

          {/* User */}
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md mt-1",
              sidebarCollapsed && "justify-center px-0",
            )}
          >
            <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {initials}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                  {user
                    ? `${user.firstName} ${user.lastName}`.trim() || user.email
                    : ""}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)] truncate capitalize">
                  {user?.role?.toLowerCase() ?? "user"}
                </p>
              </div>
            )}
            {!sidebarCollapsed && (
              <button
                onClick={handleLogout}
                title="Sign out"
                className="text-[var(--text-secondary)] hover:text-red-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-12 flex-shrink-0 flex items-center justify-between px-4 border-b border-[var(--surface-border)] bg-[var(--surface-raised)]">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input
              placeholder="Search anything… (⌘K)"
              className="bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none w-48"
              readOnly
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              System Online
            </span>
            <span className="px-2 py-0.5 rounded bg-violet-600/20 text-violet-400 text-[10px] font-semibold capitalize">
              {user?.tenant?.tier?.name ?? "Starter"}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
