'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartSkeleton } from './ChartSkeleton';
import type { ChartProps } from '@/types/ui.types';

export interface DonutSlice {
  label?: string;   // preferred key
  name?: string;    // alias accepted
  value: number;
  color: string;
}

const RADIAN = Math.PI / 180;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props as Record<string, number>;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  if (percent < 0.06) return null;
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

interface DonutChartProps extends ChartProps<DonutSlice> {
  innerRadius?: number;
  nameKey?: string;   // key used for slice display name (default: 'label')
  valueKey?: string;  // key used for slice value (default: 'value')
}

export function DonutChart({
  data,
  loading = false,
  height = 200,
  className = '',
  innerRadius = 55,
  nameKey = 'label',
  valueKey = 'value',
}: DonutChartProps) {
  // Normalise slices: support both `name` and `label` fields
  const normalised = data.map((d) => ({ ...d, label: d.label ?? d.name ?? '' }));
  if (loading) return <ChartSkeleton height={height} className={className} />;

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={normalised}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={innerRadius + 45}
            labelLine={false}
            label={renderLabel}
          >
            {normalised.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
            itemStyle={{ color: '#f4f4f5' }}
          />
          <Legend
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => <span style={{ color: '#a1a1aa', fontSize: 11 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
