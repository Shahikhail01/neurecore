"use client";
// ─── AppInitializer.tsx ────────────────────────────────────────────────────────
// SRP: Boots cross-cutting client-side concerns once on mount. Renders nothing.
// • Wires EventBus → Zustand stores (real-time updates)
// • Registers global keyboard shortcuts (20 actions)
// • Restores session from localStorage tokens on app boot
// • Manages socket lifecycle (connect on login, disconnect on logout)
// • Injects accessible aria-live announce region

import { useEffect } from "react";
import { initStoreEventBridge } from "@/core/infrastructure/socket/storeEventBridge";
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts";
import { useAuthStore } from "@/stores/authStore";
import { authService } from "@/services/auth.service";
import { tokenManager } from "@/core/infrastructure/auth/TokenManager";
import { connectSocket, disconnectSocket } from "@/services/socket";

export function AppInitializer() {
  // Register 20 keyboard shortcuts globally
  useKeyboardShortcuts();

  // Connect EventBus → Zustand stores; teardown on unmount
  useEffect(() => {
    const teardown = initStoreEventBridge();
    return teardown;
  }, []);

  // Restore session: if a valid token exists in localStorage but the store has
  // no user (e.g. after a hard refresh that cleared in-memory state), re-fetch
  // the current user profile so protected pages don't flash-redirect to /login.
  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(
      async (state) => {
        // Clear stale tokens from previous environment/backend
        // Tokens from a different backend (local vs Contabo) will cause 401 loop
        const accessToken = tokenManager.getAccessToken();
        if (accessToken) {
          // Validate token format (basic check) - if malformed, clear it
          const parts = accessToken.split(".");
          if (parts.length !== 3) {
            tokenManager.clearTokens();
          } else {
            // Try to validate with backend - if 401, token is stale
            try {
              const user = await authService.me();
              if (user) useAuthStore.getState().setUser(user);
            } catch {
              tokenManager.clearTokens();
            }
          }
        }
      },
    );
    return unsubscribe;
  }, []);

  // Socket lifecycle: connect when authenticated, disconnect on logout.
  // Components may also call connectSocket() safely — it's idempotent.
  useEffect(() => {
    // Connect if already authenticated at boot
    if (useAuthStore.getState().user) {
      connectSocket();
    }

    // Subscribe to auth state changes
    const unsubscribe = useAuthStore.subscribe((state, prev) => {
      if (!prev.user && state.user) {
        // Logged in — connect with current token
        connectSocket();
      } else if (prev.user && !state.user) {
        // Logged out — tear down connection
        disconnectSocket();
      }
    });

    return unsubscribe;
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
