"use client";

/**
 * /governance/dsr — GDPR DSR Workflow (Phase 2; v2 plan §5.4.8).
 *
 * Renders the list, supports the open/start/complete/reject/cancel
 * state machine. No business logic — all state transitions go through
 * the backend service.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Plus, Play, Check, X } from 'lucide-react';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  listRequests,
  openRequest,
  startRequest,
  completeRequest,
  rejectRequest,
  cancelRequest,
  type DsrRequest,
  type DsrRequestType,
  type DsrRequestStatus,
} from '@/services/dsr.service';

const STATUS_COLOR: Record<DsrRequestStatus, string> = {
  OPEN: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  COMPLETED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  REJECTED: 'bg-red-500/15 text-red-300 border-red-500/30',
  CANCELLED: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
};

export default function DsrPage() {
  const user = useAdminAuth();
  const [requests, setRequests] = useState<DsrRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await listRequests();
      setRequests(list);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const advance = async (
    id: string,
    op: 'start' | 'complete' | 'reject' | 'cancel',
  ) => {
    try {
      if (op === 'start') await startRequest(id);
      if (op === 'complete') await completeRequest(id, { resolvedBy: 'admin' });
      if (op === 'reject') {
        const reason = prompt('Reason for rejection?');
        if (!reason) return;
        await rejectRequest(id, reason);
      }
      if (op === 'cancel') await cancelRequest(id);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <AdminShell user={user}>
      <div className="px-6 py-8 max-w-6xl">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">GDPR DSR Workflow</h1>
            <p className="text-sm text-white/60 mt-1">
              Data Subject Requests — Articles 15-22. State machine: OPEN →
              IN_PROGRESS → COMPLETED (or REJECTED / CANCELLED).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-1 rounded border border-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1 rounded bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-sm text-white"
            >
              <Plus className="h-4 w-4" /> New request
            </button>
          </div>
        </header>

        {err && (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {showCreate && <CreateForm onCreated={() => { setShowCreate(false); refresh(); }} />}

        <div className="rounded-md border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs text-white/60">
              <tr>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Subject</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Opened</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-white/40">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-white/40">
                    No DSR requests yet.
                  </td>
                </tr>
              )}
              {requests.map((r) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-white/5"
                >
                  <td className="px-3 py-2 text-white">{r.type}</td>
                  <td className="px-3 py-2 text-xs text-white/70">
                    {r.subjectKind}/{r.subjectId.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded border px-2 py-0.5 text-[10px] ${STATUS_COLOR[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-white/60">
                    {new Date(r.openedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RowActions r={r} onAdvance={advance} />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

function RowActions({
  r,
  onAdvance,
}: {
  r: DsrRequest;
  onAdvance: (id: string, op: 'start' | 'complete' | 'reject' | 'cancel') => Promise<void>;
}) {
  const buttons: JSX.Element[] = [];
  if (r.status === 'OPEN') {
    buttons.push(
      <button
        key="start"
        type="button"
        onClick={() => onAdvance(r.id, 'start')}
        className="rounded border border-white/10 p-1 text-blue-300 hover:bg-blue-500/10"
        aria-label="Start"
      >
        <Play className="h-4 w-4" />
      </button>,
    );
    buttons.push(
      <button
        key="reject"
        type="button"
        onClick={() => onAdvance(r.id, 'reject')}
        className="rounded border border-white/10 p-1 text-red-300 hover:bg-red-500/10"
        aria-label="Reject"
      >
        <X className="h-4 w-4" />
      </button>,
    );
    buttons.push(
      <button
        key="cancel"
        type="button"
        onClick={() => onAdvance(r.id, 'cancel')}
        className="rounded border border-white/10 p-1 text-zinc-300 hover:bg-zinc-500/10"
        aria-label="Cancel"
      >
        <X className="h-4 w-4" />
      </button>,
    );
  }
  if (r.status === 'IN_PROGRESS') {
    buttons.push(
      <button
        key="complete"
        type="button"
        onClick={() => onAdvance(r.id, 'complete')}
        className="rounded border border-white/10 p-1 text-emerald-300 hover:bg-emerald-500/10"
        aria-label="Complete"
      >
        <Check className="h-4 w-4" />
      </button>,
    );
    buttons.push(
      <button
        key="reject2"
        type="button"
        onClick={() => onAdvance(r.id, 'reject')}
        className="rounded border border-white/10 p-1 text-red-300 hover:bg-red-500/10"
        aria-label="Reject"
      >
        <X className="h-4 w-4" />
      </button>,
    );
  }
  return <div className="flex justify-end gap-1">{buttons}</div>;
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [type, setType] = useState<DsrRequestType>('EXPORT');
  const [subjectId, setSubjectId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      await openRequest({ type, subjectId, reason: reason || undefined });
      setSubjectId('');
      setReason('');
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-4 rounded-md border border-white/10 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as DsrRequestType)}
          className="rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
        >
          {(['EXPORT', 'DELETE', 'RESTRICT', 'RECTIFY', 'PORTABILITY'] as const).map(
            (t) => (
              <option key={t} value={t} className="bg-zinc-900">
                {t}
              </option>
            ),
          )}
        </select>
        <input
          type="text"
          placeholder="subject id (user or contact)"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
        />
      </div>
      <textarea
        placeholder="reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-xs text-white"
      />
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !subjectId}
          className="rounded bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {submitting ? 'Opening…' : 'Open request'}
        </button>
      </div>
    </div>
  );
}
