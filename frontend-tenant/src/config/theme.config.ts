// ─── theme.config.ts ──────────────────────────────────────────────────────────
// Central theme configuration for HeadQuarter UI.
// OCP: New themes are added as new entries — existing code unmodified.

export type ThemeName = 'dark' | 'light' | 'high-contrast';
export type FontPreference = 'default' | 'dyslexia-friendly' | 'monospace';
export type TextSize = 'sm' | 'md' | 'lg' | 'xl';
export type ColorScheme = 'standard' | 'colorblind';

export interface ThemeConfig {
  name: ThemeName;
  label: string;
  cssClass: string;
  description: string;
}

export interface UIPreferences {
  theme: ThemeName;
  font: FontPreference;
  textSize: TextSize;
  colorScheme: ColorScheme;
  reduceMotion: boolean;
  sidebarCollapsed: boolean;
  showInspectorPanel: boolean;
  showActivityStream: boolean;
  compactMode: boolean;
}

export const THEMES: ThemeConfig[] = [
  {
    name: 'dark',
    label: 'Dark (Default)',
    cssClass: 'theme-dark',
    description: 'Default executive dark theme',
  },
  {
    name: 'light',
    label: 'Light',
    cssClass: 'theme-light',
    description: 'Clean light theme',
  },
  {
    name: 'high-contrast',
    label: 'High Contrast',
    cssClass: 'theme-high-contrast',
    description: 'Maximum visibility for accessibility',
  },
];

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  theme: 'dark',
  font: 'default',
  textSize: 'md',
  colorScheme: 'standard',
  reduceMotion: false,
  sidebarCollapsed: false,
  showInspectorPanel: true,
  showActivityStream: true,
  compactMode: false,
};

export const TEXT_SIZE_CLASSES: Record<TextSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};
