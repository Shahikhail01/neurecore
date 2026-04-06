// ─── uiPreferencesStore.ts ───────────────────────────────────────────────────
// SRP: Only stores UI personalisation state.
// Persisted to localStorage via Zustand persist middleware.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  DEFAULT_UI_PREFERENCES,
  type UIPreferences,
  type ThemeName,
  type FontPreference,
  type TextSize,
  type ColorScheme,
  type AutonomyLevel,
} from "@/config/theme.config";

interface UIPreferencesState extends UIPreferences {
  // Theme / display setters
  setTheme: (theme: ThemeName) => void;
  setFont: (font: FontPreference) => void;
  setTextSize: (size: TextSize) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setReduceMotion: (value: boolean) => void;
  // Sidebar
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
  // Legacy panel toggles (preserved for backward compat)
  toggleInspectorPanel: () => void;
  setShowActivityStream: (value: boolean) => void;
  setCompactMode: (value: boolean) => void;
  // Phase A — AI panel
  setAIPanelOpen: (value: boolean) => void;
  toggleAIPanel: () => void;
  setAIPanelDocked: (value: boolean) => void;
  setAutonomyLevel: (level: AutonomyLevel) => void;
  // Reset
  resetPreferences: () => void;
}

export const useUIPreferencesStore = create<UIPreferencesState>()(
  persist(
    (set) => ({
      // ─── Initial state from defaults ────────────────────────────────────────
      ...DEFAULT_UI_PREFERENCES,

      // ─── Actions ─────────────────────────────────────────────────────────────
      setTheme: (theme) => set({ theme }),
      setFont: (font) => set({ font }),
      setTextSize: (textSize) => set({ textSize }),
      setColorScheme: (colorScheme) => set({ colorScheme }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleInspectorPanel: () =>
        set((s) => ({ showInspectorPanel: !s.showInspectorPanel })),
      setShowActivityStream: (showActivityStream) =>
        set({ showActivityStream }),
      setCompactMode: (compactMode) => set({ compactMode }),
      // Phase A
      setAIPanelOpen: (aiPanelOpen) => set({ aiPanelOpen }),
      toggleAIPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
      setAIPanelDocked: (aiPanelDocked) => set({ aiPanelDocked }),
      setAutonomyLevel: (autonomyLevel) => set({ autonomyLevel }),
      resetPreferences: () => set({ ...DEFAULT_UI_PREFERENCES }),
    }),
    {
      name: "hq_ui_preferences",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        font: state.font,
        textSize: state.textSize,
        colorScheme: state.colorScheme,
        reduceMotion: state.reduceMotion,
        sidebarCollapsed: state.sidebarCollapsed,
        showInspectorPanel: state.showInspectorPanel,
        showActivityStream: state.showActivityStream,
        compactMode: state.compactMode,
        aiPanelOpen: state.aiPanelOpen,
        aiPanelDocked: state.aiPanelDocked,
        autonomyLevel: state.autonomyLevel,
      }),
    },
  ),
);
