"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  BarChart3,
  Building2,
  CheckSquare,
  Target,
  Bell,
  Plug,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Layers,
  Zap,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { authService } from "@/services/auth.service";
import { cn } from "@/lib/utils";

const UI_MODE_KEY = "ui_mode";

interface NavItem {
  href: string;
  label: string;
  Icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/nocobase-ui", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/nocobase-ui/agents", label: "Agents", Icon: Users },
  { href: "/nocobase-ui/workflows", label: "Workflows", Icon: GitBranch },
  { href: "/nocobase-ui/departments", label: "Departments", Icon: Building2 },
  { href: "/nocobase-ui/tasks", label: "Tasks", Icon: CheckSquare },
  { href: "/nocobase-ui/goals", label: "Goals", Icon: Target },
  { href: "/nocobase-ui/analytics", label: "Analytics", Icon: BarChart3 },
  { href: "/nocobase-ui/approvals", label: "Approvals", Icon: Bell },
  { href: "/nocobase-ui/connectors", label: "Connectors", Icon: Plug },
  { href: "/nocobase-ui/settings", label: "Settings", Icon: Settings },
];

interface NocoBaseShellProps {
  children: React.ReactNode;
}

export function NocoBaseShell({ children }: NocoBaseShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  function switchToLegacy() {
    try {
      localStorage.setItem(UI_MODE_KEY, "legacy");
    } catch {
      // ignore
    }
    router.push("/dashboard");
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authService.logout();
    } finally {
      clearUser();
      router.replace("/login");
    }
  }

  return (
    <div className="flex h-screen bg-[#07070a] text-zinc-100 overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col border-r border-zinc-800 bg-[#0e0e12] transition-all duration-200 shrink-0",
          collapsed ? "w-14" : "w-56",
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-zinc-800 shrink-0">
          {!collapsed && (
            <>
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-sm font-semibold tracking-tight">
                <span className="text-violet-400">Neure</span>Core
              </span>
              <span className="ml-auto text-[10px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-1.5 py-0.5 shrink-0">
                New UI
              </span>
            </>
          )}
          {collapsed && <Zap className="w-4 h-4 text-emerald-400 mx-auto" />}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const isActive =
              pathname === href ||
              (href !== "/nocobase-ui" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-violet-500/15 text-violet-300"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-zinc-800 p-2 space-y-1 shrink-0">
          {/* Switch to Legacy */}
          <button
            onClick={switchToLegacy}
            title={collapsed ? "Switch to Legacy UI" : undefined}
            className="flex items-center gap-3 w-full px-2 py-2 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
          >
            <Layers className="w-4 h-4 shrink-0" />
            {!collapsed && (
              <span className="truncate">Switch to Legacy UI</span>
            )}
          </button>

          {/* User + Sign out */}
          {!collapsed && user && (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-6 h-6 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-violet-300">
                  {user.firstName?.[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-200 truncate">
                  {user.firstName} {user.lastName}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                title="Sign out"
                className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center justify-center w-full py-1.5 text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
