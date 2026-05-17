// ─── feature-flags.ts ────────────────────────────────────────────────────────
// OCP: Turn features on/off in one place. No scattered `if` checks.
// All features default to safe fallback (true for stable, false for experimental).

export const FEATURE_FLAGS = {
  // Phase 1 — Foundation (all stable)
  SOCKET_REALTIME: true,
  COMMAND_PALETTE: true,
  ACTIVITY_STREAM: true,
  INSPECTOR_PANEL: true,

  // Phase 2 — Enhanced UX (rolling out)
  SMART_NOTIFICATIONS: true,
  AI_RECOMMENDATIONS: false,   // needs backend endpoint
  DECISION_SUPPORT: false,     // needs backend endpoint
  WHAT_IF_SIMULATOR: false,

  // Phase 3 — Advanced
  VOICE_COMMANDS: false,
  MOBILE_PWA: false,
  CUSTOM_REPORTS: false,
  CUSTOM_DASHBOARD: false,
  COLLABORATION_HUB: false,

  // Accessibility
  HIGH_CONTRAST_MODE: true,
  KEYBOARD_SHORTCUTS: true,
  SCREEN_READER_SUPPORT: true,
  DYSLEXIA_FONT: false,

  // Developer
  DEBUG_MODE: process.env.NODE_ENV === 'development',
  PERF_MONITORING: process.env.NODE_ENV === 'development',
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag] as boolean;
}
