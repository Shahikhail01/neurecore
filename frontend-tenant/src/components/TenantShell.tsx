'use client';

/**
 * TenantShell — Canonical portal shell.
 *
 * Layout:
 *   ┌─ IconRail (56px collapsed / 240px expanded) ─┬─ Content ───────────┐
 *   │  NeureCore brand                              │  TopBar (56px)      │
 *   │  Sectioned primary nav                        │  ──────────────     │
 *   │  Workspace tree (collapsible)                 │                     │
 *   │  Pin/collapse toggle                          │  Page content       │
 *   └───────────────────────────────────────────────┴─────────────────────┘
 *
 * On mobile (<md): IconRail is hidden; hamburger in TopBar opens MobileNav
 * which renders the same IconRail as a slide-out drawer.
 *
 * Floating overlays (Phase 7):
 *   - ThingsToDoPanel (top-right, lg+)
 *   - InspectorPanel, CommandPalette, UnifiedChatPanel
 *
 * Single source of truth for navigation: the IconRail defined in
 * components/layout/IconRail.tsx. There is intentionally no legacy sidebar.
 */

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/auth';
import type { AuthUser } from '@/types/auth.types';
import { TopBar } from '@/components/layout/TopBar';
import { IconRail } from '@/components/layout/IconRail';
import { ActivityStream } from '@/components/layout/ActivityStream';
import { InspectorPanel } from '@/components/layout/InspectorPanel';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { UnifiedChatPanel } from '@/shared/components/chat/UnifiedChatPanel';
import { chatService, slashCommands, jsonExtractor, envelopeParser, tenantChatConfig } from '@/core/services/chat/chat.factory';
import { ThingsToDoPanel } from '@/components/checklist/ThingsToDoPanel';
import { MobileNav } from '@/components/layout/MobileNav';
import { MobileNav as GatedMobileNav, type MobileNavItem } from '@/shared/mobile/mobile-nav';
import { useMobileActionGate } from '@/shared/mobile/mobile-provider';
import { useActivityStream } from '@/hooks/useActivityStream';
import { registerTenantCommands } from '@/services/register-commands';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useTenantStore } from '@/stores/tenantStore';
import { SkipLink } from '@/shared/a11y/SkipLink';
import { MAIN_CONTENT_ID } from '@/shared/a11y/landmarks';
import { AnnouncerProvider } from '@/shared/a11y/Announcer';
import { LocaleProvider } from '@/shared/i18n/LocaleProvider';
import { useLocalePreferences } from '@/shared/i18n/useLocalePreferences';

export default function TenantShell({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const fetchTenant = useTenantStore((s) => s.fetchTenant);
  const industryGroup = useTenantStore((s) => s.industryGroup);
  const industry = useTenantStore((s) => s.industry);
  const tenantLoading = useTenantStore((s) => s.loading);
  const tenantError = useTenantStore((s) => s.error);
  const localePreferences = useLocalePreferences();

  useActivityStream();

  useEffect(() => {
    void fetchTenant();
  }, [fetchTenant]);

  // Block IconRail render until tenant data is loaded (prevents FALLBACK flash)
  // This ensures workspace extras and customer label render correctly on first paint.
  const isTenantReady = !tenantLoading && (industryGroup !== null || tenantError !== null);

  useEffect(() => {
    return registerTenantCommands(router);
  }, [router]);

  // Close mobile drawer on route change.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  // Derive current dept name from URL if on workspace
  const deptMatch = pathname.match(/^\/departments\/([^/]+)\/workspace/);
  const departmentName = deptMatch ? decodeURIComponent(deptMatch[1]) : undefined;

  // Derive page title from pathname
  const pageTitle = getPageTitle(pathname);

  return (
    <ErrorBoundary>
      <LocaleProvider preferences={localePreferences}>
        <AnnouncerProvider>
          <SkipLink />
          <div className="flex h-screen overflow-hidden bg-surface text-zinc-100">
        {/* Desktop: persistent IconRail. h-full lets the rail stretch the
            full viewport height so the inner <nav> can scroll independently. */}
        <div className="hidden md:block shrink-0 h-full">
          {isTenantReady ? <IconRail /> : <RailSkeleton />}
        </div>

        {/* Mobile: drawer with the same IconRail. */}
        <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
          <div className="p-4 border-b border-surface-border">
            <span className="text-xs font-bold tracking-widest text-accent-500 uppercase">
              Quick actions
            </span>
            <div className="mt-2">
              <MobileActionsNav />
            </div>
          </div>
          {isTenantReady ? <IconRail /> : <RailSkeleton />}
        </MobileNav>

        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar
            title={pageTitle}
            departmentName={departmentName}
            user={user}
            onMobileNavToggle={() => setMobileNavOpen(!mobileNavOpen)}
            onLogout={handleLogout}
          />

          <main
            id={MAIN_CONTENT_ID}
            tabIndex={-1}
            className="flex-1 overflow-auto px-3 py-4 md:p-6"
          >
            {children}
          </main>

          <ActivityStream />
        </div>

        {/* Floating panels */}
        <div className="hidden lg:fixed lg:top-20 lg:right-6 z-30 w-full lg:max-w-md lg:pointer-events-none">
          <div className="lg:pointer-events-auto">
            <ThingsToDoPanel />
          </div>
        </div>

        <InspectorPanel />
        <CommandPalette />
        <UnifiedChatPanel
          chatService={chatService}
          slashCommands={slashCommands}
          jsonExtractor={jsonExtractor}
          envelopeParser={envelopeParser}
          config={tenantChatConfig}
        />
          </div>
        </AnnouncerProvider>
      </LocaleProvider>
    </ErrorBoundary>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function getPageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '/command-center' || pathname === '/home') return 'Home';
  if (pathname.startsWith('/marketplace')) return 'Marketplace';
  if (pathname.startsWith('/departments') && pathname.includes('/workspace')) return 'Workspace';
  if (pathname.startsWith('/departments')) return 'Departments';
  if (pathname.startsWith('/finance')) return 'Finance';
  if (pathname.startsWith('/service-desk')) return 'Service Desk';
  if (pathname.startsWith('/intelligence')) return 'Intelligence';
  if (pathname.startsWith('/login')) return 'Login';
  return 'NeureCore';
}

function RailSkeleton() {
  return (
    <div className="w-[240px] h-full bg-surface border-r border-border animate-pulse">
      <div className="p-4 space-y-4">
        <div className="h-8 bg-muted rounded-md" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * MobileActionsNav — Phase 28 (P28) — CR-AI-1107.
 *
 * Real UI surface that exercises the `MobileActionGate`: renders the
 * matrix-declared actions, filtered by the current viewport. Actions
 * the matrix blocks on mobile are hidden automatically by the gate
 * (e.g. `view-forecast` is desktop-only). This is the first app
 * surface to consume the gate, closing the "gate never used in real
 * UI" gap.
 *
 * SRP — render only; the gate decides what is allowed.
 */
const MOBILE_ACTION_ITEMS: ReadonlyArray<MobileNavItem> = [
  { action: 'view-customer', label: 'Customers', href: '/customers' },
  { action: 'access-meetings', label: 'Meetings', href: '/meetings' },
  { action: 'manage-tasks', label: 'Tasks', href: '/tasks' },
  { action: 'view-forecast', label: 'Forecast', href: '/deals' },
];

function MobileActionsNav() {
  const gate = useMobileActionGate();
  const items = MOBILE_ACTION_ITEMS.filter((item) =>
    gate.isAllowed(item.action),
  );
  return <GatedMobileNav items={items} />;
}