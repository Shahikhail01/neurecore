'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHero, GlassPanel } from '@neurecore/ui-visual';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';
import type { ApiResponse, PaginatedData } from '@/types/api.types';
import type { UserRole } from '@/types/auth.types';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  tenantId: string | null;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'border border-[color:var(--accent-500)]/40 bg-[color:var(--accent-500)]/10 text-[color:var(--accent-300)]',
  PLATFORM_ADMIN: 'bg-[color:var(--accent-500)]/15 text-[color:var(--accent-300)]',
  OWNER: 'border border-[color:var(--state-info)]/40 bg-[color:var(--state-info)]/10 text-[color:var(--state-info)]',
  ADMIN: 'border border-[color:var(--state-info)]/40 bg-[color:var(--state-info)]/10 text-[color:var(--state-info)]',
  USER: 'border border-[color:var(--accent-500)]/30 bg-white/5 text-zinc-300',
  SUPPORT: 'border border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]',
};

export default function UsersPage() {
  const user = useAdminAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/users', { params: { page, limit, search: search || undefined } });
      setUsers(unwrapList(res).items);
      setTotal(unwrapList(res).total ?? 0);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void load(); }, [load]);

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <PageHero
        title="Users"
        subtitle="Platform users across all tenants"
        actions={<span className="text-sm text-zinc-400">{total} total</span>}
      />
      <div className="max-w-7xl mx-auto">

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search users…"
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
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Tenant</th>
              <th className="px-4 py-3 text-left">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-y divide-[color:var(--accent-500)]/20">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-white/5 transition">
                <td className="px-4 py-3 font-medium">{u.firstName} {u.lastName}</td>
                <td className="px-4 py-3 text-zinc-400">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] ?? 'border border-[color:var(--accent-500)]/30 bg-white/5 text-zinc-300'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? 'border border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]' : 'border border-[color:var(--state-danger)]/40 bg-[color:var(--state-danger)]/10 text-[color:var(--state-danger)]'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400 truncate max-w-[140px]">{u.tenantId ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-400">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
