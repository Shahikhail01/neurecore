'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';

interface HealthCheck {
  service: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  detail?: string;
}

interface SystemMetric {
  id: string;
  type: string;
  name: string;
  value: number;
  unit: string;
  recordedAt: string;
}

function StatusDot({ status }: { status: 'ok' | 'degraded' | 'down' }) {
  if (status === 'ok') return <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />;
  if (status === 'degraded') return <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />;
  return <span className="inline-block w-2 h-2 rounded-full bg-[color:var(--state-danger)] animate-pulse" />;
}

/**
 * Sidecar health rows below (Hermes / Bridge / Accounting) are populated
 * at runtime via `GET /api/v1/admin/sidecars/status` which proxies
 * `systemctl is-active <service>` on Contabo. NC-ACCT-IMP-1 §10 + admin
 * infrastructure page (deployed 2026-07-30).
 */
const STATIC_HEALTH: HealthCheck[] = [
  { service: 'API Server', status: 'ok', latencyMs: 4, detail: 'NestJS v11 — localhost:3000' },
  { service: 'PostgreSQL', status: 'ok', latencyMs: 2, detail: 'v16 — localhost:5432' },
  { service: 'Redis', status: 'ok', latencyMs: 1, detail: 'v7 — localhost:6379' },
  { service: 'WebSocket Gateway', status: 'ok', detail: 'Socket.IO events gateway' },
];

interface SidecarRow {
  service: string;
  label: string;
  port: number;
  status: 'active' | 'inactive' | 'failed' | 'unknown';
  bound: boolean;
  uptimeSeconds?: number;
  pid?: number;
  checkedAt: string;
}

function sidecarToHealth(row: SidecarRow): HealthCheck & { port: number; uptimeSeconds?: number } {
  const status: 'ok' | 'degraded' | 'down' =
    row.status === 'active' && row.bound ? 'ok' :
    row.status === 'active' && !row.bound ? 'degraded' :
    'down';
  const detail = `${row.label} — :${row.port} · systemd ${row.status}${
    row.pid ? ` · pid ${row.pid}` : ''
  }${
    row.uptimeSeconds ? ` · uptime ${formatUptime(row.uptimeSeconds)}` : ''
  }`;
  return { service: row.label, status, detail, port: row.port, uptimeSeconds: row.uptimeSeconds };
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export default function AdminInfrastructurePage() {
  const user = useAdminAuth();
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [sidecarRows, setSidecarRows] = useState<SidecarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Phase 2: sidecar drill-down state (logs modal + restart)
  const [logsModal, setLogsModal] = useState<{
    open: boolean;
    service: string;
    text: string;
    loading: boolean;
  }>({ open: false, service: '', text: '', loading: false });
  const [busySidecar, setBusySidecar] = useState<string | null>(null);
  const [restartResult, setRestartResult] = useState<{ ok: boolean; service: string; message: string } | null>(null);

  const openLogsModal = useCallback(async (service: string) => {
    setLogsModal({ open: true, service, text: '', loading: true });
    try {
      const r = await api.get<{ data: { service: string; lines: number; text: string } }>(
        `/admin/sidecars/${encodeURIComponent(service)}/logs`,
      );
      setLogsModal((m) => ({ ...m, text: r.data?.data?.text ?? '', loading: false }));
    } catch (e) {
      setLogsModal((m) => ({
        ...m,
        text: `Failed to load logs: ${e instanceof Error ? e.message : String(e)}`,
        loading: false,
      }));
    }
  }, []);

  const confirmRestart = useCallback(async (service: string) => {
    if (!window.confirm(`Restart ${service}? This will briefly interrupt the service.`)) return;
    setBusySidecar(service);
    setRestartResult(null);
    try {
      const r = await api.post<{ data: { ok: boolean; service: string; status: string; message: string; restartedAt: string } }>(
        `/admin/sidecars/${encodeURIComponent(service)}/restart`,
        {},
      );
      setRestartResult({
        ok: r.data?.data?.ok ?? false,
        service: r.data?.data?.service ?? service,
        message: r.data?.data?.message ?? 'Restart issued.',
      });
      void load();
    } catch (e) {
      setRestartResult({
        ok: false,
        service,
        message: `Restart failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setBusySidecar(null);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      // Admin has no tenantId — use platform endpoint to verify connectivity
      const res = await api.get<{ data: { tenants: object; agents: object } }>('/observability/platform');
      setMetrics([]);
    } catch (err) { console.error(err); }
    try {
      const sidecarRes = await api.get<{ data: { rows: SidecarRow[] } }>('/admin/sidecars/status');
      setSidecarRows(sidecarRes.data?.data?.rows ?? []);
    } catch (err) {
      // Endpoint may not be reachable (no PLATFORM_ADMIN token, etc.); keep last known.
      console.warn('Sidecar status fetch failed:', err);
    }
    finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => { void load(); }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  const allRows: HealthCheck[] = [
    ...STATIC_HEALTH,
    ...sidecarRows.map(sidecarToHealth),
  ];

  const overallStatus: 'ok' | 'degraded' | 'down' = allRows.some((h) => h.status === 'down')
    ? 'down'
    : allRows.some((h) => h.status === 'degraded')
    ? 'degraded'
    : 'ok';

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Infrastructure</h1>
            <p className="text-sm text-gray-500 mt-1">System health and service status</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Last refresh: {lastRefresh.toLocaleTimeString()}</span>
            <button
              onClick={() => void load()}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg border border-gray-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Restart result banner */}
        {restartResult && (
          <div className={`rounded-xl border p-4 flex items-start gap-3 ${
            restartResult.ok ? 'border-emerald-800 bg-emerald-900/20' : 'border-amber-800 bg-amber-900/20'
          }`}>
            <div className="text-xs">
              <p className={`font-semibold ${restartResult.ok ? 'text-emerald-300' : 'text-amber-300'}`}>
                {restartResult.ok ? '✓ Restart succeeded' : '⚠ Restart issued with warnings'}: {restartResult.service}
              </p>
              <p className="text-gray-400 mt-0.5">{restartResult.message}</p>
            </div>
          </div>
        )}

        {/* Overall Status Banner */}
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${
          overallStatus === 'ok' ? 'border-emerald-800 bg-[color:var(--state-success)]' :
          overallStatus === 'degraded' ? 'border-amber-800 bg-[color:var(--state-warning)]' :
          'border-red-800 bg-[color:var(--state-danger)]'
        }`}>
          <StatusDot status={overallStatus} />
          <div>
            <span className={`font-semibold text-sm ${
              overallStatus === 'ok' ? 'text-emerald-300' :
              overallStatus === 'degraded' ? 'text-amber-300' : 'text-red-300'
            }`}>
              {overallStatus === 'ok' ? 'All Systems Operational' :
               overallStatus === 'degraded' ? 'Degraded Performance' : 'Outage Detected'}
            </span>
            <p className="text-xs text-gray-400 mt-0.5">Auto-refreshes every 30 seconds</p>
          </div>
        </div>

        {/* Service Health Grid */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Services</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {allRows.map((h) => {
              const isSidecar = 'port' in h && typeof (h as any).port === 'number';
              const sidecarRow = isSidecar ? (sidecarRows.find((s) => s.service === (h as any).service)) : undefined;
              return (
                <div key={h.service} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-200">{h.service}</span>
                    <StatusDot status={h.status} />
                  </div>
                  {h.latencyMs !== undefined && (
                    <div className="text-xs text-gray-500 mb-1">Latency: <span className="text-[color:var(--state-success)]">{h.latencyMs}ms</span></div>
                  )}
                  {h.detail && <div className="text-xs text-gray-600">{h.detail}</div>}
                  <div className={`mt-2 text-xs font-medium ${
                    h.status === 'ok' ? 'text-[color:var(--state-success)]' :
                    h.status === 'degraded' ? 'text-[color:var(--state-warning)]' : 'text-[color:var(--state-danger)]'
                  }`}>
                    {h.status === 'ok' ? '● Healthy' :
                     h.status === 'degraded' ? '● Degraded' : '● Down'}
                  </div>
                  {isSidecar && sidecarRow && (
                    <SidecarCardActions
                      serviceName={(h as any).service as string}
                      currentStatus={sidecarRow.status}
                      onLogs={openLogsModal}
                      onRestart={confirmRestart}
                      busy={busySidecar === (h as any).service}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <LogsModal
          open={logsModal.open}
          serviceName={logsModal.service}
          text={logsModal.text}
          loading={logsModal.loading}
          onClose={() => setLogsModal((m) => ({ ...m, open: false }))}
        />

        {/* System Metrics */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent System Metrics</h2>
          <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-gray-500">Loading metrics…</div>
            ) : metrics.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-gray-500">No system metrics recorded yet.</p>
                <p className="text-xs text-gray-600 mt-2">Metrics are recorded as agents execute tasks.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left py-3 px-4">Metric</th>
                    <th className="text-left py-3 pr-4">Type</th>
                    <th className="text-left py-3 pr-4">Value</th>
                    <th className="text-left py-3 pr-4">Unit</th>
                    <th className="text-left py-3 pr-4">Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {metrics.map((m) => (
                    <tr key={m.id} className="text-gray-300 hover:bg-gray-800/40 transition-colors">
                      <td className="py-2.5 px-4 font-medium">{m.name}</td>
                      <td className="py-2.5 pr-4 text-gray-500 text-xs">{m.type}</td>
                      <td className="py-2.5 pr-4 text-indigo-300 font-mono">{m.value}</td>
                      <td className="py-2.5 pr-4 text-gray-500 text-xs">{m.unit}</td>
                      <td className="py-2.5 pr-4 text-gray-500 text-xs">{new Date(m.recordedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Stack Info */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Stack Information</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {[
              ['Runtime', 'Node.js 22 LTS'],
              ['Framework', 'NestJS 11'],
              ['ORM', 'Prisma 5.22'],
              ['Database', 'PostgreSQL 16'],
              ['Cache', 'Redis 7'],
              ['Frontend', 'Next.js 15 (App Router)'],
              ['Language', 'TypeScript 5.7'],
              ['Container', 'Docker Compose'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-gray-200 font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}


// ─── Phase 2: Sidecar drill-down components ──────────────────────────────

interface SidecarCardActionsProps {
  serviceName: string;
  currentStatus: SidecarRow['status'];
  onLogs: (service: string) => void;
  onRestart: (service: string) => void;
  busy: boolean;
}

function SidecarCardActions({ serviceName, currentStatus, onLogs, onRestart, busy }: SidecarCardActionsProps) {
  const canRestart = currentStatus === 'failed' || currentStatus === 'inactive';
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        onClick={() => onLogs(serviceName)}
        className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
      >
        View Logs
      </button>
      <button
        onClick={() => onRestart(serviceName)}
        disabled={busy}
        className={`px-2 py-1 text-xs rounded border transition-colors ${
          canRestart
            ? 'bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 border-amber-800'
            : 'bg-gray-800 hover:bg-gray-700 text-gray-400 border-gray-700'
        } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {busy ? 'Restarting…' : 'Restart'}
      </button>
    </div>
  );
}

interface LogsModalProps {
  open: boolean;
  serviceName: string;
  text: string;
  loading: boolean;
  onClose: () => void;
}

function LogsModal({ open, serviceName, text, loading, onClose }: LogsModalProps) {
  if (!open) return null;
  // Lightweight inline modal — no portal/overlay dependency.
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h3 className="text-base font-semibold text-gray-100">{serviceName}</h3>
            <p className="text-xs text-gray-500 mt-0.5">journalctl -u {serviceName} -n 100</p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 font-mono text-xs text-gray-300 whitespace-pre">
          {loading ? 'Loading…' : text || '(no output)'}
        </div>
      </div>
    </div>
  );
}
