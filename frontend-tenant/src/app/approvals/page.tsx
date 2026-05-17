'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';

interface ApprovalRequest {
  id: string;
  title: string;
  description?: string;
  resourceType: string;
  status: string;
  priority: string;
  createdAt: string;
  expiresAt?: string;
  requestedBy?: { firstName: string; lastName: string; email: string };
  reviewedBy?: { firstName: string; lastName: string };
  rejectionReason?: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:  'bg-yellow-900 text-yellow-300 border-yellow-700',
  APPROVED: 'bg-green-900 text-green-300 border-green-700',
  REJECTED: 'bg-red-900 text-red-300 border-red-700',
  CANCELLED:'bg-zinc-800 text-zinc-400 border-zinc-700',
  EXPIRED:  'bg-orange-900 text-orange-300 border-orange-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-zinc-400', MEDIUM: 'text-blue-400', HIGH: 'text-orange-400', URGENT: 'text-red-400',
};

type FilterStatus = '' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export default function ApprovalsPage() {
  const user = useTenantAuth();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterStatus>('PENDING');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filter) params.set('status', filter);
      const res = await api.get(`/approvals?${params}`);
      const { items, total } = unwrapList(res);
      setApprovals(items);
      setTotal(total ?? 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { void load(); }, [load]);

  async function handleReview(id: string, decision: 'APPROVED' | 'REJECTED') {
    try {
      await api.patch(`/approvals/${id}/review`, {
        status: decision,
        ...(decision === 'REJECTED' && rejectionReason ? { rejectionReason } : {}),
      });
      setReviewing(null);
      setRejectionReason('');
      void load();
    } catch (err) {
      console.error(err);
    }
  }

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Approvals</h1>
            <p className="text-sm text-zinc-500 mt-1">{total} request{total !== 1 ? 's' : ''}</p>
          </div>
          {/* Filter tabs */}
          <div className="flex gap-2">
            {(['', 'PENDING', 'APPROVED', 'REJECTED'] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => { setFilter(s); setPage(1); }}
                className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                  filter === s
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-zinc-500">Loading…</div>
        ) : approvals.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">No requests found.</div>
        ) : (
          <div className="space-y-3">
            {approvals.map((req) => (
              <div key={req.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded border ${STATUS_COLORS[req.status] ?? ''}`}>
                        {req.status}
                      </span>
                      <span className={`text-xs font-semibold uppercase ${PRIORITY_COLORS[req.priority] ?? ''}`}>
                        {req.priority}
                      </span>
                      <span className="text-xs text-zinc-500 uppercase">{req.resourceType}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">{req.title}</h3>
                    {req.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{req.description}</p>}
                    <div className="mt-2 flex items-center gap-3 text-xs text-zinc-600">
                      {req.requestedBy && (
                        <span>Requested by {req.requestedBy.firstName} {req.requestedBy.lastName}</span>
                      )}
                      <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                      {req.expiresAt && <span>Expires {new Date(req.expiresAt).toLocaleDateString()}</span>}
                    </div>
                    {req.rejectionReason && (
                      <p className="mt-2 text-xs text-red-400">Rejection: {req.rejectionReason}</p>
                    )}
                  </div>
                  {req.status === 'PENDING' && (
                    <div className="shrink-0 flex gap-2">
                      {reviewing === req.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Rejection reason (optional)"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 w-40"
                          />
                          <button
                            onClick={() => handleReview(req.id, 'APPROVED')}
                            className="px-3 py-1 text-xs bg-green-700 hover:bg-green-600 text-white rounded-lg transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(req.id, 'REJECTED')}
                            className="px-3 py-1 text-xs bg-red-700 hover:bg-red-600 text-white rounded-lg transition"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setReviewing(null)}
                            className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setReviewing(req.id)}
                          className="px-3 py-1.5 text-xs bg-violet-700 hover:bg-violet-600 text-white rounded-lg transition"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex justify-center gap-2 mt-6">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 text-xs border border-zinc-700 rounded disabled:opacity-40 text-zinc-400">Prev</button>
            <span className="px-3 py-1 text-xs text-zinc-400">Page {page}</span>
            <button disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 text-xs border border-zinc-700 rounded disabled:opacity-40 text-zinc-400">Next</button>
          </div>
        )}
      </div>
    </TenantShell>
  );
}
