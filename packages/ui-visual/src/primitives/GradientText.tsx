'use client';

/**
 * GradientText — the ONLY gradient-text component.
 *
 * SOLID: SRP — owns gradient-text styling.
 * SOLID: OCP — new gradient palettes added as new variants.
 */

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export type GradientVariant = 'default' | 'cyan' | 'warm';

export interface GradientTextProps {
  children: ReactNode;
  variant?: GradientVariant;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'div';
  className?: string;
}

export function GradientText({
  children,
  variant = 'default',
  as: Tag = 'span',
  className,
}: GradientTextProps) {
  const variantClass =
    variant === 'cyan'
      ? 'nv-gradient-text-cyan'
      : variant === 'warm'
      ? 'nv-gradient-text-warm'
      : 'nv-gradient-text';
  return <Tag className={clsx(variantClass, className)}>{children}</Tag>;
}