'use client';

/**
 * SectionHeader — eyebrow + gradient title for in-page sections.
 * Smaller / inline variant of PageHero (no ambient backdrop).
 */

import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { GradientText } from './GradientText';

export interface SectionHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div className={clsx('flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="nv-eyebrow mb-1">{eyebrow}</div>}
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          <GradientText>{title}</GradientText>
        </h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}