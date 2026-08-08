'use client';

/**
 * TopBar — Slim global header for the IconRail-era portal.
 *
 * Layout: [Brand] [Breadcrumb] … [⌘K] [TierBadge] [Theme] [Notifications] [Help] [Avatar▾]
 *
 * The IconRail (left) is the single source of truth for navigation. The TopBar
 * only carries:
 *   - Page context (brand + breadcrumb)
 *   - Global command palette trigger
 *   - Phase 6 TierBadge → opens TierChangeModal on click
 *   - Theme toggle
 *   - Notifications bell
 *   - Help link
 *   - User menu (name, email, role, settings, sign out)
 *
 * Phase 3 left legacy behind: the Inbox/Marketplace/Service Desk/Intelligence
 * /Finance secondary icons were removed because the IconRail now covers
 * those routes.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  HelpCircle,
  Settings,
  Sun,
  Moon,
  Contrast,
  ChevronDown,
  LogOut,
  Menu,
} from 'lucide-react';
import type { AuthUser } from '@/types/auth.types';
import { useCommandStore } from '@/stores/commandStore';
import { useActivityStore } from '@/stores/activityStore';
import { useUIPreferencesStore } from '@/shared/stores/uiPreferencesStore';
import { tenantsService } from '@/services/tenants.service';
import { tiersService, type Tier } from '@/services/tiers.service';
import { TierBadge } from '@/components/tier/TierBadge';
import { TierChangeModal } from '@/components/tier/TierChangeModal';

interface TopBarProps {
  title?: string;
  /** Optional current department name (shown as breadcrumb when on workspace). */
  departmentName?: string;
  /** Phase 7: Mobile nav toggle callback */
  onMobileNavToggle?: () => void;
  /** Authenticated user (drives avatar + sign-out menu). */
  user?: AuthUser | null;
  /** Sign-out handler from TenantShell. */
  onLogout?: () => void | Promise<void>;
}

type ThemeName = 'dark' | 'light' | 'high-contrast';

const THEME_ICON: Record<ThemeName, React.ComponentType<{ className?: string }>> = {
  dark: Moon,
  light: Sun,
  'high-contrast': Contrast,
};

export function TopBar({ title, departmentName, onMobileNavToggle, user: userProp, onLogout }: TopBarProps) {
  const { openPalette } = useCommandStore();
  const { events } = useActivityStore();
  const { theme, setTheme } = useUIPreferencesStore();
  const router = useRouter();
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  // Phase 6 — tier badge + change-modal state. We resolve the tenant's
  // current tier via tenantsService.getCurrent() (which exposes tierId)
  // then look it up in tiersService.list() so we have the full Tier
  // object for the badge.
  const [currentTier, setCurrentTier] = useState<Tier | null>(null);
  const [tierModalOpen, setTierModalOpen] = useState(false);

  const errorCount = events.filter((e) => e.severity === 'error').length;

  const ThemeIcon = THEME_ICON[theme as ThemeName] ?? Moon;

  const cycleTheme = () => {
    const order: ThemeName[] = ['dark', 'light', 'high-contrast'];
    const idx = order.indexOf(theme as ThemeName);
    const next = order[(idx + 1) % order.length];
    setTheme(next);
  };

  const handleSignOut = async () => {
    setAvatarMenuOpen(false);
    if (onLogout) {
      await onLogout();
    }
  };

  // Phase 6 — resolve the tenant's current tier. Two requests in
  // parallel: tenantsService.getCurrent() for the tierId, then
  // tiersService.list() to find the matching tier. Falls back silently
  // if either fails — the badge is a nice-to-have, not a hard dep.
  useEffect(() => {
    let cancelled = false;
    Promise.all([tenantsService.getCurrent(), tiersService.list()])
      .then(([tenant, tiers]) => {
        if (cancelled || !tenant.tierId) return;
        const match = tiers.find((t) => t.id === tenant.tierId);
        if (match) setCurrentTier(match);
      })
      .catch(() => {
        /* non-fatal — badge hides silently */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const user = userProp ?? null;

  return (
    <>
      <header className="topbar-surface h-14 flex items-center px-4 gap-2 flex-shrink-0 z-20">
        {/* ── Left: brand + breadcrumb ─────────────────────────── */}
        <Link href="/home" className="flex items-center gap-2 shrink-0">
          <img src="/logo.png" alt="NeureCore" className="h-6 w-auto object-contain" />
        </Link>

        {(departmentName || title) && (
          <>
            <span className="text-zinc-600 mx-1">/</span>
            <span className="text-sm font-medium text-zinc-300 truncate max-w-[200px]">
              {departmentName || title}
            </span>
          </>
        )}

        {/* ── Center: command palette trigger ──────────────────── */}
        <div className="flex-1 flex justify-center min-w-0">
          <button
            onClick={openPalette}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-border bg-surface text-zinc-500 text-xs hover:border-accent-500 hover:text-zinc-300 transition-colors min-w-[280px]"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search or command…</span>
            <kbd className="text-[10px] bg-surface-muted px-1.5 py-0.5 rounded text-zinc-500 font-mono">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* ── Right: tier badge (Phase 6) ────────────────────── */}
        {currentTier && (
          <>
            <TierBadge tier={currentTier} onClick={() => setTierModalOpen(true)} />
            <div className="w-px h-6 bg-surface-border mx-1" aria-hidden="true" />
          </>
        )}

        {/* ── Right: secondary icons ──────────────────────────── */}
        <nav className="flex items-center gap-1">
          {/* Phase 7: Mobile hamburger menu toggle */}
          {onMobileNavToggle && (
            <button
              onClick={onMobileNavToggle}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay transition"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          {/* Secondary icons (Inbox/Marketplace/Service Desk/Intelligence/Finance)
              are removed — the IconRail is the single source of truth for nav. */}
        </nav>

        {/* ── Theme toggle ──────────────────────────────────────── */}
        <button
          onClick={cycleTheme}
          className="ml-2 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay transition"
          title={`Theme: ${theme} (click to cycle)`}
          aria-label="Toggle theme"
        >
          <ThemeIcon className="w-4 h-4" />
        </button>

        {/* ── Notifications ─────────────────────────────────────── */}
        <button
          onClick={() => router.push('/service-desk?tab=inbox')}
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay transition"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {errorCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-state-danger text-[9px] font-bold text-white">
              {errorCount}
            </span>
          )}
        </button>

        {/* ── Help ──────────────────────────────────────────────── */}
        <Link
          href="/help"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay transition"
          title="Help"
          aria-label="Help"
        >
          <HelpCircle className="w-4 h-4" />
        </Link>

        {/* Settings is reachable via the user menu (avatar dropdown) below,
            so the standalone icon-link here is removed to avoid duplication. */}

        {/* ── Avatar + dropdown ─────────────────────────────────── */}
        {user && (
          <div className="relative ml-1">
            <button
              onClick={() => setAvatarMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 pl-1 pr-2 h-8 rounded-lg hover:bg-surface-overlay transition"
              aria-label="User menu"
            >
              <div className="w-7 h-7 rounded-full bg-accent-500 flex items-center justify-center text-white text-xs font-semibold">
                {(user.firstName?.[0] ?? user.email[0]).toUpperCase()}
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>

            {avatarMenuOpen && (
              <>
                {/* Backdrop to close on click-outside */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setAvatarMenuOpen(false)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAvatarMenuOpen(false); } }}
                />
                <div className="absolute right-0 top-full mt-1 w-56 card-surface border border-surface-border shadow-creatio-md py-1 z-40">
                  <div className="px-3 py-2 border-b border-surface-border">
                    <p className="text-sm font-medium text-zinc-100 truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                    <span className="inline-block mt-1.5 rounded-full bg-accent-500/15 text-accent-500 text-[10px] px-2 py-0.5 font-medium uppercase tracking-wide">
                      {user.role}
                    </span>
                  </div>
                  <Link
                    href="/intelligence?tab=settings"
                    onClick={() => setAvatarMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-surface-overlay hover:text-zinc-100"
                  >
                    <Settings className="w-3.5 h-3.5" /> Settings
                  </Link>
                  <Link
                    href="/help"
                    onClick={() => setAvatarMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-surface-overlay hover:text-zinc-100"
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> Help
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-state-danger hover:bg-state-danger/10 border-t border-surface-border"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* Phase 6 — tier change modal. Controlled by the TierBadge above. */}
      <TierChangeModal
        open={tierModalOpen}
        onClose={() => setTierModalOpen(false)}
        currentTier={currentTier}
      />
    </>
  );
}