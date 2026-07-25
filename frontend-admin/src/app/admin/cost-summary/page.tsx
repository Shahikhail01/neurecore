'use client';

/**
 * /admin/cost-summary — aggregated LLM cost dashboard
 *
 * Per ai-gateway-imp-plan.md §7.5: reads
 * /api/v1/admin/models/cost-summary?days=30 and renders a sortable
 * table by provider/model with cost + token totals. Used by the
 * SuperAdmin to monitor LLM spend across the platform.
 */

import { useEffect, useState, useCallback } from 'react';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import { unwrapItem } from '@/services/unwrap';

interface CostRow {
  provider: string;
  model: string;
  _sum: { costCents: unknown; inputTokens: number; outputTokens: number };
  _count: { _all: number };
}

interface CostSummary {
  days: number;
  rows: CostRow[];
}

export default function CostSummaryPage() {
  const user = useAdminAuth();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.get(
        `/api/v1/admin/models/cost-summary?days=${days}`,
      );
      setSummary(unwrapItem(r) as CostSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [user, days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-[1200px] mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            LLM Cost Summary
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Aggregated spend from every gateway invocation. Source:
            <code className="ml-1 text-zinc-400">CostRecord</code>
            (one row per call, deduplicated on{' '}
            <code className="text-zinc-400">sourceEventId</code>).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-400">Window:</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-2 py-1 rounded bg-surface-sunken text-sm text-zinc-100"
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d}d
              </option>
            ))}
          </select>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="ml-auto px-3 py-1 text-xs rounded border border-surface-border text-zinc-400 hover:text-zinc-100 disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {error ? (
          <div className="rounded-md border border-red-800 bg-[color:var(--state-danger)]/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}
        {!summary ? (
          <div className="text-sm text-zinc-500">Loading…</div>
        ) : summary.rows.length === 0 ? (
          <div className="text-sm text-zinc-500">
            No cost records in the last {days} days.
          </div>
        ) : (
          <CostTable rows={summary.rows} />
        )}
      </div>
    </AdminShell>
  );
}

function CostTable({ rows }: { rows: CostRow[] }) {
  const sorted = [...rows].sort((a, b) => {
    const aCents = toCentsNumber(a._sum.costCents);
    const bCents = toCentsNumber(b._sum.costCents);
    return bCents - aCents;
  });
  const total = sorted.reduce(
    (s, r) => s + toCentsNumber(r._sum.costCents),
    0,
  );
  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500 bg-surface-sunken">
          <tr>
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">Model</th>
            <th className="px-3 py-2 text-right">Calls</th>
            <th className="px-3 py-2 text-right">Tokens in</th>
            <th className="px-3 py-2 text-right">Tokens out</th>
            <th className="px-3 py-2 text-right">Cost (¢)</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} className="border-t border-surface-border">
              <td className="px-3 py-2 text-zinc-200">{r.provider}</td>
              <td className="px-3 py-2 font-mono text-zinc-300">{r.model}</td>
              <td className="px-3 py-2 text-zinc-400 text-right">
                {r._count._all}
              </td>
              <td className="px-3 py-2 text-zinc-400 text-right">
                {(r._sum.inputTokens ?? 0).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-zinc-400 text-right">
                {(r._sum.outputTokens ?? 0).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-zinc-200 text-right">
                {toCentsNumber(r._sum.costCents).toFixed(2)}
              </td>
            </tr>
          ))}
          <tr className="border-t border-surface-border bg-surface-sunken">
            <td className="px-3 py-2 font-semibold text-zinc-100" colSpan={5}>
              Total
            </td>
            <td className="px-3 py-2 font-semibold text-zinc-100 text-right">
              {total.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function toCentsNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (
    v !== null &&
    typeof v === 'object' &&
    'toString' in (v as Record<string, unknown>)
  ) {
    const n = Number((v as { toString(): string }).toString());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
