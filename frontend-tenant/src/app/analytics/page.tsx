'use client';

import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { KpiTile } from '@/components/kpi/KpiTile';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { useDashboardKpis } from '@/hooks/useDashboardKpis';
import { useChartData } from '@/hooks/useChartData';
import { useTimeRange } from '@/hooks/useTimeRange';

const RANGE_OPTIONS = [
  { label: '24 h', value: '24h' as const },
  { label: '7 d', value: '7d' as const },
  { label: '30 d', value: '30d' as const },
];

export default function AnalyticsPage() {
  const user = useTenantAuth();
  const { kpis, loading: kpisLoading } = useDashboardKpis();
  const { range, setRange } = useTimeRange();
  const { data: taskData, loading: taskLoading } = useChartData('tasks', range);
  const { data: errorData, loading: errorLoading } = useChartData('errors', range);
  const { data: costData, loading: costLoading } = useChartData('cost', range);
  const { data: agentData, loading: agentLoading } = useChartData('agents', range);

  const costDonut = [
    { name: 'Compute', value: 45, color: '#6366f1' },
    { name: 'Storage', value: 20, color: '#8b5cf6' },
    { name: 'API Calls', value: 30, color: '#06b6d4' },
    { name: 'Other', value: 5, color: '#3f3f46' },
  ];

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Analytics</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Operational intelligence for your agent workspace</p>
          </div>
          {/* Range selector */}
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  range === opt.value ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile label="Success Rate" value={kpis ? `${kpis.successRate}%` : '—'} color="profit" loading={kpisLoading} />
          <KpiTile label="Total Tasks" value={kpis?.totalTasks ?? '—'} color="ops" loading={kpisLoading} />
          <KpiTile label="Failed Tasks" value={kpis?.failedTasks ?? '—'} color="risk" loading={kpisLoading} />
          <KpiTile label="Avg Cost / Task" value={kpis?.avgCostPerTask != null ? `$${kpis.avgCostPerTask.toFixed(2)}` : '—'} color="strategy" loading={kpisLoading} />
        </div>

        {/* ── Charts grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Task volume */}
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">Task Volume</h3>
            <AreaChart data={taskData} dataKey="value" xKey="timestamp" color="#8b5cf6" loading={taskLoading} height={200} />
          </div>

          {/* Error rate */}
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">Error Rate</h3>
            <AreaChart data={errorData} dataKey="value" xKey="timestamp" color="#ef4444" loading={errorLoading} height={200} />
          </div>

          {/* Cost trend */}
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">Cost Trend (USD)</h3>
            <LineChart data={costData} dataKey="value" xKey="timestamp" color="#22c55e" loading={costLoading} height={200} />
          </div>

          {/* Active agent count */}
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">Active Agents</h3>
            <LineChart data={agentData} dataKey="value" xKey="timestamp" color="#06b6d4" loading={agentLoading} height={200} />
          </div>
        </div>

        {/* ── Cost breakdown + Eval quality ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">Cost Breakdown</h3>
            <DonutChart data={costDonut} nameKey="name" valueKey="value" loading={false} height={220} />
          </div>

          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">Evaluation Score Distribution</h3>
            <BarChart
              data={[
                { label: '90–100%', value: 24, color: '#22c55e' },
                { label: '70–89%', value: 38, color: '#06b6d4' },
                { label: '50–69%', value: 19, color: '#f59e0b' },
                { label: '< 50%', value: 8, color: '#ef4444' },
              ]}
              dataKey="value"
              xKey="label"
              loading={false}
              height={220}
            />
          </div>
        </div>
      </div>
    </TenantShell>
  );
}
