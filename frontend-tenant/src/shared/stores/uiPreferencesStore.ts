// ─── uiPreferencesStore.ts ───────────────────────────────────────────────────
// SRP: Only stores UI personalisation state.
// Persisted to localStorage via Zustand persist middleware.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  DEFAULT_UI_PREFERENCES,
  type UIPreferences,
  type ThemeName,
  type FontPreference,
  type TextSize,
  type ColorScheme,
} from '@/config/theme.config';

interface UIPreferencesState extends UIPreferences {
  // Setters
  setTheme: (theme: ThemeName) => void;
  setFont: (font: FontPreference) => void;
  setTextSize: (size: TextSize) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setReduceMotion: (value: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
  toggleInspectorPanel: () => void;
  setShowActivityStream: (value: boolean) => void;
  setCompactMode: (value: boolean) => void;
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
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleInspectorPanel: () => set((s) => ({ showInspectorPanel: !s.showInspectorPanel })),
      setShowActivityStream: (showActivityStream) => set({ showActivityStream }),
      setCompactMode: (compactMode) => set({ compactMode }),
      resetPreferences: () => set({ ...DEFAULT_UI_PREFERENCES }),
    }),
    {
      name: 'hq_ui_preferences',
      storage: createJSONStorage(() => localStorage),
      // Only persist serialisable prefs — exclude setters
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
      }),
    },
  ),
);
