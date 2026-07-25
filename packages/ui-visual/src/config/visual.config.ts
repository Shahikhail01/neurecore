/**
 * visual.config — the registry of every named surface preset.
 *
 * SOLID: OCP — adding a new visual style is a new entry here. Primitives
 * read this config and never hardcode class combinations.
 *
 * SOLID: DIP — primitives depend on this config (abstraction), not on the
 * raw class strings. We can swap the underlying classes (e.g. Tailwind →
 * CSS Modules) by editing only this file + visual.css.
 */

import type { AccentPalette, SurfaceIntent } from '../tokens/palette';

export interface SurfacePreset {
  intent: SurfaceIntent;
  accent: AccentPalette;
  /** Composed CSS class string. Source of truth is visual.css. */
  className: string;
  /** Whether the surface should render an ambient backdrop by default. */
  hasAmbient: boolean;
  /** Padding scale token. */
  padding: 'none' | 'sm' | 'md' | 'lg';
}

export type PresetKey = `${SurfaceIntent}.${AccentPalette}`;

const SURFACE_BASE: Record<SurfaceIntent, string> = {
  hero: 'nv-surface-hero',
  panel: 'nv-surface-panel',
  modal: 'nv-surface-modal',
  tile: 'nv-surface-tile',
  inline: 'nv-surface-inline',
  auth: 'nv-surface-auth',
};

const SURFACE_PADDING: Record<SurfacePreset['padding'], string> = {
  none: '',
  sm: 'nv-pad-sm',
  md: 'nv-pad-md',
  lg: 'nv-pad-lg',
};

/**
 * The complete registry. Adding a new (intent × accent) combination is one
 * entry — nothing else changes.
 */
const INTENTS: SurfaceIntent[] = ['hero', 'panel', 'modal', 'tile', 'inline', 'auth'];
const ACCENTS_LIST: AccentPalette[] = ['violet', 'cyan', 'amber', 'emerald', 'rose', 'blue'];

function buildPreset(intent: SurfaceIntent, accent: AccentPalette): SurfacePreset {
  return {
    intent,
    accent,
    className: `${SURFACE_BASE[intent]} ${SURFACE_PADDING['md']}`,
    hasAmbient: intent === 'hero' || intent === 'auth',
    padding: 'md',
  };
}

export const SURFACE_PRESETS: Record<PresetKey, SurfacePreset> = Object.fromEntries(
  INTENTS.flatMap((intent) =>
    ACCENTS_LIST.map((accent) => [`${intent}.${accent}` as PresetKey, buildPreset(intent, accent)]),
  ),
) as Record<PresetKey, SurfacePreset>;

/**
 * Lookup helper — small ISP-friendly function. Components depend on this
 * abstraction rather than indexing into the record directly.
 */
export function getSurfacePreset(
  intent: SurfaceIntent,
  accent: AccentPalette,
  padding: SurfacePreset['padding'] = 'md',
): SurfacePreset {
  const preset = SURFACE_PRESETS[`${intent}.${accent}`];
  return {
    ...preset,
    className: `${SURFACE_BASE[intent]} ${SURFACE_PADDING[padding]}`,
  };
}