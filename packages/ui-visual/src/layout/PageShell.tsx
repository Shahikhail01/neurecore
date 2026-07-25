'use client';

/**
 * PageShell — wraps page content with optional ambient backdrop + hero
 * gradient surface. The canonical "every page starts with this" primitive.
 *
 * SOLID: SRP — owns page-level layout (chrome, padding, ambient).
 */

import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { AmbientBackdrop } from '../primitives/AmbientBackdrop';
import type { AccentPalette } from '../tokens/palette';
import { DEFAULT_ACCENT } from '../tokens/palette';

export type PageShellVariant = 'default' | 'compact' | 'auth';

export interface PageShellProps {
  children: ReactNode;
  variant?: PageShellVariant;
  accent?: AccentPalette;
  /** Disable the ambient backdrop (useful when caller supplies their own). */
  noAmbient?: boolean;
  className?: string;
}

const VARIANT_CLASS: Record<PageShellVariant, string> = {
  default: 'nv-hero-gradient',
  compact: 'nv-hero-compact',
  auth: 'nv-hero-gradient',
};

const AMBIENT_LAYOUT = {
  default: 'hero',
  compact: 'top-bottom',
  auth: 'auth',
} as const;

export function PageShell({
  children,
  variant = 'default',
  accent = DEFAULT_ACCENT,
  noAmbient = false,
  className,
}: PageShellProps) {
  return (
    <div className={clsx('nv-page', VARIANT_CLASS[variant], className)}>
      {!noAmbient && <AmbientBackdrop layout={AMBIENT_LAYOUT[variant]} accent={accent} />}
      <div className="nv-page-content nv-stack">{children}</div>
    </div>
  );
}