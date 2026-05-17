'use client';
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ChartSkeleton } from './ChartSkeleton';
import type { ChartProps, BarDataPoint } from '@/types/ui.types';

interface BarChartProps extends ChartProps<BarDataPoint> {
  color?: string;
  label?: string;
  formatValue?: (v: number) => string;
  dataKey?: string;  // accepted for API compatibility; internally uses BarDataPoint shape
  xKey?: string;    // accepted for API compatibility
}

export function BarChart({
  data,
  loading = false,
  height = 200,
  className = '',
  color = '#a855f7',
  label = 'Value',
  formatValue,
}: BarChartProps) {
  if (loading) return <ChartSkeleton height={height} className={className} />;

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatValue}
          />
          <YAxis
            dataKey="label"
            type="category"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={100}
          />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#a1a1aa' }}
            itemStyle={{ color: color }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => formatValue ? formatValue(v) : String(v)}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color ?? color} fillOpacity={0.85} />
            ))}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}
