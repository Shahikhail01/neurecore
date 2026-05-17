'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/authStore';
import type { AuthUser } from '@/types/auth.types';
import { TopBar } from '@/components/layout/TopBar';
import { ActivityStream } from '@/components/layout/ActivityStream';
import { InspectorPanel } from '@/components/layout/InspectorPanel';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { OrgTree } from '@/components/sidebar/OrgTree';
import { ConversationPanel } from '@/components/chat/ConversationPanel';
import { useActivityStream } from '@/hooks/useActivityStream';
import { registerTenantCommands } from '@/services/register-commands';

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: '⬡' },
  { label: 'Agents', href: '/agents', icon: '◈' },
  { label: 'Departments', href: '/departments', icon: '⬟' },
  { label: 'Tasks',    href: '/tasks',          icon: '◫' },
  { label: 'Delegate', href: '/tasks/delegate', icon: '⬡' },
  { label: 'Workflows', href: '/workflows', icon: '⬡' },
  { label: 'Approvals', href: '/approvals', icon: '◻' },
  { label: 'Analytics', href: '/analytics', icon: '◈' },
  { label: 'Connectors', href: '/connectors', icon: '⬟' },
  { label: 'Billing', href: '/billing', icon: '⬡' },
  { label: 'Settings', href: '/settings', icon: '◌' },
];

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

  // Connect Socket.IO events → activity ring-buffer
  useActivityStream();

  // Register ⌘K command palette navigation commands
  useEffect(() => {
    return registerTenantCommands(router);
  }, [router]);

  async function handleLogout() {
    await authService.logout();
    clearUser();
    router.push('/login');
  }

  // Derive current page title from pathname
  const pageTitle =
    NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))?.label ?? 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-zinc-100">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 border-r border-surface-border flex flex-col bg-surface-raised">
        {/* Brand */}
        <div className="px-5 py-4 border-b border-surface-border">
          <span className="text-sm font-bold tracking-widest text-violet-400 uppercase">
            NeureCore
          </span>
          <div className="text-xs text-zinc-500 mt-0.5">Agent Portal</div>
        </div>

        {/* Primary Nav */}
        <nav className="py-3 flex flex-col gap-0.5 px-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-violet-600 text-white font-medium'
                    : 'text-zinc-400 hover:bg-surface-overlay hover:text-white'
                }`}
              >
                <span className="text-xs opacity-70">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Org Tree — collapsible dept/agent hierarchy */}
        <div className="flex-1 overflow-y-auto border-t border-surface-border">
          <OrgTree />
        </div>

        {/* User info + logout */}
        <div className="px-4 py-4 border-t border-surface-border">
          <div className="text-xs text-zinc-400 font-medium truncate mb-0.5">
            {user.firstName} {user.lastName}
          </div>
          <div className="text-xs text-zinc-500 truncate mb-2">{user.email}</div>
          <span className="inline-block rounded-full bg-violet-900 text-violet-300 text-xs px-2 py-0.5 font-medium mb-3">
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
        {/* TopBar — title + ⌘K shortcut + alert chips */}
        <TopBar title={pageTitle} />

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>

        {/* Activity Stream — persistent event strip */}
        <ActivityStream />
      </div>

      {/* ── Portals (rendered once at root) ─────────────────── */}
      <InspectorPanel />
      <CommandPalette />
      <ConversationPanel />
    </div>
  );
}
