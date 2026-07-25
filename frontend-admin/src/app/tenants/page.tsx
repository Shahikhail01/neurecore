'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHero, GlassPanel } from '@neurecore/ui-visual';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';
import type { ApiResponse, PaginatedData, Tenant } from '@/types/api.types';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'border border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]',
  SUSPENDED: 'border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)]',
  CANCELLED: 'border border-[color:var(--state-danger)]/40 bg-[color:var(--state-danger)]/10 text-[color:var(--state-danger)]',
  TRIAL: 'border border-[color:var(--state-info)]/40 bg-[color:var(--state-info)]/10 text-[color:var(--state-info)]',
};

export default function TenantsPage() {
  const user = useAdminAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const canEdit = user?.role === 'SUPER_ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/tenants', { params: { page, limit, search: search || undefined } });
      setTenants(unwrapList(res).items);
      setTotal(unwrapList(res).total ?? 0);
    } catch {
      setError('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void load(); }, [load]);

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <PageHero
        title="Tenants"
        subtitle="Manage all tenants on the NeureCore platform"
        actions={
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">{total} total</span>
            {canEdit && (
              <button
                onClick={() => router.push('/tenants/new')}
                className="nv-btn-accent px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                + New Tenant
              </button>
            )}
          </div>
        }
      />
      <div className="max-w-7xl mx-auto">

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search tenants…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-sm rounded-lg border border border-[color:var(--accent-500)]/30 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]"
        />
      </div>

      {error && <div className="mb-4 rounded-lg bg-[color:var(--state-danger)]/10 border border border-[color:var(--state-danger)]/40 p-3 text-sm text-[color:var(--state-danger)]">{error}</div>}

      <div className="rounded-xl border border border-[color:var(--accent-500)]/30 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-zinc-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Agent Limit</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-y divide-[color:var(--accent-500)]/20">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Loading…</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No tenants found</td></tr>
            ) : tenants.map((t) => (
              <tr key={t.id} className="hover:bg-white/5 transition">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-zinc-400">{t.slug}</td>
                <td className="px-4 py-3">{t.plan}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] ?? 'border border-[color:var(--accent-500)]/30 bg-white/5 text-zinc-300'}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3">{t.agentLimit}</td>
                <td className="px-4 py-3 text-zinc-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/tenants/${t.id}`} className="text-xs text-[color:var(--accent-400)] hover:text-[color:var(--accent-300)] hover:underline transition">View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="mt-4 flex items-center gap-2 justify-end">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="rounded px-3 py-1.5 text-sm border border border-[color:var(--accent-500)]/30 disabled:opacity-40 hover:bg-white/5 transition">
            Previous
          </button>
          <span className="text-sm text-zinc-400">Page {page} of {Math.ceil(total / limit)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page * limit >= total}
            className="rounded px-3 py-1.5 text-sm border border border-[color:var(--accent-500)]/30 disabled:opacity-40 hover:bg-white/5 transition">
            Next
          </button>
        </div>
      )}
      </div>
    </AdminShell>
  );
}
