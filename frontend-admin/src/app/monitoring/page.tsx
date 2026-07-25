'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHero, GlassPanel } from '@neurecore/ui-visual';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { KpiTile } from '@/components/kpi/KpiTile';
import { AreaChart } from '@/components/charts/AreaChart';
import { LineChart } from '@/components/charts/LineChart';
import { usePlatformChartData } from '@/hooks/usePlatformChartData';
import { useTimeRange } from '@/hooks/useTimeRange';
import api from '@/services/api';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseMs: number;
  uptime?: string;
}

const STATUS_DOT: Record<string, string> = {
  healthy: 'bg-status-profit',
  degraded: 'bg-status-warn',
  down: 'bg-status-risk',
};
const STATUS_TEXT: Record<string, string> = {
  healthy: 'text-status-profit',
  degraded: 'text-status-warn',
  down: 'text-status-risk',
};

const RANGE_OPTIONS = [
  { label: '24 h', value: '24h' as const },
  { label: '7 d', value: '7d' as const },
  { label: '30 d', value: '30d' as const },
];

export default function MonitoringPage() {
  const user = useAdminAuth();
  const { range, setRange } = useTimeRange();
  const { data: errorData, loading: errorLoading } = usePlatformChartData('errors', range);
  const { data: taskData, loading: taskLoading } = usePlatformChartData('tasks', range);

  const [health, setHealth] = useState<HealthCheck[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await api.get('/health');
      // Normalize backend health response into HealthCheck[]
      const data = (res as any)?.data ?? res;
      const services: HealthCheck[] = [];
      if (typeof data === 'object') {
        for (const [key, val] of Object.entries(data)) {
          if (typeof val === 'object' && val !== null) {
            const v = val as Record<string, unknown>;
            services.push({
              service: key,
              status: (v.status as string === 'up' || v.status as string === 'ok') ? 'healthy' : v.status === 'degraded' ? 'degraded' : 'down',
              responseMs: typeof v.responseMs === 'number' ? v.responseMs : 0,
              uptime: typeof v.uptime === 'string' ? v.uptime : undefined,
            });
          }
        }
      }
      if (services.length === 0) {
        // Fallback: show API as healthy
        services.push({ service: 'api', status: 'healthy', responseMs: 0 });
      }
      setHealth(services);
    } catch {
      setHealth([{ service: 'api', status: 'down', responseMs: 0 }]);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const healthyCount = health.filter((h) => h.status === 'healthy').length;
  const downCount = health.filter((h) => h.status === 'down').length;

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <PageHero
        title="Monitoring"
        subtitle="Platform health and operational telemetry"
        actions={
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-2.5 py-1 rounded-md text-xs transition ${range === opt.value ? 'bg-[color:var(--accent-500)] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── KPI tiles ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile label="Healthy Services" value={healthyCount} delta={health.length} deltaLabel="total" color="profit" loading={healthLoading} />
          <KpiTile label="Down Services" value={downCount} color="risk" loading={healthLoading} />
          <KpiTile label="Error Rate" value="—" color="warn" loading={false} />
          <KpiTile label="Avg Latency" value="— ms" color="ops" loading={false} />
        </div>

        {/* ── Service health grid ── */}
        <div className="rounded-xl border border-surface-border bg-surface-raised">
          <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Service Health</h3>
            <button onClick={() => void fetchHealth()} className="text-xs text-zinc-500 hover:text-zinc-300 transition">Refresh</button>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {healthLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 rounded-lg border border-surface-border animate-pulse" />
              ))
            ) : (
              health.map((h) => (
                <div key={h.service} className="rounded-lg border border-surface-border bg-surface-overlay p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[h.status]}`} />
                    <span className="text-xs font-medium text-zinc-300 capitalize">{h.service}</span>
                  </div>
                  <p className={`text-xs font-medium ${STATUS_TEXT[h.status]}`}>{h.status}</p>
                  {h.responseMs > 0 && (
                    <p className="text-xs text-zinc-500 mt-0.5">{h.responseMs}ms</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">Error Rate Trend</h3>
            <AreaChart data={errorData} dataKey="value" xKey="timestamp" color="var(--state-danger)" loading={errorLoading} height={200} />
          </div>
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">Task Throughput</h3>
            <LineChart data={taskData} dataKey="value" xKey="timestamp" color="var(--accent-500)" loading={taskLoading} height={200} />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
