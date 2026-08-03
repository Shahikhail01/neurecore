'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHero } from '@neurecore/ui-visual';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';
import { TenantDetailDrawer } from '@/components/tenant/TenantDetailDrawer';
import type { UserRole } from '@/types/auth.types';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  tenantId: string | null;
  tenantName?: string | null;
  createdAt: string;
}

type SortField = 'firstName' | 'email' | 'role' | 'isActive' | 'createdAt';
type SortDir = 'asc' | 'desc';

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'border border-[color:var(--accent-500)]/40 bg-[color:var(--accent-500)]/10 text-[color:var(--accent-300)]',
  PLATFORM_ADMIN: 'bg-[color:var(--accent-500)]/15 text-[color:var(--accent-300)]',
  OWNER: 'border border-[color:var(--state-info)]/40 bg-[color:var(--state-info)]/10 text-[color:var(--state-info)]',
  ADMIN: 'border border-[color:var(--state-info)]/40 bg-[color:var(--state-info)]/10 text-[color:var(--state-info)]',
  USER: 'border border-[color:var(--accent-500)]/30 bg-white/5 text-zinc-300',
  SUPPORT: 'border border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]',
  SECURITY_OFFICER: 'border border-amber-700/40 bg-amber-900/20 text-amber-300',
  AUDITOR: 'border border-zinc-700/40 bg-zinc-900/30 text-zinc-300',
};

const ROLE_OPTIONS: UserRole[] = [
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'SECURITY_OFFICER',
  'SUPPORT',
  'OWNER',
  'ADMIN',
  'USER',
  'AUDITOR',
];

export default function UsersPage() {
  const user = useAdminAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [tenantFilter, setTenantFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    'all',
  );
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [drawerTenantId, setDrawerTenantId] = useState<string | null>(null);

  const canManage = user?.role === 'SUPER_ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/users', {
        params: {
          page,
          limit,
          search: search || undefined,
          tenantId: tenantFilter || undefined,
        },
      });
      const list = unwrapList(res).items as User[];
      setUsers(list);
      setTotal(unwrapList(res).total ?? 0);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, tenantFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredSorted = useMemo(() => {
    let rows = users;
    if (roleFilter) {
      rows = rows.filter((u) => u.role === roleFilter);
    }
    if (statusFilter !== 'all') {
      rows = rows.filter((u) =>
        statusFilter === 'active' ? u.isActive : !u.isActive,
      );
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      let cmp: number;
      if (av == null && bv == null) cmp = 0;
      else if (av == null) cmp = -1;
      else if (bv == null) cmp = 1;
      else if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [users, roleFilter, statusFilter, sortField, sortDir]);

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
        title="Users"
        subtitle="Platform users across all tenants"
        actions={
          <span className="text-sm text-zinc-400">
            {filteredSorted.length} of {total} total
          </span>
        }
      />
      <div className="max-w-7xl mx-auto">

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search users…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[color:var(--accent-500)]/30 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--accent-500)] min-w-[220px]"
          />
          <input
            type="search"
            placeholder="Filter by tenant ID…"
            value={tenantFilter}
            onChange={(e) => {
              setTenantFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[color:var(--accent-500)]/30 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--accent-500)] min-w-[200px] font-mono text-xs"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
            className="rounded-lg border border-[color:var(--accent-500)]/30 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]"
          >
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
            }
            className="rounded-lg border border-[color:var(--accent-500)]/30 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]"
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
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
                  field="firstName"
                  current={sortField}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="Email"
                  field="email"
                  current={sortField}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="Role"
                  field="role"
                  current={sortField}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="Status"
                  field="isActive"
                  current={sortField}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <th className="px-4 py-3 text-left">Tenant</th>
                <SortHeader
                  label="Joined"
                  field="createdAt"
                  current={sortField}
                  dir={sortDir}
                  onClick={toggleSort}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--accent-500)]/20">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredSorted.map((u) => (
                  <tr key={u.id} className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 font-medium">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          ROLE_COLORS[u.role] ??
                          'border border-[color:var(--accent-500)]/30 bg-white/5 text-zinc-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.isActive
                            ? 'border border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]'
                            : 'border border-[color:var(--state-danger)]/40 bg-[color:var(--state-danger)]/10 text-[color:var(--state-danger)]'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.tenantId ? (
                        <button
                          type="button"
                          onClick={() => setDrawerTenantId(u.tenantId)}
                          className="text-xs text-[color:var(--accent-300)] hover:text-[color:var(--accent-200)] hover:underline font-mono truncate max-w-[180px] inline-block text-left"
                          title={`Open tenant ${u.tenantId}`}
                        >
                          {u.tenantName || u.tenantId}
                        </button>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(u.createdAt).toLocaleDateString()}
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
        canManage={canManage}
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
