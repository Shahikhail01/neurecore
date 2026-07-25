/**
 * Palette — every color used by the visualization system lives here.
 *
 * SOLID: OCP — new accent palettes are new entries; nothing else changes.
 * Single Responsibility — this file owns *color intent*, nothing else.
 *
 * All values reference CSS variables declared in visual.css so consumers
 * never hardcode a color string. Library props (recharts, d3) that require
 * literal strings must use the readCssVar() helper from `tokens/cssVar.ts`.
 */

export type AccentPalette =
  | 'violet'
  | 'cyan'
  | 'amber'
  | 'emerald'
  | 'rose'
  | 'blue';

export type SurfaceIntent =
  | 'hero'
  | 'panel'
  | 'modal'
  | 'tile'
  | 'inline'
  | 'auth';

export interface AccentRamp {
  /** Soft glow color (low alpha) — used in ambient blobs. */
  glow: string;
  /** Mid stop — used for borders / dividers. */
  border: string;
  /** Solid — used for active states, focused chips. */
  solid: string;
  /** Text-readable foreground against `solid`. */
  fg: string;
  /** Tailwind class for text-* with this accent. */
  textClass: string;
  /** Tailwind class for bg-* with this accent at low alpha (for glass tint). */
  bgClass: string;
}

/**
 * Accent ramps. The string values reference CSS variables defined in
 * visual.css — never hex literals — so theming and accessibility modes
 * propagate automatically.
 */
export const ACCENTS: Record<AccentPalette, AccentRamp> = {
  violet: {
    glow: 'var(--visual-glow-violet)',
    border: 'var(--accent-500)',
    solid: 'var(--accent-500)',
    fg: 'var(--visual-fg-on-accent)',
    textClass: 'text-[color:var(--accent-500)]',
    bgClass: 'bg-[color:var(--accent-500)]',
  },
  cyan: {
    glow: 'var(--visual-glow-cyan)',
    border: 'var(--visual-accent-cyan-500)',
    solid: 'var(--visual-accent-cyan-500)',
    fg: 'var(--visual-fg-on-accent)',
    textClass: 'text-[color:var(--visual-accent-cyan-500)]',
    bgClass: 'bg-[color:var(--visual-accent-cyan-500)]',
  },
  amber: {
    glow: 'var(--visual-glow-amber)',
    border: 'var(--visual-accent-amber-500)',
    solid: 'var(--visual-accent-amber-500)',
    fg: 'var(--visual-fg-on-accent)',
    textClass: 'text-[color:var(--visual-accent-amber-500)]',
    bgClass: 'bg-[color:var(--visual-accent-amber-500)]',
  },
  emerald: {
    glow: 'var(--visual-glow-emerald)',
    border: 'var(--visual-accent-emerald-500)',
    solid: 'var(--visual-accent-emerald-500)',
    fg: 'var(--visual-fg-on-accent)',
    textClass: 'text-[color:var(--visual-accent-emerald-500)]',
    bgClass: 'bg-[color:var(--visual-accent-emerald-500)]',
  },
  rose: {
    glow: 'var(--visual-glow-rose)',
    border: 'var(--visual-accent-rose-500)',
    solid: 'var(--visual-accent-rose-500)',
    fg: 'var(--visual-fg-on-accent)',
    textClass: 'text-[color:var(--visual-accent-rose-500)]',
    bgClass: 'bg-[color:var(--visual-accent-rose-500)]',
  },
  blue: {
    glow: 'var(--visual-glow-blue)',
    border: 'var(--visual-accent-blue-500)',
    solid: 'var(--visual-accent-blue-500)',
    fg: 'var(--visual-fg-on-accent)',
    textClass: 'text-[color:var(--visual-accent-blue-500)]',
    bgClass: 'bg-[color:var(--visual-accent-blue-500)]',
  },
};

/**
 * The "default" accent used when a caller doesn't pick one.
 * Mirrors the existing Creatio-violet identity in tenant + admin.
 */
export const DEFAULT_ACCENT: AccentPalette = 'violet';