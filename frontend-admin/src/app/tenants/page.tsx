'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHero } from '@neurecore/ui-visual';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';
import { TenantDetailDrawer } from '@/components/tenant/TenantDetailDrawer';
import type { Tenant } from '@/types/api.types';

type SortField = 'name' | 'slug' | 'plan' | 'status' | 'createdAt' | 'agentLimit';
type SortDir = 'asc' | 'desc';

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

  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [drawerTenantId, setDrawerTenantId] = useState<string | null>(null);

  const canEdit = user?.role === 'SUPER_ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/tenants', {
        params: { page, limit, search: search || undefined },
      });
      setTenants(unwrapList(res).items as Tenant[]);
      setTotal(unwrapList(res).total ?? 0);
    } catch {
      setError('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredSorted = useMemo(() => {
    let rows = tenants;
    if (statusFilter) {
      rows = rows.filter((t) => t.status === statusFilter);
    }
    rows = [...rows].sort((a, b) => {
      const getValue = (t: Tenant): string | number => {
        switch (sortField) {
          case 'name':
            return t.name;
          case 'slug':
            return t.slug;
          case 'plan':
            return t.tier?.name ?? t.plan ?? '';
          case 'status':
            return t.status;
          case 'agentLimit':
            return t.tier?.maxAgents ?? t.agentLimit ?? 0;
          case 'createdAt':
          default:
            return new Date(t.createdAt).getTime();
        }
      };
      const av = getValue(a);
      const bv = getValue(b);
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [tenants, statusFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'createdAt' ? 'desc' : 'asc');
    }
  }

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <PageHero
        title="Tenants"
        subtitle="Manage all tenants on the NeureCore platform"
        actions={
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">
              {filteredSorted.length} of {total} total
            </span>
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

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search tenants…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[color:var(--accent-500)]/30 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--accent-500)] min-w-[240px]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[color:var(--accent-500)]/30 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]"
          >
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-[color:var(--state-danger)]/10 border border-[color:var(--state-danger)]/40 p-3 text-sm text-[color:var(--state-danger)]">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-[color:var(--accent-500)]/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-zinc-400 text-xs uppercase tracking-wider">
              <tr>
                <SortHeader
                  label="Name"
                  field="name"
                  current={sortField}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="Slug"
                  field="slug"
                  current={sortField}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="Plan"
                  field="plan"
                  current={sortField}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="Status"
                  field="status"
                  current={sortField}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="Agent Limit"
                  field="agentLimit"
                  current={sortField}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="Created"
                  field="createdAt"
                  current={sortField}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--accent-500)]/20">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    No tenants found
                  </td>
                </tr>
              ) : (
                filteredSorted.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-white/5 transition cursor-pointer"
                    onClick={() => setDrawerTenantId(t.id)}
                  >
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-zinc-400">{t.slug}</td>
                    <td className="px-4 py-3">
                      {t.tier?.name ?? t.plan ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[t.status] ??
                          'border border-[color:var(--accent-500)]/30 bg-white/5 text-zinc-300'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.tier?.maxAgents ?? t.agentLimit ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/tenants/${t.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-[color:var(--accent-400)] hover:text-[color:var(--accent-300)] hover:underline transition"
                      >
                        Full page →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > limit && (
          <div className="mt-4 flex items-center gap-2 justify-end">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded px-3 py-1.5 text-sm border border-[color:var(--accent-500)]/30 disabled:opacity-40 hover:bg-white/5 transition"
            >
              Previous
            </button>
            <span className="text-sm text-zinc-400">
              Page {page} of {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * limit >= total}
              className="rounded px-3 py-1.5 text-sm border border-[color:var(--accent-500)]/30 disabled:opacity-40 hover:bg-white/5 transition"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <TenantDetailDrawer
        tenantId={drawerTenantId}
        open={drawerTenantId !== null}
        onClose={() => setDrawerTenantId(null)}
        onChanged={() => void load()}
        canManage={canEdit}
      />
    </AdminShell>
  );
}

function SortHeader({
  label,
  field,
  current,
  dir,
  onClick,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onClick: (f: SortField) => void;
}) {
  const active = field === current;
  const arrow = !active ? '↕' : dir === 'asc' ? '↑' : '↓';
  return (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
        onClick={() => onClick(field)}
        className={`inline-flex items-center gap-1 font-medium uppercase tracking-wider text-xs hover:text-zinc-200 transition ${
          active ? 'text-zinc-200' : 'text-zinc-400'
        }`}
      >
        {label}
        <span
          className={`text-[10px] ${active ? 'text-[color:var(--accent-300)]' : 'text-zinc-500'}`}
        >
          {arrow}
        </span>
      </button>
    </th>
  );
}
