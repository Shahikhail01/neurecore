"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/auth";
import type { AuthUser } from "@/types/auth.types";
import { TopBar } from "@/components/layout/TopBar";
import { ActivityStream } from "@/components/layout/ActivityStream";
import { InspectorPanel } from "@/components/layout/InspectorPanel";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { UnifiedChatPanel } from "@/shared/components/chat/UnifiedChatPanel";
import { chatService, slashCommands, jsonExtractor, adminChatConfig } from "@/core/services/chat/chat.factory";
import { registerAdminCommands } from "@/services/register-commands";
import { NAV_GROUPS, ALL_NAV_ITEMS } from "@/components/sidebar/navigation.config";
import { PageShell } from "@neurecore/ui-visual";
import { SkipLink } from "@/shared/a11y/SkipLink";
import { MAIN_CONTENT_ID, PRIMARY_NAV_ID } from "@/shared/a11y/landmarks";
import { AnnouncerProvider } from "@/shared/a11y/Announcer";
import { LocaleProvider } from "@/shared/i18n/LocaleProvider";

export default function AdminShell({
  user,
  children,
}: {
  user: AuthUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  // Hooks must run on every render, before any early return, or React
  // sees a different hook order once `user` resolves
  // (react-hooks/rules-of-hooks).
  useEffect(() => {
    return registerAdminCommands(router);
  }, [router]);

  // Auth guard: during static prerender and before the auth store resolves,
  // `user` is null. Render nothing (and rely on the auth hook's redirect to
  // /login) instead of crashing on `user.firstName`. Solid: the guard is
  // independent of any page; every page that renders AdminShell inherits it.
  if (!user) return null;

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const pageTitle =
    ALL_NAV_ITEMS.find(
      (n) => pathname === n.href || pathname.startsWith(n.href + "/"),
    )?.label ?? "Overview";

  return (
    <LocaleProvider>
      <AnnouncerProvider>
        <SkipLink />
        <div className="flex h-screen overflow-hidden bg-surface text-zinc-100">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 border-r border-surface-border flex flex-col bg-surface-raised">
        <div className="px-5 py-4 border-b border-surface-border">
          <span className="text-sm font-bold tracking-widest text-[color:var(--accent-400)] uppercase">
            NeureCore
          </span>
          <div className="text-xs text-zinc-500 mt-0.5">Admin Console</div>
        </div>

        <nav
          id={PRIMARY_NAV_ID}
          aria-label="Admin console navigation"
          className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="flex flex-col gap-0.5">
              <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 select-none">
                {group.label}
              </div>
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "nv-btn-accent"
                        : "text-zinc-400 hover:bg-surface-overlay hover:text-white"
                    }`}
                  >
                    <span className="text-xs opacity-70">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-surface-border">
          <div className="text-xs text-zinc-400 font-medium truncate mb-0.5">
            {user.firstName} {user.lastName}
          </div>
          <div className="text-xs text-zinc-500 truncate mb-2">
            {user.email}
          </div>
          <span className="inline-block rounded-full bg-[color:var(--accent-500)]/20 text-[color:var(--accent-300)] text-xs px-2 py-0.5 font-medium mb-3">
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
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="flex-1 overflow-auto"
        >
          <PageShell variant="compact" noAmbient>
            {children}
          </PageShell>
        </main>
        <ActivityStream />
      </div>

      {/* ── Portals ─────────────────────────────────────────── */}
      <InspectorPanel />
      <CommandPalette />
      <UnifiedChatPanel
        chatService={chatService}
        slashCommands={slashCommands}
        jsonExtractor={jsonExtractor}
        config={adminChatConfig}
      />
        </div>
      </AnnouncerProvider>
    </LocaleProvider>
  );
}
