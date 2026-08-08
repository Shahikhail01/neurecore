'use client';

/**
 * KpiCard — Creatio-style KPI tile
 *
 * Phase 2 primitive. Wraps the existing KpiTile with a Creatio visual:
 *   - Larger value text (2xl/3xl)
 *   - Subtle accent on hover
 *   - Optional sparkline right-aligned
 *   - Status-tinted border + background
 *
 * Open/Closed: extended via props (delta, sparkline, icon, color) without
 * modification of KpiTile.
 */

import { motion } from 'framer-motion';
import { Sparkline } from '@/components/charts/Sparkline';
import { STATUS_BADGE_CLASS } from '@/types/ui.types';
import type { KpiTileProps, TimeSeriesPoint } from '@/types/ui.types';

export interface KpiCardProps extends KpiTileProps {
  /** Optional sparkline data rendered on the right side. */
  sparkData?: TimeSeriesPoint[];
  /** Optional click handler — makes the card interactive. */
  onClick?: () => void;
}

const COLOR_BG: Record<string, string> = {
  profit:   'border-status-profit/30 bg-status-profit/5',
  risk:     'border-status-risk/30 bg-status-risk/5',
  ops:      'border-status-ops/30 bg-status-ops/5',
  strategy: 'border-status-strategy/30 bg-status-strategy/5',
  warn:     'border-status-warn/30 bg-status-warn/5',
  neutral:  'border-surface-border bg-surface-raised',
};

const COLOR_VALUE: Record<string, string> = {
  profit:   'text-status-profit',
  risk:     'text-status-risk',
  ops:      'text-status-ops',
  strategy: 'text-status-strategy',
  warn:     'text-status-warn',
  neutral:  'text-zinc-100',
};

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  color = 'neutral',
  icon,
  loading = false,
  className = '',
  sparkData,
  onClick,
}: KpiCardProps) {
  const baseClass = `card-surface ${COLOR_BG[color] ?? COLOR_BG.neutral} p-5 ${onClick ? 'card-interactive' : ''} ${className}`;

  if (loading) {
    return (
      <div className={`${baseClass} animate-pulse`}>
        <div className="h-3 w-24 bg-surface-muted rounded mb-3" />
        <div className="h-9 w-20 bg-surface-muted rounded mb-2" />
        <div className="h-2 w-12 bg-surface-muted rounded" />
      </div>
    );
  }

  return (
    <motion.div
      className={baseClass}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            {icon && <span className="text-base shrink-0">{icon}</span>}
            <p className="text-xs font-medium text-zinc-500 truncate">{label}</p>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${COLOR_VALUE[color] ?? COLOR_VALUE.neutral}`}>
            {value}
          </p>
          {(delta !== undefined || deltaLabel) && (
            <p className="text-xs text-zinc-500 mt-1.5">
              {delta !== undefined && (
                <span className={delta >= 0 ? 'text-status-profit' : 'text-status-risk'}>
                  {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}
                  {deltaLabel ? '' : '%'}
                </span>
              )}
              {delta && deltaLabel && <span className="ml-1">{deltaLabel}</span>}
            </p>
          )}
        </div>
        {sparkData && sparkData.length > 0 && (
          <div className="shrink-0 w-20 h-10 opacity-80">
            <Sparkline data={sparkData} />
          </div>
        )}
      </div>
    </motion.div>
  );
}