'use client';

/**
 * StatTile — glass KPI tile with per-accent inner glow.
 *
 * SOLID: SRP — owns the KPI tile presentation. Consumers pass label/value.
 */

import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { AccentPalette } from '../tokens/palette';
import { DEFAULT_ACCENT } from '../tokens/palette';
import { fadeInUp, mediumTransition } from '../tokens/motion';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: AccentPalette;
  loading?: boolean;
  className?: string;
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  accent = DEFAULT_ACCENT,
  loading = false,
  className,
}: StatTileProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      transition={mediumTransition}
      className={clsx(`nv-stat-tile nv-stat-tile-${accent}`, className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-zinc-400">{label}</div>
          <div className="mt-1 text-2xl font-bold text-zinc-100">
            {loading ? (
              <span className="inline-block w-16 h-6 rounded bg-white/10 animate-pulse" />
            ) : (
              value
            )}
          </div>
          {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
        </div>
        {icon && (
          <div
            className={clsx(
              'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
              `bg-[color:var(--visual-glow-${accent})]`,
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * StatRow — semantic grid wrapper for StatTiles.
 * Uses Tailwind grid (responsive) — composes from primitives.
 */
export interface StatRowProps {
  children: ReactNode;
  className?: string;
}

export function StatRow({ children, className }: StatRowProps) {
  return (
    <div className={clsx('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3', className)}>
      {children}
    </div>
  );
}