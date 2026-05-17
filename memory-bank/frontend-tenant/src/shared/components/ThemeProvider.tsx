'use client';
// ─── ThemeProvider.tsx ────────────────────────────────────────────────────────
// SRP: Sole responsibility is applying theme/font/size/colorblind classes
//      from UIPreferencesStore to the <html> element.
// OCP: New CSS classes (e.g., new themes) handled purely in globals.css —
//      this component never needs modification.
// DIP: Depends on useUIPreferencesStore abstraction, not direct localStorage.

import { useEffect } from 'react';
import { useUIPreferencesStore } from '@/shared/stores/uiPreferencesStore';
import { TEXT_SIZE_CLASSES } from '@/config/theme.config';

/**
 * Maps UIPreference values → CSS class names applied to <html>.
 * Pure data — adding new mappings never requires logic changes.
 */
const FONT_CLASS: Record<string, string> = {
  'default':           '',
  'dyslexia-friendly': 'font-dyslexia-friendly',
  'monospace':         'font-monospace',
};

const THEME_CLASS: Record<string, string> = {
  'dark':          'theme-dark',
  'light':         'theme-light',
  'high-contrast': 'theme-high-contrast',
};

const TEXT_SIZE_BODY_CLASS: Record<string, string> = {
  sm: 'text-size-sm',
  md: 'text-size-md',
  lg: 'text-size-lg',
  xl: 'text-size-xl',
};

// All classes this component ever writes — used for clean removal on change.
const ALL_THEME_CLASSES   = Object.values(THEME_CLASS);
const ALL_FONT_CLASSES    = Object.values(FONT_CLASS).filter(Boolean);
const ALL_TSSIZE_CLASSES  = Object.values(TEXT_SIZE_BODY_CLASS);
const COLORBLIND_CLASS    = 'colorblind-mode';
const REDUCE_MOTION_CLASS = 'reduce-motion';

export function ThemeProvider() {
  const { theme, font, textSize, colorScheme, reduceMotion } = useUIPreferencesStore();

  useEffect(() => {
    const root = document.documentElement;

    // ── Theme ─────────────────────────────────────────────────
    root.classList.remove(...ALL_THEME_CLASSES);
    const themeClass = THEME_CLASS[theme];
    if (themeClass) root.classList.add(themeClass);

    // ── Font ──────────────────────────────────────────────────
    root.classList.remove(...ALL_FONT_CLASSES);
    const fontClass = FONT_CLASS[font];
    if (fontClass) root.classList.add(fontClass);

    // ── Text size ─────────────────────────────────────────────
    root.classList.remove(...ALL_TSSIZE_CLASSES);
    root.classList.add(TEXT_SIZE_BODY_CLASS[textSize] ?? TEXT_SIZE_BODY_CLASS.md);

    // ── Colorblind mode ───────────────────────────────────────
    root.classList.toggle(COLORBLIND_CLASS, colorScheme === 'colorblind');

    // ── Reduced motion ────────────────────────────────────────
    root.classList.toggle(REDUCE_MOTION_CLASS, reduceMotion);
  }, [theme, font, textSize, colorScheme, reduceMotion]);

  // Tailwind's utility text-size-* classes applied to body via Tailwind's
  // text-{size} utility — map separately so Tailwind purge picks them up.
  useEffect(() => {
    const bodyClass = TEXT_SIZE_CLASSES[textSize];
    if (bodyClass) {
      document.body.className = document.body.className
        .split(' ')
        .filter((c) => !c.startsWith('text-'))
        .concat(bodyClass)
        .join(' ')
        .trim();
    }
  }, [textSize]);

  return null; // purely behavioural — renders nothing
}
