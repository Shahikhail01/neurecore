'use client';
// ─── KPI Tile ─────────────────────────────────────────────────────────────────
// O — Open/Closed: extended via props (delta, sparkline, icon) without modification
// S — Single Responsibility: renders a single KPI metric tile only

import { motion } from 'framer-motion';
import { Sparkline } from '@/components/charts/Sparkline';
import { STATUS_BADGE_CLASS } from '@/types/ui.types';
import type { KpiTileProps, TimeSeriesPoint } from '@/types/ui.types';

interface ExtendedKpiTileProps extends KpiTileProps {
  sparkData?: TimeSeriesPoint[];
}

const COLOR_BG: Record<string, string> = {
  profit:   'border-status-profit/20 bg-status-profit/5',
  risk:     'border-status-risk/20 bg-status-risk/5',
  ops:      'border-status-ops/20 bg-status-ops/5',
  strategy: 'border-status-strategy/20 bg-status-strategy/5',
  warn:     'border-status-warn/20 bg-status-warn/5',
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

export function KpiTile({
  label,
  value,
  delta,
  deltaLabel,
  color,
  icon,
  loading = false,
  className = '',
  sparkData,
}: ExtendedKpiTileProps) {
  if (loading) {
    return (
      <div className={`rounded-2xl border border-surface-border bg-surface-raised p-5 animate-pulse ${className}`}>
        <div className="h-3 w-24 bg-surface-muted rounded mb-3" />
        <div className="h-8 w-16 bg-surface-muted rounded mb-2" />
        <div className="h-2 w-12 bg-surface-muted rounded" />
      </div>
    );
  }

  const deltaPositive = (delta ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-2xl border p-5 flex flex-col gap-2 ${COLOR_BG[color]} ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
        {icon && <span className="text-zinc-600">{icon}</span>}
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-3xl font-bold tabular-nums ${COLOR_VALUE[color]}`}>{value}</span>
        {delta !== undefined && (
          <span className={`text-xs font-medium mb-1 ${STATUS_BADGE_CLASS[color]} px-1.5 py-0.5 rounded`}>
            {deltaPositive ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>

      {(deltaLabel || sparkData) && (
        <div className="flex items-center justify-between gap-2">
          {deltaLabel && <span className="text-xs text-zinc-600">{deltaLabel}</span>}
          {sparkData && sparkData.length > 0 && (
            <Sparkline
              data={sparkData}
              color={COLOR_VALUE[color].replace('text-', '#').replace('status-profit', '22c55e').replace('status-risk', 'ef4444').replace('status-ops', '3b82f6').replace('status-strategy', 'a855f7').replace('status-warn', 'f59e0b').replace('zinc-100', 'f4f4f5')}
              height={28}
              className="flex-1 max-w-[80px]"
            />
          )}
        </div>
      )}
    </motion.div>
  );
}
