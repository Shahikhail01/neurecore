'use client';

/**
 * GlassPanel — the ONLY glass surface in the monorepo.
 *
 * SOLID: SRP — owns glass surface styling, nothing else.
 * SOLID: OCP — new variants added by editing visual.css + visual.config.
 * SOLID: DIP — consumers depend on this component, not on raw class strings.
 */

import { forwardRef, type ReactNode, type HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getSurfacePreset } from '../config/visual.config';
import type { SurfaceIntent, AccentPalette } from '../tokens/palette';
import { DEFAULT_ACCENT } from '../tokens/palette';

export type GlassVariant = SurfaceIntent;
export type GlassAccent = AccentPalette;

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** Visual intent — drives the surface class. */
  variant?: GlassVariant;
  /** Accent palette — drives the glow ring + blob colour. */
  accent?: GlassAccent;
  /** Padding scale; 'none' for full-bleed layouts. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Whether to render an interactive hover treatment. */
  interactive?: boolean;
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel(
    {
      children,
      variant = 'panel',
      accent = DEFAULT_ACCENT,
      padding = 'md',
      interactive = false,
      className,
      ...rest
    },
    ref,
  ) {
    const preset = getSurfacePreset(variant, accent, padding);
    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(preset.className, interactive && 'cursor-pointer'),
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);