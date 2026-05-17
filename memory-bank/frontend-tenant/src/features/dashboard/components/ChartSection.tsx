'use client';
// ─── ChartSection.tsx ─────────────────────────────────────────────────────────
// SRP: Renders task-completion trend + agent performance charts.
// Uses native SVG — no external charting library required.

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { TrendPoint, AgentPerformanceTrend } from '@/shared/types/domain.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(values: number[], height: number): number[] {
  const max = Math.max(...values, 1);
  return values.map((v) => height - (v / max) * height);
}

function buildPolyline(xs: number[], ys: number[]): string {
  return xs.map((x, i) => `${x},${ys[i]}`).join(' ');
}

// ─── Spark Area Chart ─────────────────────────────────────────────────────────

interface SparkAreaProps {
  data: TrendPoint[];
  color?: string;
  label: string;
}

function SparkArea({ data, color = '#22c55e', label }: SparkAreaProps) {
  const W = 260;
  const H = 60;
  const PAD = 4;

  const ys = useMemo(() => normalize(data.map((d) => d.value), H - PAD * 2), [data]);
  const step = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : W - PAD * 2;
  const xs = data.map((_, i) => PAD + i * step);

  const line = buildPolyline(xs, ys.map((y) => y + PAD));
  const area = `${xs[0]},${H} ` + xs.map((x, i) => `${x},${ys[i] + PAD}`).join(' ') + ` ${xs[xs.length - 1]},${H}`;

  return (
    <svg
      width={W}
      height={H}
      aria-label={label}
      role="img"
      className="w-full"
      viewBox={`0 0 ${W} ${H}`}
    >
      <defs>
        <linearGradient id={`grad-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={area}
        fill={`url(#grad-${label.replace(/\s/g, '')})`}
      />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Bar Group (Agent Performance) ───────────────────────────────────────────

interface AgentBarProps {
  trends: AgentPerformanceTrend[];
}

function AgentBars({ trends }: AgentBarProps) {
  if (!trends.length) return null;

  return (
    <div className="flex flex-col gap-2" role="list" aria-label="Agent success rates">
      {trends.map((t) => (
        <div key={t.agentId} role="listitem" className="flex items-center gap-2">
          <span
            className="text-xs text-zinc-400 w-24 truncate flex-shrink-0"
            title={t.agentName}
          >
            {t.agentName}
          </span>
          <div className="flex-1 h-2 bg-surface-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                backgroundColor:
                  t.successRate >= 80
                    ? '#22c55e'
                    : t.successRate >= 60
                    ? '#eab308'
                    : '#ef4444',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${t.successRate}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className="text-xs tabular-nums text-zinc-500 w-9 text-right">
            {t.successRate.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-3 bg-surface-muted rounded w-1/3" />
      <div className="h-16 bg-surface-muted rounded" />
    </div>
  );
}

// ─── Public Component ─────────────────────────────────────────────────────────

interface ChartSectionProps {
  trends: TrendPoint[];
  agentTrends: AgentPerformanceTrend[];
  loading?: boolean;
}

export function ChartSection({ trends, agentTrends, loading = false }: ChartSectionProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Task Completion Trend */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-surface-raised rounded-xl p-4 border border-surface-border"
      >
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
          Task Completion Trend
        </h3>
        {trends.length > 0 ? (
          <>
            <SparkArea data={trends} color="#22c55e" label="Task completion trend" />
            <div className="flex justify-between mt-1">
              {[trends[0], trends[Math.floor(trends.length / 2)], trends[trends.length - 1]]
                .filter(Boolean)
                .map((p, i) => (
                  <span key={i} className="text-[10px] text-zinc-600">
                    {p!.label}
                  </span>
                ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-600 italic text-center py-4">No trend data available</p>
        )}
      </motion.div>

      {/* Agent Success Rates */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-surface-raised rounded-xl p-4 border border-surface-border"
      >
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
          Agent Success Rates
        </h3>
        {agentTrends.length > 0 ? (
          <AgentBars trends={agentTrends.slice(0, 6)} />
        ) : (
          <p className="text-sm text-zinc-600 italic text-center py-4">No agent data available</p>
        )}
      </motion.div>
    </div>
  );
}
