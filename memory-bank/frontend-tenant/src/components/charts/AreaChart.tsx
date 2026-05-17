'use client';
// ─── Area Chart ───────────────────────────────────────────────────────────────
// L — Liskov: satisfies ChartProps<TimeSeriesPoint> — substitutable with LineChart
import {
  AreaChart as ReAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartSkeleton } from './ChartSkeleton';
import type { ChartProps, TimeSeriesPoint } from '@/types/ui.types';
import { format } from 'date-fns';

interface AreaChartProps extends ChartProps<TimeSeriesPoint> {
  color?: string;
  label?: string;
  dataKey?: string;
  xKey?: string;  // accepted for API compatibility; XAxis always uses formatted _label
}

export function AreaChart({
  data,
  loading = false,
  height = 200,
  className = '',
  color = '#3b82f6',
  label = 'Value',
  dataKey = 'value',
}: AreaChartProps) {
  if (loading) return <ChartSkeleton height={height} className={className} />;

  const formatted = data.map((d) => ({
    ...d,
    _label: (() => {
      try { return format(new Date(d.ts), 'HH:mm'); } catch { return d.ts; }
    })(),
  }));

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReAreaChart data={formatted} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="_label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#a1a1aa' }}
            itemStyle={{ color: color }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            name={label}
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${color.replace('#', '')})`}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
