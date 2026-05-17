// ─── useKeyboardShortcuts.ts ─────────────────────────────────────────────────
// SRP: Binds keyboard events to app actions only.
// DIP: Uses accessibilityService and router abstractions.

'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { accessibilityService, type ShortcutAction } from '@/core/services/accessibility/AccessibilityService';
import { useCommandStore } from '@/stores/commandStore';
import { useUIPreferencesStore } from '@/shared/stores/uiPreferencesStore';
import { ROUTES } from '@/shared/constants/routes';

/**
 * Mount once at the app shell level (TenantShell or RootLayout).
 * Binds 20+ keyboard shortcuts to their respective store/router actions.
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const openPalette = useCommandStore((s) => s.openPalette);
  const toggleSidebar = useUIPreferencesStore((s) => s.toggleSidebar);
  const toggleInspector = useUIPreferencesStore((s) => s.toggleInspectorPanel);
  const toggleActivity = useUIPreferencesStore((s) => s.setShowActivityStream);
  const toggleTheme = useUIPreferencesStore((s) => s.setTheme);
  const currentTheme = useUIPreferencesStore((s) => s.theme);

  const executeAction = useCallback(
    (action: ShortcutAction) => {
      switch (action) {
        case 'openCommandPalette':
          openPalette();
          break;

        // ── Navigation ──────────────────────────────────────────────────────
        case 'goToDashboard':
          router.push(ROUTES.DASHBOARD);
          break;
        case 'goToAgents':
          router.push(ROUTES.AGENTS.ROOT);
          break;
        case 'goToTasks':
          router.push(ROUTES.TASKS.ROOT);
          break;
        case 'goToWorkflows':
          router.push(ROUTES.WORKFLOWS.ROOT);
          break;
        case 'goToAnalytics':
          router.push(ROUTES.ANALYTICS);
          break;
        case 'openApprovals':
          router.push(ROUTES.APPROVALS);
          break;
        case 'openSettings':
          router.push(ROUTES.SETTINGS.ROOT);
          break;
        case 'goToDepartments':
          router.push(ROUTES.DEPARTMENTS.ROOT);
          break;
        case 'goToConnectors':
          router.push(ROUTES.CONNECTORS);
          break;

        // ── Create actions ──────────────────────────────────────────────────
        case 'newTask':
          router.push(`${ROUTES.TASKS.ROOT}?create=1`);
          break;
        case 'newWorkflow':
          router.push(ROUTES.WORKFLOWS.BUILDER);
          break;

        // ── UI Toggles ──────────────────────────────────────────────────────
        case 'toggleSidebar':
          toggleSidebar();
          break;
        case 'toggleInspector':
          toggleInspector();
          break;
        case 'toggleActivityStream':
          toggleActivity(true); // handled by current val internally
          break;
        case 'toggleTheme':
          toggleTheme(currentTheme === 'dark' ? 'light' : 'dark');
          break;

        // ── Misc ────────────────────────────────────────────────────────────
        case 'search':
          openPalette();
          break;
        case 'refresh':
          window.location.reload();
          break;
        case 'closeModal':
          // Dispatch Escape for any open dialog/portal that handles it
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          break;
        case 'openNotifications':
          // Dispatch a custom event — NotificationPanel listens for this
          window.dispatchEvent(new CustomEvent('hq:open-notifications'));
          break;
      }
    },
    [router, openPalette, toggleSidebar, toggleInspector, toggleActivity, toggleTheme, currentTheme],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept in text inputs unless it's a global shortcut
      const target = e.target as HTMLElement;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable;
      if (isTyping && e.code !== 'Escape') return;

      const shortcut = accessibilityService.matchShortcut(e);
      if (!shortcut) return;

      e.preventDefault();
      executeAction(shortcut.action);
      accessibilityService.announce(`${shortcut.label} activated`);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [executeAction]);
}

// ─── Companion hook: screen reader announcements ──────────────────────────────
export function useAnnounce() {
  return {
    announce: (msg: string, priority?: 'polite' | 'assertive') =>
      accessibilityService.announce(msg, priority),
  };
}
