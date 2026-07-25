/**
 * Spacing — every radius / shadow / blur used by primitives lives here.
 *
 * No primitive may declare its own padding or shadow. They compose from
 * the named tiers below so visual rhythm stays consistent globally.
 */

export const RADIUS = {
  /** Pills, chips. */
  pill: '9999px',
  /** Icon tiles. */
  lg: '16px',
  /** Cards, panels. */
  xl: '20px',
  /** Modals, large surfaces. */
  '2xl': '24px',
  /** Hero containers, top-level page shells. */
  '3xl': '32px',
} as const;

export type RadiusTier = keyof typeof RADIUS;

export const SHADOW = {
  /** Subtle elevation on flat cards. */
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 3px 0 rgb(0 0 0 / 0.1)',
  /** Default panel elevation. */
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  /** Floating tiles (glass). */
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.15), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  /** Modals. */
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.2), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  /** Hero glow. */
  glow: '0 0 40px -4px var(--visual-glow-shadow)',
} as const;

export const BLUR = {
  /** Tile blur. */
  sm: '8px',
  /** Panel blur. */
  md: '16px',
  /** Hero backdrop blur. */
  lg: '24px',
} as const;

export const SPACING = {
  pageX: '1rem',
  pageY: '1.5rem',
  pageXWide: '1.5rem',
  sectionGap: '1.5rem',
} as const;