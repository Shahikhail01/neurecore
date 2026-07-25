'use client';

/**
 * GlowIcon — icon tile with accent halo.
 *
 * SOLID: SRP — owns the icon-tile glow effect.
 */

import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import type { AccentPalette } from '../tokens/palette';
import { DEFAULT_ACCENT } from '../tokens/palette';

export interface GlowIconProps {
  children: ReactNode;
  accent?: AccentPalette;
  className?: string;
}

export function GlowIcon({ children, accent = DEFAULT_ACCENT, className }: GlowIconProps) {
  return (
    <div
      className={clsx(
        'nv-glow-icon',
        'inline-flex items-center justify-center',
        'w-12 h-12',
        `bg-[color:var(--visual-glow-${accent})]`,
        className,
      )}
    >
      {children}
    </div>
  );
}