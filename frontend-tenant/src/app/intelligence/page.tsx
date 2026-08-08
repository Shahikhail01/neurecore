'use client';

/**
 * /intelligence — Unified Intelligence page (Phase 8)
 *
 * Consolidates analytics + observability + health + reliability + security + settings.
 * 6 tabs:
 *   1. Analytics      — KPIs + 4 time-series charts + cost donut + eval quality
 *   2. Observability  — KPIs (latency, errors, requests) + activity timeline
 *   3. Health         — system health checks + circuit breakers
 *   4. Reliability    — quota usage + spending cap
 *   5. Security       — events + rate limits
 *   6. Settings       — user profile + AI providers + API keys (links to /settings)
 *
 * Layout (Creatio-style with 6 tabs):
 *   ┌─ Header ─────────────────────────────────────────────┐
 *   │  [BarChart3 icon] Intelligence                       │
 *   ├─ Tabs ────────────────────────────────────────────────┤
 *   │  Analytics │ Observability │ Health │ Reliability │
 *   │  Security │ Settings                              │
 *   ├─ Tab content ────────────────────────────────────────┤
 *   │  (active tab)                                       │
 *   └─────────────────────────────────────────────────────┘
 */

import { Fragment, useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Activity,
  HeartPulse,
  ShieldCheck,
  Shield,
  Settings,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Building2,
  Cpu,
  Wallet,
  Zap,
  Lock,
  Key,
  User,
  ExternalLink,
  RefreshCw,
  ArrowLeft,
  Globe,
  ShieldAlert,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react';

import { PageShell, PageHero } from '@neurecore/ui-visual';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { useAuthStore } from '@/stores/authStore';
import { useTenantIndustryGroup } from '@/stores/tenantStore';
import { authService } from '@/auth';
import TenantShell from '@/components/TenantShell';
import {
  IndustryDashboardRenderer,
  IndustryDashboardFallback,
} from '@/components/dashboard/IndustryDashboardRenderer';
import { KpiCard } from '@/components/creatio/KpiCard';
import { StatusBadge, type BadgeVariant } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { AreaChart } from '@/components/charts/AreaChart';
import { LineChart as LineChartComponent } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { useDashboardKpis } from '@/hooks/useDashboardKpis';
import { useChartData } from '@/hooks/useChartData';
import { useTimeRange } from '@/hooks/useTimeRange';
import api from '@/services/api';
import { commandCenterService, type CommandCenterSummary, type CommandCenterCosts, type CommandCenterModelHealth, type CommandCenterChannelHealth, type CommandCenterInventory, type CommandCenterQuality, type CommandCenterSecurityEvents, type CommandCenterKillSwitchList, type CommandCenterAuditCorrelation, type SetKillSwitchInput } from '@/services/command-center.service';
import type { AIRoutingConfig } from '@/types/settings.types';
import { DEFAULT_AI_ROUTING } from '@/types/settings.types';

// ─── Types ────────────────────────────────────────────────────────────────
type IntelTab = 'analytics' | 'observability' | 'health' | 'reliability' | 'security' | 'command-center' | 'settings';
type SettingsSubTab =
  | 'organization'
  | 'profile'
  | 'ai-providers'
  | 'apikeys'
  | 'security'
  | null;

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
}

interface CircuitBreaker {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount?: number;
  successCount?: number;
}

interface QuotaInfo {
  used: number;
  limit: number;
  unit: string;
  resetsAt?: string;
}

interface SecurityEvent {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  source?: string;
  createdAt: string;
}

interface ObservabilityLogEvent {
  id: string;
  type?: string;
  message?: string;
  severity?: string;
  status?: string;
  timestamp?: string;
  createdAt?: string;
}

interface ObservabilityTrace {
  taskId?: string;
  agentId?: string | null;
  startedAt?: string;
  completedAt?: string | null;
  steps?: Array<{
    status?: string;
    durationMs?: number | null;
  }>;
}

interface ObservabilityCostBreakdownItem {
  agentName?: string;
  model?: string;
  totalCost?: number;
  cost?: number;
  costUsd?: number;
}

interface ObservabilityCostsResponse {
  totalCost?: number;
  totalTokens?: number;
  byAgent?: ObservabilityCostBreakdownItem[];
}

interface ObservabilityMetricPoint {
  timestamp?: string;
  value?: number;
}

const TABS: { id: IntelTab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'analytics',     label: 'Analytics',     icon: BarChart3 },
  { id: 'observability', label: 'Observability', icon: Activity },
  { id: 'health',        label: 'Health',        icon: HeartPulse },
  { id: 'reliability',   label: 'Reliability',   icon: ShieldCheck },
  { id: 'security',      label: 'Security',      icon: Shield },
  { id: 'command-center',label: 'Command Center',icon: Cpu },
  { id: 'settings',      label: 'Settings',      icon: Settings },
];

const RANGE_OPTIONS = [
  { label: '24 h', value: '24h' as const },
  { label: '7 d',  value: '7d' as const },
  { label: '30 d', value: '30d' as const },
];

// ─── Page ─────────────────────────────────────────────────────────────────
export default function IntelligencePage() {
  const user = useTenantAuth();
  const [activeTab, setActiveTab] = useState<IntelTab>(() => {
    if (typeof window === 'undefined') return 'analytics';
    const t = new URL(window.location.href).searchParams.get('tab') as IntelTab | null;
    return (t && TABS.find((tab) => tab.id === t)) ? t : 'analytics';
  });
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>(() => {
    if (typeof window === 'undefined') return null;
    const sub = new URL(window.location.href).searchParams.get('settingsSub') as SettingsSubTab;
    return sub || null;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const aiTab = url.searchParams.get('aiTab');
    const t = url.searchParams.get('tab') as IntelTab | null;
    if (t === 'settings' && aiTab === 'routing') {
      setTimeout(() => {
        document.getElementById('ai-routing-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, []);

  const setTab = (t: IntelTab) => {
    setActiveTab(t);
    setSettingsSubTab(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', t);
      url.searchParams.delete('settingsSub');
      window.history.replaceState(null, '', url.toString());
    }
  };

  const handleSetSettingsSubTab = (sub: SettingsSubTab) => {
    setSettingsSubTab(sub);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (sub) {
        url.searchParams.set('tab', 'settings');
        url.searchParams.set('settingsSub', sub);
      } else {
        url.searchParams.delete('settingsSub');
      }
      window.history.replaceState(null, '', url.toString());
    }
  };

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <PageShell variant="default">
        <PageHero
          eyebrow="Operations"
          title="Intelligence"
          subtitle="Analytics, observability, health, reliability, and security — all in one place."
        />
      <div className="max-w-7xl mx-auto space-y-5">
        {/* ── Page Header ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="hidden"
        >
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-status-strategy/15 text-status-strategy flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            Intelligence
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Analytics, observability, health, reliability, and security — all in one place.
          </p>
        </motion.div>

        {/* ── Tab Navigation ──────────────────────────────────── */}
        <div className="border-b border-surface-border">
          <nav className="flex items-center gap-1 -mb-px overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    active
                      ? 'border-accent-500 text-zinc-100'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-surface-border'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Tab Content ─────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'analytics' && <AnalyticsTab />}
            {activeTab === 'observability' && <ObservabilityTab />}
            {activeTab === 'health' && <HealthTab />}
            {activeTab === 'reliability' && <ReliabilityTab />}
            {activeTab === 'security' && <SecurityTab />}
            {activeTab === 'command-center' && <CommandCenterTab />}
            {activeTab === 'settings' && <SettingsTab subTab={settingsSubTab} onSetSubTab={handleSetSettingsSubTab} />}
          </motion.div>
        </AnimatePresence>
      </div>
      </PageShell>
    </TenantShell>
  );
}

// ─── Tab 1: Analytics ─────────────────────────────────────────────────────
function AnalyticsTab() {
  const { industryGroup, loading: industryGroupLoading } = useTenantIndustryGroup();
  const { kpis, loading: kpisLoading } = useDashboardKpis();
  const { range, setRange } = useTimeRange();
  const { data: taskData, loading: taskLoading } = useChartData('tasks', range);
  const { data: errorData, loading: errorLoading } = useChartData('errors', range);
  const { data: costData, loading: costLoading } = useChartData('cost', range);
  const { data: agentData, loading: agentLoading } = useChartData('agents', range);

  if (industryGroup && !industryGroupLoading) {
    const metricValues: Record<string, { value: string | number }> = {};
    if (kpis) {
      if (typeof kpis.totalTasks === 'number') metricValues.totalTasks = { value: kpis.totalTasks };
      if (typeof kpis.failedTasks === 'number') metricValues.failedTasks = { value: kpis.failedTasks };
      if (typeof kpis.successRate === 'number') metricValues.successRate = { value: kpis.successRate };
    }
    return (
      <div className="space-y-5">
        <IndustryDashboardRenderer
          industryGroup={industryGroup}
          metricValues={metricValues}
        />
      </div>
    );
  }

  if (industryGroupLoading) {
    return (
      <div className="space-y-5">
        <IndustryDashboardFallback />
      </div>
    );
  }

  const costDonut = [
    { name: 'Compute',  value: 45, color: 'var(--accent-500)' },
    { name: 'Storage',  value: 20, color: 'var(--visual-glow-violet)' },
    { name: 'API Calls', value: 30, color: 'var(--visual-glow-cyan)' },
    { name: 'Other',    value: 5,  color: 'var(--visual-glow-cyan)' },
  ];

  return (
    <div className="space-y-5">
      {/* Toolbar with range selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-status-strategy" />
          Operational metrics
        </h2>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                range === opt.value
                  ? 'bg-accent-500 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay border border-surface-border'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Success Rate" value={kpis ? `${kpis.successRate}%` : '—'} color="profit" icon={<CheckCircle2 className="w-4 h-4" />} loading={kpisLoading} />
        <KpiCard label="Total Tasks" value={kpis?.totalTasks ?? '—'} color="ops" icon={<Activity className="w-4 h-4" />} loading={kpisLoading} />
        <KpiCard label="Failed Tasks" value={kpis?.failedTasks ?? '—'} color="risk" icon={<AlertTriangle className="w-4 h-4" />} loading={kpisLoading} />
        <KpiCard label="Avg Cost / Task" value={kpis?.avgCostPerTask != null ? `$${kpis.avgCostPerTask.toFixed(2)}` : '—'} color="warn" icon={<Wallet className="w-4 h-4" />} loading={kpisLoading} />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Task Volume" icon={<Activity className="w-4 h-4 text-status-ops" />}>
          <AreaChart data={taskData} dataKey="value" xKey="ts" color="var(--visual-glow-violet)" loading={taskLoading} height={200} />
        </ChartCard>
        <ChartCard title="Error Rate" icon={<AlertTriangle className="w-4 h-4 text-state-danger" />}>
          <AreaChart data={errorData} dataKey="value" xKey="ts" color="var(--state-danger)" loading={errorLoading} height={200} />
        </ChartCard>
        <ChartCard title="Cost Trend (USD)" icon={<Wallet className="w-4 h-4 text-state-success" />}>
          <LineChartComponent data={costData} dataKey="value" xKey="ts" color="var(--state-success)" loading={costLoading} height={200} />
        </ChartCard>
        <ChartCard title="Active Employees" icon={<Cpu className="w-4 h-4 text-status-strategy" />}>
          <LineChartComponent data={agentData} dataKey="value" xKey="ts" color="var(--visual-glow-cyan)" loading={agentLoading} height={200} />
        </ChartCard>
      </div>

      {/* Cost breakdown + eval quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Cost Breakdown" icon={<Wallet className="w-4 h-4 text-state-warning" />}>
          <DonutChart data={costDonut} nameKey="name" valueKey="value" loading={false} height={200} />
        </ChartCard>
        <ChartCard title="Evaluation Quality" icon={<CheckCircle2 className="w-4 h-4 text-state-profit" />}>
          <BarChart
            data={[
              { label: '0–50%', value: 5, color: 'var(--state-danger)' },
              { label: '50–70%', value: 12, color: 'var(--state-warning)' },
              { label: '70–85%', value: 38, color: 'var(--state-info)' },
              { label: '85–95%', value: 62, color: 'var(--state-success)' },
              { label: '95–100%', value: 28, color: 'var(--visual-glow-emerald)' },
            ]}
            dataKey="value"
            xKey="label"
            loading={false}
            height={200}
          />
        </ChartCard>
      </div>
    </div>
  );
}

// ─── Tab 2: Observability ────────────────────────────────────────────────
function ObservabilityTab() {
  const { range, setRange } = useTimeRange();
  const [latencyData, setLatencyData] = useState<Array<{ ts: string; value: number }>>([]);
  const [requestData, setRequestData] = useState<Array<{ ts: string; value: number }>>([]);
  const [events, setEvents] = useState<Array<{ id: string; type: string; message: string; severity: string; timestamp: string }>>([]);
  const [traceRows, setTraceRows] = useState<Array<{ id: string; agentLabel: string; stepCount: number; latencyMs: number; status: string; startedAt: string }>>([]);
  const [costRows, setCostRows] = useState<Array<{ label: string; cost: number }>>([]);
  const [summary, setSummary] = useState({
    avgLatencyMs: 0,
    requests: 0,
    errors: 0,
    throughputPerMinute: 0,
    totalCost: 0,
    totalTokens: 0,
  });
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const resolveWindow = useCallback(() => {
    const now = Date.now();
    const durationMs =
      range === '24h' ? 24 * 60 * 60 * 1000 :
      range === '7d' ? 7 * 24 * 60 * 60 * 1000 :
      30 * 24 * 60 * 60 * 1000;
    return {
      fromIso: new Date(now - durationMs).toISOString(),
      toIso: new Date(now).toISOString(),
      durationMs,
    };
  }, [range]);

  const fetchObservability = useCallback(async () => {
    setLoading(true);
    try {
      const { fromIso, toIso, durationMs } = resolveWindow();
      const [logsRes, tracesRes, costsRes, latencyRes, requestsRes] = await Promise.all([
        fetch('/api/v1/observability/logs?limit=30', { credentials: 'include' }),
        fetch('/api/v1/observability/traces?limit=12', { credentials: 'include' }),
        fetch(`/api/v1/observability/costs?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`, { credentials: 'include' }),
        fetch(`/api/v1/observability/metrics?name=latency&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&limit=96`, { credentials: 'include' }),
        fetch(`/api/v1/observability/metrics?name=requests&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&limit=96`, { credentials: 'include' }),
      ]);

      const logsJson = logsRes.ok ? await logsRes.json() : null;
      const tracesJson = tracesRes.ok ? await tracesRes.json() : null;
      const costsJson = costsRes.ok ? await costsRes.json() : null;
      const latencyJson = latencyRes.ok ? await latencyRes.json() : null;
      const requestsJson = requestsRes.ok ? await requestsRes.json() : null;

      const logs = (Array.isArray(logsJson?.data)
        ? logsJson.data
        : Array.isArray(logsJson?.data?.data)
        ? logsJson.data.data
        : []) as ObservabilityLogEvent[];
      const traces = (Array.isArray(tracesJson?.data)
        ? tracesJson.data
        : Array.isArray(tracesJson?.data?.data)
        ? tracesJson.data.data
        : []) as ObservabilityTrace[];
      const costs = (costsJson?.data ?? costsJson) as ObservabilityCostsResponse | null;
      const latencyPoints = (Array.isArray(latencyJson?.data)
        ? latencyJson.data
        : Array.isArray(latencyJson?.data?.data)
        ? latencyJson.data.data
        : []) as ObservabilityMetricPoint[];
      const requestPoints = (Array.isArray(requestsJson?.data)
        ? requestsJson.data
        : Array.isArray(requestsJson?.data?.data)
        ? requestsJson.data.data
        : []) as ObservabilityMetricPoint[];

      const normalizedLatency = latencyPoints
        .filter((point) => point.timestamp && typeof point.value === 'number')
        .map((point) => ({ ts: point.timestamp as string, value: point.value as number }));
      const normalizedRequests = requestPoints
        .filter((point) => point.timestamp && typeof point.value === 'number')
        .map((point) => ({ ts: point.timestamp as string, value: point.value as number }));
      const errorCount = logs.filter((event) => {
        const severity = (event.severity ?? '').toLowerCase();
        const status = (event.status ?? '').toLowerCase();
        return severity === 'error' || severity === 'critical' || status === 'failed' || status === 'error';
      }).length;
      const avgLatencyMs = normalizedLatency.length > 0
        ? Math.round(normalizedLatency.reduce((sum, point) => sum + point.value, 0) / normalizedLatency.length)
        : 0;
      const requestCount = normalizedRequests.reduce((sum, point) => sum + point.value, 0);
      const throughputPerMinute = durationMs > 0
        ? Number((requestCount / (durationMs / 60000)).toFixed(2))
        : 0;

      setLatencyData(normalizedLatency);
      setRequestData(normalizedRequests);
      setEvents(
        logs.map((event, index) => ({
          id: event.id ?? `log-${index}`,
          type: event.type ?? 'event',
          message: event.message ?? 'No message',
          severity: event.severity ?? 'info',
          timestamp: event.timestamp ?? event.createdAt ?? new Date().toISOString(),
        })),
      );
      setTraceRows(
        traces.map((trace, index) => {
          const steps = Array.isArray(trace.steps) ? trace.steps : [];
          const startedAt = trace.startedAt ?? new Date().toISOString();
          const completedAt = trace.completedAt ? new Date(trace.completedAt).getTime() : null;
          const startedAtMs = new Date(startedAt).getTime();
          const fallbackLatency = completedAt && startedAtMs ? Math.max(0, completedAt - startedAtMs) : 0;
          const stepLatency = steps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0);
          const latestStatus = steps.slice().reverse().find((step) => step.status)?.status ?? (trace.completedAt ? 'completed' : 'running');
          return {
            id: trace.taskId ?? `trace-${index}`,
            agentLabel: trace.agentId ?? 'Unassigned',
            stepCount: steps.length,
            latencyMs: stepLatency || fallbackLatency,
            status: latestStatus.toUpperCase(),
            startedAt,
          };
        }),
      );
      setCostRows(
        (costs?.byAgent ?? [])
          .map((item, index) => ({
            label: item.agentName ?? item.model ?? `Item ${index + 1}`,
            cost: Number((item.totalCost ?? item.costUsd ?? item.cost ?? 0).toFixed(4)),
          }))
          .filter((item) => item.cost > 0)
          .slice(0, 6),
      );
      setSummary({
        avgLatencyMs,
        requests: Math.round(requestCount),
        errors: errorCount,
        throughputPerMinute,
        totalCost: Number((costs?.totalCost ?? 0).toFixed(4)),
        totalTokens: costs?.totalTokens ?? 0,
      });
    } catch {
      setLatencyData([]);
      setRequestData([]);
      setEvents([]);
      setTraceRows([]);
      setCostRows([]);
      setSummary({
        avgLatencyMs: 0,
        requests: 0,
        errors: 0,
        throughputPerMinute: 0,
        totalCost: 0,
        totalTokens: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [resolveWindow]);

  useEffect(() => { void fetchObservability(); }, [fetchObservability]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void fetchObservability();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, fetchObservability]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-status-ops" />
          Live observability
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-surface-border bg-surface-overlay"
            />
            Auto refresh
          </label>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  range === opt.value
                    ? 'bg-accent-500 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay border border-surface-border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchObservability()}>
            Refresh
          </ActionButton>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Avg Latency" value={`${summary.avgLatencyMs}ms`} color="ops" icon={<Zap className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Requests" value={summary.requests} color="profit" icon={<Activity className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Errors" value={summary.errors} color="risk" icon={<AlertTriangle className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Throughput" value={`${summary.throughputPerMinute}/min`} color="strategy" icon={<TrendingUp className="w-4 h-4" />} loading={loading} />
      </div>

      {/* Latency + request charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="P95 Latency (ms)" icon={<Zap className="w-4 h-4 text-status-ops" />}>
          <LineChartComponent data={latencyData} dataKey="value" xKey="ts" color="var(--state-info)" loading={loading} height={200} />
        </ChartCard>
        <ChartCard title="Requests / minute" icon={<Activity className="w-4 h-4 text-state-success" />}>
          <AreaChart data={requestData} dataKey="value" xKey="ts" color="var(--state-success)" loading={loading} height={200} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-surface">
          <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent-400" />
              Recent traces
            </h3>
            <span className="text-xs text-zinc-500">{traceRows.length} traces</span>
          </div>
          <div className="divide-y divide-surface-border max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-zinc-500 text-xs">Loading…</div>
            ) : traceRows.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">No traces available</div>
            ) : (
              traceRows.map((trace) => (
                <div key={trace.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{trace.agentLabel}</p>
                      <p className="text-xs text-zinc-500">{trace.stepCount} steps • {new Date(trace.startedAt).toLocaleString()}</p>
                    </div>
                    <StatusBadge
                      status={trace.status === 'COMPLETED' ? 'COMPLETED' : trace.status === 'FAILED' ? 'FAILED' : 'RUNNING'}
                      label={trace.status}
                    />
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">
                    Latency {trace.latencyMs}ms
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card-surface">
          <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-state-warning" />
              Cost hotspots
            </h3>
            <span className="text-xs text-zinc-500">
              ${summary.totalCost.toFixed(4)} • {summary.totalTokens.toLocaleString()} tokens
            </span>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="p-4 text-center text-zinc-500 text-xs">Loading…</div>
            ) : costRows.length === 0 ? (
              <div className="p-4 text-center text-zinc-500 text-xs">No cost activity available</div>
            ) : (
              <BarChart
                data={costRows.map((row) => ({ label: row.label, value: row.cost, color: 'var(--state-warning)' }))}
                dataKey="value"
                xKey="label"
                loading={false}
                height={220}
              />
            )}
          </div>
        </div>
      </div>

      {/* Event stream */}
      <div className="card-surface">
        <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-state-info" />
            Event stream
          </h3>
          <span className="text-xs text-zinc-500">{events.length} events</span>
        </div>
        <div className="divide-y divide-surface-border max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-xs">Loading…</div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">No events yet</div>
          ) : (
            events.map((e) => (
              <div key={e.id} className="px-5 py-2.5 text-xs flex items-center gap-3">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  e.severity === 'error' ? 'bg-state-danger' :
                  e.severity === 'warn' ? 'bg-state-warning' :
                  'bg-state-info'
                }`} />
                <span className="font-mono text-zinc-500 w-32 shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
                <span className="font-medium text-zinc-300">{e.type}</span>
                <span className="text-zinc-500 truncate">{e.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Health ────────────────────────────────────────────────────────
function HealthTab() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [breakers, setBreakers] = useState<CircuitBreaker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, breakersRes] = await Promise.all([
        fetch('/api/v1/health/system', { credentials: 'include' }),
        fetch('/api/v1/health/circuit-breakers', { credentials: 'include' }),
      ]);

      if (healthRes.ok) {
        const data = await healthRes.json();
        const sysData = data?.data ?? {};
        const list: HealthCheck[] = [
          { service: 'Database',     status: sysData.database === 'up' ? 'healthy' : 'degraded', latencyMs: sysData.dbLatencyMs },
          { service: 'Redis',        status: sysData.redis === 'up' ? 'healthy' : 'degraded' },
          { service: 'Queue',        status: sysData.queue === 'up' ? 'healthy' : 'degraded' },
          { service: 'AI Gateway',   status: sysData.aiGateway === 'up' ? 'healthy' : 'degraded' },
        ];
        setChecks(list);
      }

      if (breakersRes.ok) {
        const data = await breakersRes.json();
        setBreakers(Array.isArray(data?.data) ? data.data : []);
      }
    } catch {
      setChecks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchHealth(); }, [fetchHealth]);

  const healthyCount = checks.filter((c) => c.status === 'healthy').length;
  const unhealthyCount = checks.filter((c) => c.status === 'unhealthy').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-state-success" />
          System health
        </h2>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchHealth()}>
          Refresh
        </ActionButton>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Services" value={checks.length} color="ops" loading={loading} />
        <KpiCard label="Healthy" value={healthyCount} color="profit" loading={loading} />
        <KpiCard label="Degraded" value={checks.filter((c) => c.status === 'degraded').length} color="warn" loading={loading} />
        <KpiCard label="Unhealthy" value={unhealthyCount} color="risk" loading={loading} />
      </div>

      {/* Service health */}
      <div className="card-surface">
        <div className="px-5 py-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-zinc-200">Service status</h3>
        </div>
        <div className="divide-y divide-surface-border">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-xs">Loading…</div>
          ) : checks.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">No service data available</div>
          ) : (
            checks.map((c) => (
              <div key={c.service} className="flex items-center gap-3 px-5 py-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  c.status === 'healthy' ? 'bg-state-success' :
                  c.status === 'degraded' ? 'bg-state-warning animate-pulse' :
                  'bg-state-danger'
                }`} />
                <span className="text-sm font-medium text-zinc-200 flex-1">{c.service}</span>
                {c.latencyMs != null && (
                  <span className="text-xs font-mono text-zinc-500">{c.latencyMs}ms</span>
                )}
                <StatusBadge status={c.status === 'healthy' ? 'ACTIVE' : c.status === 'degraded' ? 'WARNING' : 'FAILED'} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Circuit breakers */}
      <div className="card-surface">
        <div className="px-5 py-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-zinc-200">Circuit breakers</h3>
        </div>
        <div className="divide-y divide-surface-border">
          {breakers.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No circuit breakers configured
            </div>
          ) : (
            breakers.map((b) => (
              <div key={b.name} className="flex items-center gap-3 px-5 py-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  b.state === 'CLOSED' ? 'bg-state-success' :
                  b.state === 'HALF_OPEN' ? 'bg-state-warning animate-pulse' :
                  'bg-state-danger'
                }`} />
                <span className="text-sm font-medium text-zinc-200 flex-1">{b.name}</span>
                {b.failureCount != null && (
                  <span className="text-xs font-mono text-zinc-500">{b.failureCount} fail / {b.successCount ?? 0} ok</span>
                )}
                <StatusBadge status={b.state === 'CLOSED' ? 'ACTIVE' : b.state === 'HALF_OPEN' ? 'WARNING' : 'FAILED'} label={b.state} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Reliability ──────────────────────────────────────────────────
function ReliabilityTab() {
  const [quotas, setQuotas] = useState<QuotaInfo[]>([]);
  const [spendingCap, setSpendingCap] = useState<{ used: number; cap: number; currency: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [quotaRes, capRes] = await Promise.all([
        window.fetch('/api/v1/reliability/quota', { credentials: 'include' }),
        window.fetch('/api/v1/reliability/spending-cap', { credentials: 'include' }),
      ]);

      if (quotaRes.ok) {
        const data = await quotaRes.json();
        const list = Array.isArray(data?.data) ? data.data : [];
        setQuotas(list);
      }
      if (capRes.ok) {
        const data = await capRes.json();
        setSpendingCap(data?.data ?? null);
      }
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-state-info" />
          Reliability & quotas
        </h2>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchAll()}>
          Refresh
        </ActionButton>
      </div>

      {/* Spending cap */}
      {spendingCap && (
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-200">Monthly spending cap</h3>
            <span className="text-2xl font-bold text-zinc-100">
              ${spendingCap.used.toFixed(2)} <span className="text-sm text-zinc-500 font-normal">/ ${spendingCap.cap.toFixed(2)}</span>
            </span>
          </div>
          <div className="h-3 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className={`h-full transition-all ${
                (spendingCap.used / spendingCap.cap) > 0.8
                  ? 'bg-state-danger'
                  : (spendingCap.used / spendingCap.cap) > 0.5
                  ? 'bg-state-warning'
                  : 'bg-accent-500'
              }`}
              style={{ width: `${Math.min(100, (spendingCap.used / spendingCap.cap) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            {((spendingCap.used / spendingCap.cap) * 100).toFixed(1)}% of monthly budget used
          </p>
        </div>
      )}

      {/* Quota list */}
      <div className="card-surface">
        <div className="px-5 py-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-zinc-200">Resource quotas</h3>
        </div>
        <div className="divide-y divide-surface-border">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-xs">Loading…</div>
          ) : quotas.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">No quota data available</div>
          ) : (
            quotas.map((q, idx) => {
              const pct = (q.used / q.limit) * 100;
              return (
                <div key={idx} className="px-5 py-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-zinc-300">{q.unit}</span>
                    <span className="font-mono text-zinc-500">
                      {q.used.toLocaleString()} / {q.limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        pct > 80 ? 'bg-state-danger' : pct > 50 ? 'bg-state-warning' : 'bg-accent-500'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 5: Security ──────────────────────────────────────────────────────
function SecurityTab() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'critical' | 'high' | 'medium' | 'low'>('ALL');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/security/events?limit=100', {
        credentials: 'include',
      });
      if (!res.ok) { setEvents([]); return; }
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      setEvents(list);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchEvents(); }, [fetchEvents]);

  const visible = events.filter((e) => severityFilter === 'ALL' || e.severity === severityFilter);
  const criticalCount = events.filter((e) => e.severity === 'critical').length;

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'text-state-danger';
      case 'high':     return 'text-state-warning';
      case 'medium':   return 'text-state-info';
      default:         return 'text-zinc-400';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-state-danger" />
          Security events
        </h2>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchEvents()}>
          Refresh
        </ActionButton>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total" value={events.length} color="ops" loading={loading} />
        <KpiCard label="Critical" value={criticalCount} color="risk" loading={loading} />
        <KpiCard label="High" value={events.filter((e) => e.severity === 'high').length} color="warn" loading={loading} />
        <KpiCard label="Medium" value={events.filter((e) => e.severity === 'medium').length} color="neutral" loading={loading} />
      </div>

      {/* Severity filter */}
      <div className="flex gap-1">
        {(['ALL', 'critical', 'high', 'medium', 'low'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
              severityFilter === s
                ? 'bg-accent-500 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay border border-surface-border'
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Events list */}
      {loading ? (
        <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Shield className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">
            {events.length === 0 ? 'No security events' : 'No events match your filter'}
          </p>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
            Security events (auth attempts, rate-limit hits, suspicious activity) appear here.
          </p>
        </div>
      ) : (
        <div className="card-surface divide-y divide-surface-border">
          {visible.map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-4 py-3">
              <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${severityColor(e.severity)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-zinc-200">{e.type}</p>
                  <StatusBadge status={e.severity === 'critical' ? 'FAILED' : e.severity === 'high' ? 'WARNING' : 'INFO'} label={e.severity} />
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{e.description}</p>
                <p className="text-[10px] text-zinc-600 mt-1">
                  {new Date(e.createdAt).toLocaleString()}
                  {e.source && ` · ${e.source}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 6: Settings ─────────────────────────────────────────────────────
function SettingsTab({ subTab, onSetSubTab }: { subTab: SettingsSubTab; onSetSubTab: (sub: SettingsSubTab) => void }) {
  const user = useTenantAuth();

  const sections = [
    {
      title: 'Organization',
      icon: Building2,
      description:
        'Tenant profile, industry, sub-industry, subscription tier, and locale',
      sub: 'organization' as const,
      color: 'bg-accent-500/15 text-accent-500',
    },
    {
      title: 'Profile',
      icon: User,
      description: 'Update your name and password',
      sub: 'profile' as const,
      color: 'bg-accent-500/15 text-accent-500',
    },
    {
      title: 'AI Providers',
      icon: Cpu,
      description: 'Configure OpenAI, Anthropic, DeepSeek, and other LLM providers',
      sub: 'ai-providers' as const,
      color: 'bg-state-info/15 text-state-info',
    },
    {
      title: 'API Keys',
      icon: Key,
      description: 'Manage API keys for programmatic access',
      sub: 'apikeys' as const,
      color: 'bg-state-warning/15 text-state-warning',
    },
    {
      title: 'Security & Access',
      icon: Lock,
      description: 'Security status, rate limits, and recent events',
      sub: 'security' as const,
      color: 'bg-state-danger/15 text-state-danger',
    },
    {
      title: 'Integrations',
      icon: Globe,
      description: 'Connect Google Workspace, Brevo, Slack, Microsoft 365',
      sub: 'integrations' as const,
      color: 'bg-state-success/15 text-state-success',
    },
  ];

  if (subTab) {
    return (
      <div className="space-y-5">
        <button
          onClick={() => onSetSubTab(null)}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Settings
        </button>
        {subTab === 'organization' && <OrganizationDetail onBack={() => onSetSubTab(null)} />}
        {subTab === 'profile' && <ProfileDetail user={user} onBack={() => onSetSubTab(null)} />}
        {subTab === 'ai-providers' && <AIProvidersDetail />}
        {subTab === 'apikeys' && <APIKeysDetail />}
        {subTab === 'security' && <SecuritySettingsDetail />}
        {!['organization', 'profile', 'ai-providers', 'apikeys', 'security'].includes(subTab) && (
          <div className="card-surface p-8 text-center text-zinc-500 text-sm">
            Unknown settings section.{' '}
            <button onClick={() => onSetSubTab(null)} className="text-accent-500 underline cursor-pointer">Go back</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Settings className="w-4 h-4 text-zinc-400" />
          Settings
        </h2>
      </div>

      <div className="card-surface p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-accent-500 flex items-center justify-center text-white font-semibold">
            {(user?.firstName?.[0] ?? user?.email[0] ?? '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              Role: <span className="font-medium">{user?.role}</span>
            </p>
          </div>
          <button
            onClick={() => onSetSubTab('profile')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-surface-border text-zinc-300 hover:bg-surface-overlay transition"
          >
            Edit profile
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.title}
              onClick={() => {
                if (s.sub === 'integrations') {
                  window.location.href = '/settings/integrations';
                } else {
                  onSetSubTab(s.sub);
                }
              }}
              className="card-surface card-interactive p-5 flex items-start gap-3 text-left w-full"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-100">{s.title}</h3>
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{s.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <AIRoutingSection />
    </div>
  );
}

// ─── Settings Detail: Organization ────────────────────────────────────────
function OrganizationDetail({ onBack: _onBack }: { onBack: () => void }) {
  const [tenant, setTenant] = useState<{
    name: string;
    slug: string;
    industry: string | null;
    industryGroup: string | null;
    tier: { slug: string; name: string } | null;
    status: string;
    locale: string | null;
    timezone: string | null;
    currency: string | null;
    dateFormat: string | null;
    timeFormat: string | null;
    createdAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await api.get('/tenants/me/current');
        const data = res.data?.data ?? res.data ?? null;
        if (alive) setTenant(data);
      } catch (e) {
        if (alive) setError('Failed to load tenant profile');
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="card-surface p-5 text-sm text-zinc-400">
        Loading organization profile…
      </div>
    );
  }
  if (error || !tenant) {
    return (
      <div className="card-surface p-5 text-sm text-state-danger">
        {error ?? 'Tenant profile unavailable'}
      </div>
    );
  }

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Organization name', value: tenant.name },
    {
      label: 'Industry',
      value: tenant.industry ? (
        <span className="inline-flex items-center gap-1.5">
          {tenant.industry}
          {tenant.industryGroup && (
            <span className="text-[10px] text-zinc-500">
              ({tenant.industryGroup})
            </span>
          )}
        </span>
      ) : (
        <span className="text-zinc-500">— not selected</span>
      ),
    },
    {
      label: 'Subscription tier',
      value: tenant.tier ? (
        <span className="inline-flex items-center gap-1.5">
          {tenant.tier.name}{' '}
          <span className="text-[10px] text-zinc-500">({tenant.tier.slug})</span>
        </span>
      ) : (
        <span className="text-zinc-500">— basic</span>
      ),
    },
    { label: 'Status', value: tenant.status },
    {
      label: 'Locale',
      value: (
        <span>
          {tenant.locale ?? '—'} · {tenant.timezone ?? '—'} ·{' '}
          {tenant.currency ?? '—'} · {tenant.dateFormat ?? '—'} ·{' '}
          {tenant.timeFormat ?? '—'}
        </span>
      ),
    },
    {
      label: 'Created',
      value: new Date(tenant.createdAt).toLocaleString(),
    },
    { label: 'Slug', value: tenant.slug },
  ];

  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-100">
          Organization profile
        </h3>
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          Industry is locked — contact your platform admin to change
        </span>
      </div>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col">
            <dt className="text-[10px] uppercase tracking-wide text-zinc-500">
              {r.label}
            </dt>
            <dd className="text-zinc-100 mt-0.5">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Settings Detail: Profile ──────────────────────────────────────────────
function ProfileDetail({ user, onBack }: { user: ReturnType<typeof useTenantAuth>; onBack: () => void }) {
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    try {
      await api.patch(`/users/${user.id}`, { firstName, lastName });
      // FIX-020 RC-4: read fresh user from the store, not from prop.
      // The prop was captured at mount; using it could persist stale data.
      const fresh = useAuthStore.getState().user;
      if (fresh) {
        useAuthStore.getState().setUser({ ...fresh, firstName, lastName });
      }
      setToast({ message: 'Profile updated', type: 'success' });
    } catch {
      setToast({ message: 'Failed to update profile', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!user || !currentPassword || !newPassword) return;
    if (newPassword.length < 8) {
      setToast({ message: 'Password must be at least 8 characters', type: 'error' });
      return;
    }
    setChangingPassword(true);
    try {
      await api.patch(`/users/${user.id}/password`, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setToast({ message: 'Password changed. Please sign in again.', type: 'success' });
      // FIX-020: server invalidates refresh tokens on password change.
      // Force a clean sign-out so the user lands on /login.
      setTimeout(() => {
        void authService.logout();
      }, 1500);
    } catch {
      setToast({ message: 'Failed to change password. Check your current password.', type: 'error' });
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-zinc-100">Profile Settings</h2>

      {toast && (
        <div className={`px-3 py-2 rounded-lg text-xs ${toast.type === 'success' ? 'bg-[color:var(--state-success)]/15 text-[color:var(--state-success)]' : 'bg-[color:var(--state-danger)]/15 text-[color:var(--state-danger)]'}`}>
          {toast.message}
        </div>
      )}

      <div className="card-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-200">Personal Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="profile-first-name" className="text-xs text-zinc-400 block mb-1">First Name</label>
            <input
              id="profile-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-100 focus:outline-none focus:border-accent-500"
            />
          </div>
          <div>
            <label htmlFor="profile-last-name" className="text-xs text-zinc-400 block mb-1">Last Name</label>
            <input
              id="profile-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-100 focus:outline-none focus:border-accent-500"
            />
          </div>
        </div>
        <div>
          <label htmlFor="profile-email" className="text-xs text-zinc-400 block mb-1">Email</label>
          <input
            id="profile-email"
            type="email"
            value={user?.email ?? ''}
            disabled
            className="w-full px-3 py-2 rounded-lg border border-surface-border bg-zinc-800/50 text-sm text-zinc-500 cursor-not-allowed"
          />
          <p className="text-[10px] text-zinc-600 mt-1">Contact support to change your email address.</p>
        </div>
        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="card-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-200">Change Password</h3>
        <div>
          <label htmlFor="profile-current-password" className="text-xs text-zinc-400 block mb-1">Current Password</label>
          <div className="relative">
            <input
              id="profile-current-password"
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 pr-10 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-100 focus:outline-none focus:border-accent-500"
            />
            <button
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="profile-new-password" className="text-xs text-zinc-400 block mb-1">New Password</label>
          <div className="relative">
            <input
              id="profile-new-password"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 pr-10 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-100 focus:outline-none focus:border-accent-500"
              placeholder="Min 8 characters"
            />
            <button
              onClick={() => setShowNew(!showNew)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button
          onClick={handleChangePassword}
          disabled={changingPassword || !currentPassword || !newPassword}
          className="px-4 py-2 rounded-lg border border-surface-border text-zinc-300 hover:bg-surface-overlay text-xs font-medium transition disabled:opacity-50"
        >
          {changingPassword ? 'Changing...' : 'Change Password'}
        </button>
      </div>
    </div>
  );
}

// ─── Settings Detail: AI Providers ─────────────────────────────────────────
interface AIProvider {
  id: string;
  name: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  isEnabled: boolean;
  isDefault: boolean;
}

function AIProvidersDetail() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newProvider, setNewProvider] = useState('openai');
  const [newApiKey, setNewApiKey] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await api.get<AIProvider[]>('/settings/ai/providers');
      setProviders(res.data ?? []);
    } catch {
      setToast({ message: 'Failed to load AI providers', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchProviders(); }, [fetchProviders]);

  async function handleAdd() {
    if (!newName.trim() || !newApiKey.trim()) return;
    setAdding(true);
    try {
      await api.post('/settings/ai/providers', {
        name: newName.trim(),
        provider: newProvider,
        apiKey: newApiKey.trim(),
        baseUrl: newBaseUrl.trim() || undefined,
      });
      setNewName('');
      setNewApiKey('');
      setNewBaseUrl('');
      setShowAdd(false);
      setToast({ message: 'Provider added', type: 'success' });
      await fetchProviders();
    } catch {
      setToast({ message: 'Failed to add provider', type: 'error' });
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(id: string, isEnabled: boolean) {
    try {
      await api.patch(`/settings/ai/providers/${id}/toggle`);
      setProviders(prev => prev.map(p => p.id === id ? { ...p, isEnabled: !isEnabled } : p));
    } catch {
      setToast({ message: 'Failed to toggle provider', type: 'error' });
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await api.post(`/settings/ai/providers/${id}/set-default`);
      setProviders(prev => prev.map(p => ({ ...p, isDefault: p.id === id })));
    } catch {
      setToast({ message: 'Failed to set default provider', type: 'error' });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this provider? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await api.delete(`/settings/ai/providers/${id}`);
      setProviders(prev => prev.filter(p => p.id !== id));
      setToast({ message: 'Provider deleted', type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete provider', type: 'error' });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">AI Providers</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Provider
        </button>
      </div>

      {toast && (
        <div className={`px-3 py-2 rounded-lg text-xs ${toast.type === 'success' ? 'bg-[color:var(--state-success)]/15 text-[color:var(--state-success)]' : 'bg-[color:var(--state-danger)]/15 text-[color:var(--state-danger)]'}`}>
          {toast.message}
        </div>
      )}

      {showAdd && (
        <div className="card-surface p-5 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200">New Provider</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ai-provider-name" className="text-xs text-zinc-400 block mb-1">Name</label>
              <input
                id="ai-provider-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My OpenAI Key"
                className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-100 focus:outline-none focus:border-accent-500"
              />
            </div>
            <div>
              <label htmlFor="ai-provider-type" className="text-xs text-zinc-400 block mb-1">Provider</label>
              <select
                id="ai-provider-type"
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-100 focus:outline-none focus:border-accent-500"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.provider} value={m.provider}>{m.provider}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="ai-provider-api-key" className="text-xs text-zinc-400 block mb-1">API Key</label>
            <input
              id="ai-provider-api-key"
              type="password"
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-100 focus:outline-none focus:border-accent-500"
            />
          </div>
          <div>
            <label htmlFor="ai-provider-base-url" className="text-xs text-zinc-400 block mb-1">Base URL (optional)</label>
            <input
              id="ai-provider-base-url"
              type="text"
              value={newBaseUrl}
              onChange={(e) => setNewBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-100 focus:outline-none focus:border-accent-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim() || !newApiKey.trim()}
              className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium transition disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add Provider'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg border border-surface-border text-zinc-400 hover:text-zinc-200 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading providers...</div>
      ) : providers.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Cpu className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">No AI providers configured</p>
          <p className="text-xs text-zinc-500 mt-1">Add your first provider above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p.id} className="card-surface p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">{p.name}</span>
                  <span className="text-[10px] uppercase text-zinc-500 bg-surface-overlay px-1.5 py-0.5 rounded">{p.provider}</span>
                  {p.isDefault && (
                    <span className="text-[10px] bg-accent-500/20 text-accent-400 px-1.5 py-0.5 rounded">Default</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{p.isEnabled ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleToggle(p.id, p.isEnabled)}
                  className={`px-2 py-1 rounded text-xs transition ${p.isEnabled ? 'bg-[color:var(--state-success)]/15 text-[color:var(--state-success)] hover:bg-[color:var(--state-success)]/15' : 'nv-surface-inline text-zinc-400 hover:bg-white/10'}`}
                >
                  {p.isEnabled ? 'Enabled' : 'Disabled'}
                </button>
                {!p.isDefault && (
                  <button
                    onClick={() => handleSetDefault(p.id)}
                    className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay transition"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={deleting === p.id}
                  className="p-1.5 rounded text-zinc-500 hover:text-[color:var(--state-danger)] hover:bg-[color:var(--state-danger)]/10 transition disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Settings Detail: API Keys ─────────────────────────────────────────────
function APIKeysDetail() {
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  function handleCopy(value: string, id: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => setToast({ message: 'Failed to copy', type: 'error' }));
  }

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-zinc-100">API Keys</h2>

      <p className="text-sm text-zinc-400">
        API keys allow programmatic access to the NeureCore API. Keys are scoped to your tenant.
      </p>

      {toast && (
        <div className={`px-3 py-2 rounded-lg text-xs ${toast.type === 'success' ? 'bg-[color:var(--state-success)]/15 text-[color:var(--state-success)]' : 'bg-[color:var(--state-danger)]/15 text-[color:var(--state-danger)]'}`}>
          {toast.message}
        </div>
      )}

      <div className="card-surface p-8 text-center">
        <Key className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
        <p className="text-sm text-zinc-300 font-medium">Programmatic API key management</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
          Full API key generation and management is available via the API directly.
          Use the endpoints below with your session credentials to create and manage keys.
        </p>
      </div>

      <div className="card-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-200">Quick Reference</h3>
        <div className="space-y-2">
          {[
            { label: 'Base URL', value: typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : '/api/v1' },
            { label: 'Auth Header', value: 'Authorization: Bearer <token>' },
            { label: 'Content Type', value: 'Content-Type: application/json' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-overlay border border-surface-border">
              <div>
                <span className="text-xs text-zinc-500">{item.label}</span>
                <p className="text-xs font-mono text-zinc-200 mt-0.5 break-all">{item.value}</p>
              </div>
              <button
                onClick={() => handleCopy(item.value, item.label)}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:nv-surface-inline transition shrink-0"
              >
                {copied === item.label ? <Check className="w-3.5 h-3.5 text-[color:var(--state-success)]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Settings Detail: Security & Access ────────────────────────────────────
function SecuritySettingsDetail() {
  const [securityStatus, setSecurityStatus] = useState<{ csrf: boolean; rateLimit: boolean; helmet: boolean } | null>(null);
  const [rateLimitStatus, setRateLimitStatus] = useState<{ remaining: number; limit: number; resetAt: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statusRes, rateRes] = await Promise.all([
          fetch('/api/v1/security/status', { credentials: 'include' }),
          fetch('/api/v1/security/rate-limit/status', { credentials: 'include' }),
        ]);
        if (statusRes.ok) {
          const s = await statusRes.json();
          setSecurityStatus(s?.data ?? s);
        }
        if (rateRes.ok) {
          const r = await rateRes.json();
          setRateLimitStatus(r?.data ?? r);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    void fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <h2 className="text-base font-semibold text-zinc-100">Security & Access</h2>
        <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading security status...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-zinc-100">Security & Access</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-state-info" />
            <span className="text-sm font-medium text-zinc-200">CSRF Protection</span>
          </div>
          <p className={`text-xs font-medium ${securityStatus?.csrf ? 'text-[color:var(--state-success)]' : 'text-[color:var(--state-danger)]'}`}>
            {securityStatus?.csrf ? 'Enabled' : 'Disabled'}
          </p>
        </div>
        <div className="card-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-state-warning" />
            <span className="text-sm font-medium text-zinc-200">Helmet Headers</span>
          </div>
          <p className={`text-xs font-medium ${securityStatus?.helmet ? 'text-[color:var(--state-success)]' : 'text-[color:var(--state-danger)]'}`}>
            {securityStatus?.helmet ? 'Enabled' : 'Disabled'}
          </p>
        </div>
        <div className="card-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-accent-400" />
            <span className="text-sm font-medium text-zinc-200">Rate Limiting</span>
          </div>
          <p className={`text-xs font-medium ${securityStatus?.rateLimit ? 'text-[color:var(--state-success)]' : 'text-[color:var(--state-danger)]'}`}>
            {securityStatus?.rateLimit ? 'Enabled' : 'Disabled'}
          </p>
        </div>
      </div>

      {rateLimitStatus && (
        <div className="card-surface p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3">Your Rate Limit</h3>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-zinc-400">Remaining requests</span>
            <span className="font-mono text-zinc-200">
              {rateLimitStatus.remaining} / {rateLimitStatus.limit}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full bg-accent-500 transition-all"
              style={{ width: `${Math.min(100, ((rateLimitStatus.limit - rateLimitStatus.remaining) / rateLimitStatus.limit) * 100)}%` }}
            />
          </div>
          {rateLimitStatus.resetAt && (
            <p className="text-[10px] text-zinc-600 mt-2">
              Resets at {new Date(rateLimitStatus.resetAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <div className="card-surface p-5">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">IP Access</h3>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-zinc-500" />
          <p className="text-xs text-zinc-500">
            IP allowlist management is available upon request. Contact support to configure allowed IP ranges.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Helper: ChartCard ────────────────────────────────────────────────────
function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card-surface p-4">
      <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── AI Model Routing Section ────────────────────────────────────────────────────
const TASK_TYPES = [
  { key: 'planning', label: 'Planning', description: 'Task decomposition and planning' },
  { key: 'execution', label: 'Execution', description: 'Agent task execution' },
  { key: 'evaluation', label: 'Evaluation', description: 'Task result evaluation' },
  { key: 'conversation', label: 'Conversation', description: 'Chat and Q&A interactions' },
  { key: 'coding', label: 'Coding', description: 'Code generation and modification' },
  { key: 'reasoning', label: 'Reasoning', description: 'Complex reasoning tasks' },
] as const;

const AVAILABLE_MODELS = [
  { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax M2.7 Highspeed', provider: 'minimax' },
  { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', provider: 'minimax' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek' },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'deepseek' },
  { id: 'claude-3.5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
];

function AIRoutingSection() {
  const [routing, setRouting] = useState<AIRoutingConfig>(DEFAULT_AI_ROUTING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function fetchRouting() {
      try {
        const response = await api.get<AIRoutingConfig>('/settings/ai/routing');
        setRouting(response.data);
      } catch (err) {
        console.error('Failed to fetch AI routing:', err);
      } finally {
        setLoading(false);
      }
    }
    void fetchRouting();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch('/settings/ai/routing', routing);
      setToast({ message: 'AI routing settings saved', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to save routing settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    try {
      const response = await api.post<AIRoutingConfig>('/settings/ai/routing/reset');
      setRouting(response.data);
      setToast({ message: 'AI routing reset to defaults', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to reset routing', type: 'error' });
    }
  }

  function handleModelChange(taskType: keyof AIRoutingConfig, modelId: string) {
    setRouting(prev => ({ ...prev, [taskType]: modelId }));
  }

  if (loading) {
    return (
      <div className="card-surface p-5">
        <div className="text-center text-zinc-500">Loading AI routing...</div>
      </div>
    );
  }

  return (
    <div id="ai-routing-section" className="card-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">AI Model Routing</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Configure which AI model to use for each task type
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg border border-zinc-600 text-xs text-zinc-300 hover:nv-surface-inline transition"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg nv-btn-accent hover: text-white text-xs font-medium transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {toast && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs ${toast.type === 'success' ? 'bg-[color:var(--state-success)]/15 text-[color:var(--state-success)]' : 'bg-[color:var(--state-danger)]/15 text-[color:var(--state-danger)]'}`}>
          {toast.message}
        </div>
      )}

      <div className="grid gap-2">
        {TASK_TYPES.map(({ key, label, description }) => (
          <div key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
            <div className="flex-1">
              <div className="text-xs font-medium text-zinc-200">{label}</div>
              <div className="text-[10px] text-zinc-500">{description}</div>
            </div>
            <select
              id={`ai-routing-${key}`}
              value={routing[key]}
              onChange={(e) => handleModelChange(key, e.target.value)}
              aria-label={`Model for ${label}`}
              className="rounded-lg border border-zinc-600 nv-surface-inline px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)] min-w-[160px]"
            >
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.provider})
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── P8 — Command Center Tab (CR-AI-1201..1207) ──────────────────────────
// Surfaces the canonical intelligence feeds from the command-center
// service. Every panel traces to its source model and tenant scope;
// empty states are explicit (no fabricated counts).
type CCSubTab =
  | 'inventory'
  | 'quality'
  | 'costs'
  | 'model-health'
  | 'channel-health'
  | 'security'
  | 'kill-switches'
  | 'audit-correlation';

const CC_TABS: { id: CCSubTab; label: string }[] = [
  { id: 'inventory',         label: 'Inventory' },
  { id: 'quality',           label: 'Quality' },
  { id: 'costs',             label: 'Cost' },
  { id: 'model-health',      label: 'Model health' },
  { id: 'channel-health',    label: 'Channel health' },
  { id: 'security',          label: 'Security' },
  { id: 'kill-switches',     label: 'Kill switches' },
  { id: 'audit-correlation', label: 'Audit correlation' },
];

function CommandCenterTab() {
  const [sub, setSub] = useState<CCSubTab>('inventory');
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null);
  const [inventory, setInventory] = useState<CommandCenterInventory | null>(null);
  const [quality, setQuality] = useState<CommandCenterQuality | null>(null);
  const [costs, setCosts] = useState<CommandCenterCosts | null>(null);
  const [modelHealth, setModelHealth] = useState<CommandCenterModelHealth | null>(null);
  const [channelHealth, setChannelHealth] = useState<CommandCenterChannelHealth | null>(null);
  const [security, setSecurity] = useState<CommandCenterSecurityEvents | null>(null);
  const [killSwitches, setKillSwitches] = useState<CommandCenterKillSwitchList | null>(null);
  const [auditCorr, setAuditCorr] = useState<CommandCenterAuditCorrelation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, inv, qua, cos, mh, ch, sec, ks, ac] = await Promise.all([
        commandCenterService.getSummary(),
        commandCenterService.getInventory(),
        commandCenterService.getQuality(),
        commandCenterService.getCosts(),
        commandCenterService.getModelHealth(),
        commandCenterService.getChannelHealth(),
        commandCenterService.getSecurityEvents(100),
        commandCenterService.getKillSwitches(),
        commandCenterService.getAuditCorrelation(50, 24),
      ]);
      setSummary(sum);
      setInventory(inv);
      setQuality(qua);
      setCosts(cos);
      setModelHealth(mh);
      setChannelHealth(ch);
      setSecurity(sec);
      setKillSwitches(ks);
      setAuditCorr(ac);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load command center');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, refresh]);

  const refreshSecurity = useCallback(async () => {
    try {
      const sec = await commandCenterService.getSecurityEvents(100);
      setSecurity(sec);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh security feed');
    }
  }, []);

  const refreshKillSwitches = useCallback(async () => {
    try {
      const ks = await commandCenterService.getKillSwitches();
      setKillSwitches(ks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh kill switches');
    }
  }, []);

  const refreshAuditCorrelation = useCallback(async (windowHours = 24, correlationId?: string) => {
    try {
      const ac = await commandCenterService.getAuditCorrelation(50, windowHours, correlationId);
      setAuditCorr(ac);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh audit correlation');
    }
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-accent-400" />
          Command Center — P8 intelligence
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-surface-border bg-surface-overlay"
            />
            Auto refresh
          </label>
          <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void refresh()}>
            Refresh
          </ActionButton>
        </div>
      </div>

      {error && (
        <div className="card-surface p-3 text-xs text-state-danger" role="alert">
          {error}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard label="Agents" value={summary.agents.total} color="ops" />
          <KpiCard label="Running" value={summary.agents.running} color="profit" />
          <KpiCard label="Tasks" value={summary.tasks.total} color="strategy" />
          <KpiCard label="Approvals" value={summary.approvals.pending} color="warn" />
          <KpiCard label="Workflows" value={summary.workflows.active} color="risk" />
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card-surface p-4">
            <div className="text-sm font-semibold text-zinc-100 mb-3">Recent governance activity</div>
            <div className="space-y-2">
              {summary.activity.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-lg border border-surface-border bg-surface-overlay/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-100">{item.message}</span>
                    <StatusBadge status={item.severity.toUpperCase()} />
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {new Date(item.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
              {summary.activity.length === 0 && (
                <div className="text-sm text-zinc-500">No recent governance activity.</div>
              )}
            </div>
          </div>

          <div className="card-surface p-4">
            <div className="text-sm font-semibold text-zinc-100 mb-3">Cost posture</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-surface-border bg-surface-overlay/40 p-3">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">Month spend</div>
                <div className="mt-1 text-sm font-medium text-zinc-100">
                  ${(summary.costs.monthCents / 100).toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg border border-surface-border bg-surface-overlay/40 p-3">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">Budget</div>
                <div className="mt-1 text-sm font-medium text-zinc-100">
                  ${(summary.costs.budgetCents / 100).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-surface-border overflow-x-auto" role="tablist" aria-label="Command Center sub-tabs">
        {CC_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={sub === t.id}
            onClick={() => setSub(t.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition ${
              sub === t.id
                ? 'border-accent-500 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !inventory && (
        <div className="card-surface p-8 text-center text-zinc-500 text-sm" role="status">
          Loading command center…
        </div>
      )}

      {sub === 'inventory' && inventory && (
        <CCInventoryPanel inventory={inventory} />
      )}
      {sub === 'quality' && quality && (
        <CCQualityPanel quality={quality} />
      )}
      {sub === 'costs' && costs && (
        <CCCostsPanel costs={costs} />
      )}
      {sub === 'model-health' && modelHealth && (
        <CCModelHealthPanel health={modelHealth} />
      )}
      {sub === 'channel-health' && channelHealth && (
        <CCChannelHealthPanel health={channelHealth} />
      )}
      {sub === 'security' && security && (
        <CCSecurityPanel security={security} onRefresh={refreshSecurity} />
      )}
      {sub === 'kill-switches' && killSwitches && (
        <CCKillSwitchPanel
          data={killSwitches}
          onRefresh={refreshKillSwitches}
          onError={(msg) => setError(msg)}
        />
      )}
      {sub === 'audit-correlation' && auditCorr && (
        <CCAuditCorrelationPanel data={auditCorr} onRefresh={refreshAuditCorrelation} />
      )}
    </div>
  );
}

function CCInventoryPanel({ inventory }: { inventory: CommandCenterInventory }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="Agents" value={inventory.agents.length} color="ops" />
        <KpiCard label="Skills" value={inventory.skills.length} color="ops" />
        <KpiCard label="Models" value={inventory.models.length} color="strategy" />
        <KpiCard label="Knowledge" value={inventory.knowledge.length} color="warn" />
        <KpiCard label="Channels" value={inventory.channels.length} color="risk" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CCListCard
          title="Agents"
          empty="No agents configured for this tenant."
          rows={inventory.agents.map((a) => ({
            id: a.id,
            primary: a.name,
            secondary: a.model,
            badge: a.status,
          }))}
        />
        <CCListCard
          title="Skills"
          empty="No skill definitions registered."
          rows={inventory.skills.map((s) => ({
            id: s.id,
            primary: s.name,
            secondary: `v${s.version}`,
            badge: s.status,
          }))}
        />
        <CCListCard
          title="Models in use"
          empty="No model deployments detected."
          rows={inventory.models.map((m) => ({
            id: m.model,
            primary: m.model,
            secondary: `${m.agentCount} agents`,
            badge: m.provider,
          }))}
        />
        <CCListCard
          title="Knowledge entries"
          empty="No knowledge entries ingested."
          rows={inventory.knowledge.map((k) => ({
            id: k.id,
            primary: k.name,
            secondary: k.kind,
            badge: k.status,
          }))}
        />
      </div>
    </div>
  );
}

function CCQualityPanel({ quality }: { quality: CommandCenterQuality }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <KpiCard
          label="Avg score"
          value={quality.summary.averageScore === null ? '—' : quality.summary.averageScore.toFixed(2)}
          color="ops"
        />
        <KpiCard label="Evaluated" value={quality.summary.evaluatedCount} color="ops" />
        <KpiCard label="Abstentions" value={quality.summary.abstentionCount} color="warn" />
        <KpiCard label="Corrections" value={quality.summary.correctionCount} color="risk" />
        <KpiCard label="Revisions" value={quality.summary.revisionCount} color="warn" />
        <KpiCard label="Feedback" value={quality.summary.feedbackCount} color="neutral" />
      </div>
      <CCListCard
        title="Recent evaluations"
        empty="No evaluator scores in the selected window."
        rows={quality.attempts.slice(0, 10).map((a) => ({
          id: a.attemptId,
          primary: a.taskId || a.attemptId,
          secondary: a.reflection ?? '',
          badge: a.score === null ? 'no-score' : `score ${a.score.toFixed(2)}`,
        }))}
      />
    </div>
  );
}

function CCCostsPanel({ costs }: { costs: CommandCenterCosts }) {
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="MTD cost" value={fmt(costs.monthToDateCents)} color="risk" />
        <KpiCard label="MTD tokens" value={costs.monthToDateTokens.toLocaleString()} color="ops" />
        <KpiCard label="Budget total" value={fmt(costs.totalBudgetCents)} color="neutral" />
        <KpiCard
          label="Utilization"
          value={`${(costs.utilizationPercent * 100).toFixed(1)}%`}
          color={costs.utilizationPercent >= 0.9 ? 'risk' : costs.utilizationPercent >= 0.5 ? 'warn' : 'ops'}
        />
      </div>
      <CCListCard
        title="Cost by model"
        empty="No cost records for this tenant this month."
        rows={costs.byModel.map((m) => ({
          id: `${m.model}-${m.provider}`,
          primary: m.model,
          secondary: `${m.tokens.toLocaleString()} tokens`,
          badge: fmt(m.costCents),
        }))}
      />
      <CCListCard
        title="Active budgets"
        empty="No budgets configured."
        rows={costs.budgets.map((b) => ({
          id: b.id,
          primary: b.name,
          secondary: `${b.scope} • resets ${new Date(b.resetAt).toLocaleDateString()}`,
          badge: `${b.utilizationPercent.toFixed(0)}%`,
        }))}
      />
    </div>
  );
}

function CCModelHealthPanel({ health }: { health: CommandCenterModelHealth }) {
  const gradeColor = (g: string): BadgeVariant =>
    g === 'UNHEALTHY' ? 'danger' : g === 'DEGRADED' ? 'warning' : g === 'HEALTHY' ? 'success' : 'neutral';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Total attempts" value={health.totalAttempts} color="ops" />
        <KpiCard
          label="Error rate"
          value={`${(health.overallErrorRate * 100).toFixed(1)}%`}
          color={health.overallErrorRate > 0.1 ? 'risk' : 'ops'}
        />
        <KpiCard label="Models tracked" value={health.models.length} color="neutral" />
      </div>
      <CCListCard
        title="Per-model health"
        empty="No attempts in the selected window."
        rows={health.models.map((m) => ({
          id: m.model,
          primary: m.model,
          secondary:
            m.p95DurationMs === null
              ? `${m.attempts} attempts • no latency`
              : `${m.attempts} attempts • p95 ${m.p95DurationMs}ms`,
          badge: m.grade,
        }))}
        badgeColorFor={gradeColor}
      />
    </div>
  );
}

function CCChannelHealthPanel({ health }: { health: CommandCenterChannelHealth }) {
  const gradeColor = (g: string): BadgeVariant =>
    g === 'UNHEALTHY' ? 'danger' : g === 'DEGRADED' ? 'warning' : g === 'HEALTHY' ? 'success' : 'neutral';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total" value={health.totalChannels} color="ops" />
        <KpiCard label="Healthy" value={health.healthyChannels} color="ops" />
        <KpiCard label="Degraded" value={health.degradedChannels} color="warn" />
        <KpiCard label="Unhealthy" value={health.unhealthyChannels} color="risk" />
      </div>
      <CCListCard
        title="Connectors"
        empty="No channels configured for this tenant."
        rows={health.channels.map((c) => ({
          id: c.id,
          primary: c.provider,
          secondary: c.tokenExpiresAt
            ? `token expires ${new Date(c.tokenExpiresAt).toLocaleDateString()}`
            : 'no token',
          badge: c.grade,
        }))}
        badgeColorFor={gradeColor}
      />
    </div>
  );
}

interface CCRow {
  id: string;
  primary: string;
  secondary: string;
  badge: string;
}

function CCSecurityPanel({
  security,
  onRefresh,
}: {
  security: CommandCenterSecurityEvents;
  onRefresh: () => void | Promise<void>;
}) {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'critical' | 'high' | 'medium' | 'low'>('ALL');
  const sevColor = (s: string): BadgeVariant =>
    s === 'critical' ? 'danger' : s === 'high' ? 'warning' : s === 'medium' ? 'info' : 'neutral';
  const visibleEvents = security.events.filter((event) =>
    severityFilter === 'ALL' ? true : event.severity === severityFilter,
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-state-danger" />
          Security events feed
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as 'ALL' | 'critical' | 'high' | 'medium' | 'low')}
            aria-label="Severity filter"
            className="px-2 py-1.5 rounded-md border border-surface-border bg-surface-overlay text-xs text-zinc-200 focus:outline-none focus:border-accent-500"
          >
            <option value="ALL">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void onRefresh()}>
            Refresh
          </ActionButton>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <KpiCard label="Total" value={security.summary.total} color="ops" />
        <KpiCard label="Critical" value={security.summary.criticalCount} color="risk" />
        <KpiCard label="Denials" value={security.summary.denials} color="warn" />
        <KpiCard label="Injection" value={security.summary.injectionAttempts} color="risk" />
        <KpiCard label="DLP" value={security.summary.dlpEvents} color="warn" />
        <KpiCard label="Malware" value={security.summary.malwareEvents} color="risk" />
      </div>
      <CCListCard
        title="Recent security events"
        empty="No security events recorded for this tenant."
        rows={visibleEvents.slice(0, 25).map((e) => ({
          id: e.id,
          primary: e.action,
          secondary: `${e.actor}${e.resource ? ` • ${e.resource}${e.resourceId ? ` ${e.resourceId}` : ''}` : ''}${e.ipAddress ? ` • ${e.ipAddress}` : ''}`,
          badge: e.severity,
        }))}
        badgeColorFor={sevColor}
      />
    </div>
  );
}

function CCKillSwitchPanel({
  data,
  onRefresh,
  onError,
}: {
  data: CommandCenterKillSwitchList;
  onRefresh: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState<{ scope: 'process' | 'phase' | 'channel' | 'tenant-feature'; target: string; enabled: boolean } | null>(null);
  const [newFeatureKey, setNewFeatureKey] = useState('service-gateway-v2.read');

  const tenantFeatureEntries = data.entries.filter((e) => e.scope === 'tenant-feature');

  const submit = async () => {
    if (!confirming) return;
    if (!reason || reason.trim().length < 3) {
      onError('Reason must be at least 3 characters');
      return;
    }
    const payload: SetKillSwitchInput = {
      scope: confirming.scope,
      target: confirming.scope === 'process' ? undefined : confirming.target,
      enabled: confirming.enabled,
      reason: reason.trim(),
    };
    const key = `${confirming.scope}:${confirming.target}:${confirming.enabled}`;
    setPending(key);
    try {
      await commandCenterService.setKillSwitch(payload);
      setConfirming(null);
      setReason('');
      await onRefresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to toggle kill switch');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Zap className="w-4 h-4 text-state-warning" />
          Kill switches
        </h3>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void onRefresh()}>
          Refresh
        </ActionButton>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard
          label="Process kill switch"
          value={data.processEnabled ? 'ON' : 'OFF'}
          color={data.processEnabled ? 'risk' : 'ops'}
        />
        <KpiCard label="Phases enabled" value={data.entries.filter((e) => e.scope === 'phase' && e.enabled).length} color="ops" />
        <KpiCard label="Channels enabled" value={data.entries.filter((e) => e.scope === 'channel' && e.enabled).length} color="ops" />
      </div>

      <div className="card-surface p-4 space-y-3">
        <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Global process gate</h4>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-overlay px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm text-zinc-100">Service gateway process switch</p>
            <p className="text-[11px] text-zinc-500">
              Emergency-wide control for the entire rollout process.
            </p>
          </div>
          <button
            type="button"
            aria-label="Toggle process kill switch"
            disabled={pending === `process::${!data.processEnabled}`}
            onClick={() =>
              setConfirming({
                scope: 'process',
                target: '',
                enabled: !data.processEnabled,
              })
            }
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition disabled:opacity-50 ${
              data.processEnabled
                ? 'bg-state-warning/15 text-state-warning hover:bg-state-warning/25'
                : 'bg-state-success/15 text-state-success hover:bg-state-success/25'
            }`}
          >
            {data.processEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className="card-surface p-4 space-y-3">
        <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Phases</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {data.entries.filter((e) => e.scope === 'phase').map((e) => {
            const key = `phase:${e.target}:${!e.enabled}`;
            const isPending = pending === key;
            return (
              <div key={`phase-${e.target}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100">{e.target}</p>
                  <p className="text-[11px] text-zinc-500">phase gate</p>
                </div>
                <button
                  type="button"
                  aria-label={`Toggle phase ${e.target}`}
                  disabled={isPending}
                  onClick={() => setConfirming({ scope: 'phase', target: e.target, enabled: !e.enabled })}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition disabled:opacity-50 ${
                    e.enabled
                      ? 'bg-state-warning/15 text-state-warning hover:bg-state-warning/25'
                      : 'bg-state-success/15 text-state-success hover:bg-state-success/25'
                  }`}
                >
                  {e.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card-surface p-4 space-y-3">
        <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Channels</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {data.entries.filter((e) => e.scope === 'channel').map((e) => (
            <div key={`channel-${e.target}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay">
              <div className="min-w-0">
                <p className="text-sm text-zinc-100">{e.target}</p>
                <p className="text-[11px] text-zinc-500">channel gate</p>
              </div>
              <button
                type="button"
                aria-label={`Toggle channel ${e.target}`}
                disabled={pending === `channel:${e.target}:${!e.enabled}`}
                onClick={() => setConfirming({ scope: 'channel', target: e.target, enabled: !e.enabled })}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition disabled:opacity-50 ${
                  e.enabled
                    ? 'bg-state-warning/15 text-state-warning hover:bg-state-warning/25'
                    : 'bg-state-success/15 text-state-success hover:bg-state-success/25'
                }`}
              >
                {e.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card-surface p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Tenant feature overrides</h4>
          <span className="text-[11px] text-zinc-500">{tenantFeatureEntries.length} overrides</span>
        </div>

        <div className="rounded-lg border border-surface-border bg-surface-overlay p-3 space-y-2">
          <label className="block text-[11px] text-zinc-400">
            Feature key
            <input
              type="text"
              value={newFeatureKey}
              onChange={(e) => setNewFeatureKey(e.target.value)}
              placeholder="service-gateway-v2.read"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-100 focus:outline-none focus:border-accent-500"
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming({ scope: 'tenant-feature', target: newFeatureKey.trim(), enabled: true })}
              disabled={!newFeatureKey.trim().startsWith('service-gateway-v2.')}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-accent-500 hover:bg-accent-600 text-white transition disabled:opacity-50"
            >
              Enable override
            </button>
            <button
              type="button"
              onClick={() => setConfirming({ scope: 'tenant-feature', target: newFeatureKey.trim(), enabled: false })}
              disabled={!newFeatureKey.trim().startsWith('service-gateway-v2.')}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-surface-border text-zinc-300 hover:bg-surface-overlay transition disabled:opacity-50"
            >
              Disable override
            </button>
          </div>
          <p className="text-[11px] text-zinc-500">
            Feature keys must start with <span className="font-mono">service-gateway-v2.</span>
          </p>
        </div>

        {tenantFeatureEntries.length === 0 ? (
          <div className="text-xs text-zinc-500 py-3">No tenant-specific feature overrides configured.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {tenantFeatureEntries.map((e) => (
              <div key={`feature-${e.target}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100 break-all">{e.target}</p>
                  <p className="text-[11px] text-zinc-500">tenant feature override</p>
                </div>
                <button
                  type="button"
                  aria-label={`Toggle tenant feature ${e.target}`}
                  disabled={pending === `tenant-feature:${e.target}:${!e.enabled}`}
                  onClick={() => setConfirming({ scope: 'tenant-feature', target: e.target, enabled: !e.enabled })}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition disabled:opacity-50 ${
                    e.enabled
                      ? 'bg-state-warning/15 text-state-warning hover:bg-state-warning/25'
                      : 'bg-state-success/15 text-state-success hover:bg-state-success/25'
                  }`}
                >
                  {e.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirming && (
        <div className="card-surface p-4 space-y-3 border border-state-warning/40" role="dialog" aria-label="Confirm kill switch toggle">
          <p className="text-xs text-zinc-300">
            About to set <span className="font-mono">{confirming.scope}:{confirming.target || '<process>'}</span> to{' '}
            <span className={confirming.enabled ? 'text-state-success' : 'text-state-warning'}>
              {confirming.enabled ? 'ENABLED' : 'DISABLED'}
            </span>
            . Provide an operator reason (will be recorded in AuditLog).
          </p>
          <label className="block text-xs text-zinc-400">
            Reason
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. rotate credentials / incident response"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-100 focus:outline-none focus:border-accent-500"
              aria-required="true"
              minLength={3}
            />
          </label>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setConfirming(null);
                setReason('');
              }}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-surface-border text-zinc-300 hover:bg-surface-overlay transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={pending !== null || reason.trim().length < 3}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-accent-500 hover:bg-accent-600 text-white transition disabled:opacity-50"
            >
              {pending ? 'Applying…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CCAuditCorrelationPanel({
  data,
  onRefresh,
}: {
  data: CommandCenterAuditCorrelation;
  onRefresh: (windowHours?: number, correlationId?: string) => void | Promise<void>;
}) {
  const [windowHours, setWindowHours] = useState('24');
  const [correlationId, setCorrelationId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-state-info" />
          Audit correlation ({data.count})
        </h3>
        <span className="text-[11px] text-zinc-500">
          {new Date(data.windowStart).toLocaleString()} → {new Date(data.windowEnd).toLocaleString()}
        </span>
      </div>
      <div className="card-surface p-4 flex flex-col lg:flex-row lg:items-end gap-3">
        <label className="text-xs text-zinc-400 flex-1">
          Correlation ID
          <input
            type="text"
            value={correlationId}
            onChange={(e) => setCorrelationId(e.target.value)}
            placeholder="Filter a specific correlation ID"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-100 focus:outline-none focus:border-accent-500"
          />
        </label>
        <label className="text-xs text-zinc-400 w-full lg:w-40">
          Window (hours)
          <select
            value={windowHours}
            onChange={(e) => setWindowHours(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-100 focus:outline-none focus:border-accent-500"
          >
            <option value="6">6</option>
            <option value="24">24</option>
            <option value="72">72</option>
            <option value="168">168</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void onRefresh(Number(windowHours), correlationId.trim() || undefined)}
            className="px-3 py-2 rounded-md text-xs font-medium bg-accent-500 hover:bg-accent-600 text-white transition"
          >
            Apply filter
          </button>
          <button
            type="button"
            onClick={() => {
              setCorrelationId('');
              setWindowHours('24');
              void onRefresh(24);
            }}
            className="px-3 py-2 rounded-md text-xs font-medium border border-surface-border text-zinc-300 hover:bg-surface-overlay transition"
          >
            Reset
          </button>
        </div>
      </div>
      {data.events.length === 0 ? (
        <div className="card-surface p-8 text-center text-zinc-500 text-sm">
          No correlated audit events in the selected window.
        </div>
      ) : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-zinc-500 border-b border-surface-border">
              <tr>
                <th className="text-left px-3 py-2">Time</th>
                <th className="text-left px-3 py-2">Action</th>
                <th className="text-left px-3 py-2">Resource</th>
                <th className="text-left px-3 py-2">Actor</th>
                <th className="text-left px-3 py-2">Result</th>
                <th className="text-left px-3 py-2">Correlation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {data.events.map((e) => (
                <Fragment key={e.id}>
                  <tr>
                    <td className="px-3 py-2 font-mono text-zinc-500 whitespace-nowrap">{new Date(e.occurredAt).toLocaleTimeString()}</td>
                    <td className="px-3 py-2 text-zinc-200">{e.action}</td>
                    <td className="px-3 py-2 text-zinc-400">
                      {e.resource ?? '—'}
                      {e.resourceId ? <span className="text-zinc-600"> · {e.resourceId}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{e.actor}</td>
                    <td className="px-3 py-2">
                      <span className={e.result === 'failure' ? 'text-state-danger' : 'text-state-success'}>{e.result}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-zinc-500 truncate max-w-[180px]" title={e.correlationId ?? ''}>
                          {e.correlationId ?? '—'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedId((current) => current === e.id ? null : e.id)}
                          className="text-[10px] text-accent-400 hover:text-accent-300 transition"
                        >
                          {expandedId === e.id ? 'Hide' : 'Details'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === e.id ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-3 bg-surface-overlay/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                          <div>
                            <span className="text-zinc-500">Correlation ID</span>
                            <div className="font-mono text-zinc-300 break-all">{e.correlationId ?? '—'}</div>
                          </div>
                          <div>
                            <span className="text-zinc-500">Causation ID</span>
                            <div className="font-mono text-zinc-300 break-all">{e.causationId ?? '—'}</div>
                          </div>
                          <div>
                            <span className="text-zinc-500">Occurred at</span>
                            <div className="text-zinc-300">{new Date(e.occurredAt).toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-zinc-500">Actor / result</span>
                            <div className="text-zinc-300">{e.actor} • {e.result}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CCListCard({
  title,
  rows,
  empty,
  badgeColorFor,
}: {
  title: string;
  rows: CCRow[];
  empty: string;
  badgeColorFor?: (badge: string) => BadgeVariant;
}) {
  return (
    <div className="card-surface p-4 space-y-2">
      <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-500 py-3">{empty}</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-zinc-100 truncate">{r.primary}</p>
                {r.secondary && (
                  <p className="text-[11px] text-zinc-500 truncate">{r.secondary}</p>
                )}
              </div>
              <StatusBadge
                status={r.badge}
                variant={badgeColorFor ? badgeColorFor(r.badge) : 'neutral'}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
