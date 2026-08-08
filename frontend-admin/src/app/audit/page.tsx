'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useInspectorStore } from '@/stores/inspectorStore';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  actorId?: string;
  actorEmail?: string;
  tenantId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
  severity?: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  HIGH:   'text-status-risk',
  MEDIUM: 'text-status-warn',
  LOW:    'text-zinc-400',
  INFO:   'text-status-ops',
};

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'bg-[color:var(--state-success)] text-emerald-300',
  UPDATE: 'bg-[color:var(--state-info)] text-blue-300',
  DELETE: 'bg-[color:var(--state-danger)] text-red-300',
  LOGIN:  'bg-[color:var(--accent-500)] text-indigo-300',
  LOGOUT: 'bg-zinc-800 text-zinc-400',
};

function getActionColor(action: string): string {
  const key = Object.keys(ACTION_COLOR).find((k) => action.includes(k));
  return key ? ACTION_COLOR[key] : 'bg-zinc-800 text-zinc-400';
}

// ─── Row ─────────────────────────────────────────────────────────────────────
function AuditRow({ log, onClick }: { log: AuditLog; onClick: () => void }) {
  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="border-t border-surface-border hover:bg-surface-overlay transition cursor-pointer group"
    >
      {/* Timestamp */}
      <td className="px-4 py-2.5 text-xs text-zinc-500 whitespace-nowrap">
        {new Date(log.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </td>
      {/* Action */}
      <td className="px-4 py-2.5">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${getActionColor(log.action)}`}>
          {log.action}
        </span>
      </td>
      {/* Resource */}
      <td className="px-4 py-2.5 text-xs text-zinc-300">{log.resource}</td>
      {/* Actor */}
      <td className="px-4 py-2.5 text-xs text-zinc-400 truncate max-w-32">
        {log.actorEmail ?? log.actorId?.slice(0, 8) ?? '—'}
      </td>
      {/* Severity */}
      <td className="px-4 py-2.5 text-xs font-medium">
        <span className={SEVERITY_COLOR[log.severity ?? 'LOW']}>
          {log.severity ?? 'LOW'}
        </span>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AuditPage() {
  const user = useAdminAuth();
  const openInspector = useInspectorStore((s) => s.openInspector);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/observability/logs?page=${page}&limit=50`);
      const unwrapped = unwrapList(res);
      setLogs(unwrapped.items as AuditLog[]);
      setTotal(unwrapped.total ?? 0);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter((l) =>
    !search ||
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    (l.actorEmail ?? '').toLowerCase().includes(search.toLowerCase()) ||
    l.resource?.toLowerCase().includes(search.toLowerCase()),
  );

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Audit Logs</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Immutable platform audit trail</p>
          </div>
          <button onClick={() => void fetchLogs()} className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 transition">
            Refresh
          </button>
        </div>

        {/* ── Search ── */}
        <input
          aria-label="Filter audit logs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by action, actor, or resource…"
          className="w-full max-w-md rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[color:var(--accent-500)] transition"
        />

        {/* ── Table ── */}
        <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase border-b border-surface-border">
                <th className="px-4 py-2.5 text-left font-medium">Timestamp</th>
                <th className="px-4 py-2.5 text-left font-medium">Action</th>
                <th className="px-4 py-2.5 text-left font-medium">Resource</th>
                <th className="px-4 py-2.5 text-left font-medium">Actor</th>
                <th className="px-4 py-2.5 text-left font-medium">Severity</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-t border-surface-border">
                    <td colSpan={5} className="px-4 py-2.5">
                      <div className="h-4 bg-surface-overlay rounded animate-pulse w-full" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-zinc-500 text-sm">
                    {search ? 'No logs match your filter.' : 'No audit logs yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <AuditRow
                    key={log.id}
                    log={log}
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {total > 50 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              Page {page} · {total} total records
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition">Previous</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * 50 >= total} className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition">Next</button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
