'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { KpiTile } from '@/components/kpi/KpiTile';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { usePlatformKpis } from '@/hooks/usePlatformKpis';
import { usePlatformChartData } from '@/hooks/usePlatformChartData';
import { useTimeRange } from '@/hooks/useTimeRange';
import { adminMetricsService } from '@/services/admin-metrics.service';
import type { BarDataPoint } from '@/types/ui.types';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TenantRow {
  id: string;
  name: string;
  status: string;
  _count?: { users: number; agents?: number };
}

const QUICK_LINKS = [
  { label: 'Tenants', href: '/tenants', icon: '⬟', color: 'border-indigo-700/40 hover:border-indigo-500/60' },
  { label: 'Users', href: '/users', icon: '◫', color: 'border-blue-700/40 hover:border-blue-500/60' },
  { label: 'Agent Fleet', href: '/agents', icon: '◈', color: 'border-violet-700/40 hover:border-violet-500/60' },
  { label: 'Models', href: '/models', icon: '⬡', color: 'border-cyan-700/40 hover:border-cyan-500/60' },
  { label: 'Monitoring', href: '/monitoring', icon: '◻', color: 'border-emerald-700/40 hover:border-emerald-500/60' },
  { label: 'Security', href: '/security', icon: '◌', color: 'border-amber-700/40 hover:border-amber-500/60' },
  { label: 'Billing', href: '/billing', icon: '⬡', color: 'border-green-700/40 hover:border-green-500/60' },
  { label: 'Brain Map', href: '/brain', icon: '◈', color: 'border-purple-700/40 hover:border-purple-500/60' },
];

const RANGE_OPTIONS = [
  { label: '24 h', value: '24h' as const },
  { label: '7 d', value: '7d' as const },
  { label: '30 d', value: '30d' as const },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const user = useAdminAuth();
  const { kpis, loading: kpisLoading } = usePlatformKpis();
  const { range, setRange } = useTimeRange();
  const { data: taskData, loading: taskLoading } = usePlatformChartData('tasks', range);
  const { data: agentData, loading: agentLoading } = usePlatformChartData('agents', range);

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<BarDataPoint[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setTenantsLoading(true);
    try {
      const [tenantRes, costRes] = await Promise.all([
        api.get<{ data: { data: TenantRow[] } }>('/tenants?limit=10'),
        adminMetricsService.getTenantCostBreakdown(),
      ]);
      setTenants(unwrapList(tenantRes).items as TenantRow[]);
      setCostBreakdown(costRes);
    } catch {
      setTenants([]);
    } finally {
      setTenantsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Header ── */}
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Platform Overview</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Mission control for the NeureCore platform</p>
        </div>

        {/* ── KPI tiles ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile label="Active Tenants" value={kpis?.activeTenants ?? '—'} delta={kpis?.totalTenants} deltaLabel="total" color="ops" loading={kpisLoading} />
          <KpiTile label="Running Agents" value={kpis?.runningAgents ?? '—'} delta={kpis?.totalAgents} deltaLabel="total" color="strategy" loading={kpisLoading} />
          <KpiTile label="Success Rate" value={kpis ? `${kpis.successRate}%` : '—'} color="profit" loading={kpisLoading} />
          <KpiTile label="Platform Cost" value={kpis ? `$${kpis.totalCostUsd.toFixed(0)}` : '—'} color="warn" loading={kpisLoading} />
        </div>

        {/* ── Quick nav ── */}
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl border ${link.color} bg-surface-raised p-3 flex flex-col items-center gap-1.5 transition group`}
            >
              <span className="text-lg group-hover:scale-110 transition-transform">{link.icon}</span>
              <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition">{link.label}</span>
            </Link>
          ))}
        </div>

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-200">Platform Task Volume</h3>
              <div className="flex gap-1">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRange(opt.value)}
                    className={`px-2.5 py-1 rounded-md text-xs transition ${range === opt.value ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <AreaChart data={taskData} dataKey="value" xKey="timestamp" color="#6366f1" loading={taskLoading} height={180} />
          </div>

          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">Cost by Tenant</h3>
            <BarChart data={costBreakdown} dataKey="value" xKey="label" loading={tenantsLoading} height={180} />
          </div>
        </div>

        {/* ── Tenant list ── */}
        <div className="rounded-xl border border-surface-border bg-surface-raised">
          <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Tenants</h3>
            <Link href="/tenants" className="text-xs text-indigo-400 hover:text-indigo-300 transition">
              View all →
            </Link>
          </div>
          {tenantsLoading ? (
            <div className="py-8 text-center text-zinc-500 text-xs">Loading…</div>
          ) : tenants.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">No tenants yet</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs text-zinc-500 uppercase border-b border-surface-border">
                  <th className="px-4 py-2.5 text-left font-medium">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Users</th>
                  <th className="px-4 py-2.5 text-left font-medium">Agents</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-surface-border hover:bg-surface-overlay transition"
                  >
                    <td className="px-4 py-2.5 text-sm">
                      <Link href={`/tenants/${t.id}`} className="text-zinc-200 hover:text-indigo-400 transition">
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        t.status === 'ACTIVE' ? 'bg-emerald-900 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400">{t._count?.users ?? 0}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400">{t._count?.agents ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

