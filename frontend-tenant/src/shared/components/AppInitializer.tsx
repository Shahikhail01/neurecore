'use client';
// ─── AppInitializer.tsx ────────────────────────────────────────────────────────
// SRP: Boots cross-cutting client-side concerns once on mount. Renders nothing.
// • Wires EventBus → Zustand stores (real-time updates)
// • Registers global keyboard shortcuts (20 actions)
// • Injects accessible aria-live announce region

import { useEffect } from 'react';
import { initStoreEventBridge } from '@/core/infrastructure/socket/storeEventBridge';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';

export function AppInitializer() {
  // Register 20 keyboard shortcuts globally
  useKeyboardShortcuts();

  // Connect EventBus → Zustand stores; teardown on unmount
  useEffect(() => {
    const teardown = initStoreEventBridge();
    return teardown;
  }, []);

  // Accessible announce region (used by useAnnounce / AccessibilityService)
  return (
    <div
      id="hq-announce"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  );
}
