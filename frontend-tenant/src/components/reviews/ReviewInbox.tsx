// src/components/reviews/ReviewInbox.tsx
//
// Phase 7 (§9.1) — Review inbox. Lists pending reviews with the
// task and attempt context. Selecting a review opens the in-page
// decide panel (P1 — approve / request revision / reject).

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { CheckCircle2, Loader2, RefreshCcw, XCircle, AlertTriangle } from 'lucide-react';
import api from '@/services/api';
import { cn } from '@/lib/utils';

export interface ReviewInboxItem {
  id: string;
  status: string;
  decision: string | null;
  createdAt: string;
  task?: {
    id: string;
    title: string;
    status: string;
    projectId: string;
    agentId?: string | null;
  };
  attempt?: {
    id: string;
    attemptNumber: number;
    status: string;
  };
  version?: number;
}

export interface ReviewInboxProps {
  className?: string;
  onSelect?: (review: ReviewInboxItem) => void;
}

export function ReviewInbox({ className, onSelect }: ReviewInboxProps) {
  const [pending, setPending] = useState<ReviewInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [transport, setTransport] = useState<'socket' | 'polling' | 'idle'>('idle');

  const fetchOnce = useCallback(async () => {
    try {
      const res = await api.get('/reviews/pending');
      const inner = (res as any)?.data?.data ?? (res as any)?.data ?? res;
      const list = Array.isArray(inner) ? (inner as ReviewInboxItem[]) : [];
      setPending(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'pending reviews failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const socket: Socket = io({
      withCredentials: true,
      transports: ['polling'],
      upgrade: false,
      autoConnect: false,
    });

    const onEvent = (payload: {
      entityType?: string;
      entityId?: string;
      event?: { eventType?: string };
    }) => {
      if (
        payload?.entityType === 'Review' &&
        (payload.event?.eventType === 'ReviewRequested' ||
          payload.event?.eventType === 'ReviewApproved')
      ) {
        void fetchOnce();
      }
    };

    const onConnect = () => {
      if (!mounted) return;
      setTransport('socket');
    };

    const onDisconnect = () => setTransport('polling');

    socket.on('timeline:event', onEvent);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    socket.connect();
    return () => {
      mounted = false;
      socket.off('timeline:event', onEvent);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, [fetchOnce]);

  // Polling fallback for environments where the socket is unavailable.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (cancelled) return;
      await fetchOnce();
      if (cancelled) return;
      if (transport !== 'socket') setTransport('polling');
      timer = setTimeout(tick, 7000);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [fetchOnce, transport]);

  const sorted = useMemo(
    () =>
      pending.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [pending],
  );

  const decide = async (
    review: ReviewInboxItem,
    decision: 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED' | 'CANCELLED',
  ) => {
    setBusy(review.id);
    try {
      await api.post(`/reviews/${review.id}/decide`, {
        decision,
        comment: decision === 'APPROVED' ? 'Approved from inbox' : undefined,
      });
      await fetchOnce();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'decision failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-label="Review inbox"
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Review inbox
          </h2>
          <p className="text-xs text-slate-500">
            {pending.length} pending · transport: {transport}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOnce}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          aria-label="Refresh review inbox"
        >
          <RefreshCcw className="h-3 w-3" aria-hidden />
        </button>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          {error}
        </p>
      ) : null}

      {loading && pending.length === 0 ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-slate-500"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading inbox…
        </div>
      ) : sorted.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
          Inbox is empty — nothing awaiting your attention.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {sorted.map((review) => (
            <ReviewRow
              key={review.id}
              review={review}
              busy={busy === review.id}
              onSelect={onSelect}
              onDecide={decide}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewRow({
  review,
  busy,
  onSelect,
  onDecide,
}: {
  review: ReviewInboxItem;
  busy: boolean;
  onSelect?: (review: ReviewInboxItem) => void;
  onDecide: (
    review: ReviewInboxItem,
    decision: 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED' | 'CANCELLED',
  ) => void;
}) {
  return (
    <li
      className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3"
      data-testid={`review-${review.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {review.task?.title ?? 'Review'}
          </p>
          <p className="text-xs text-slate-500">
            Attempt #{review.attempt?.attemptNumber ?? '?'} · task{' '}
            <span className="font-mono">
              {review.task?.id?.slice(0, 8) ?? '?'}
            </span>
          </p>
        </div>
        {review.task?.projectId ? (
          <Link
            href={`/projects/${review.task.projectId}`}
            className="text-xs text-slate-500 hover:underline"
          >
            View project
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onDecide(review, 'APPROVED')}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid={`review-approve-${review.id}`}
        >
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Approve
        </button>
        <button
          type="button"
          onClick={() => onDecide(review, 'REVISION_REQUESTED')}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Request revision
        </button>
        <button
          type="button"
          onClick={() => onDecide(review, 'REJECTED')}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <XCircle className="h-3 w-3" aria-hidden />
          Reject
        </button>
        {onSelect ? (
          <button
            type="button"
            onClick={() => onSelect(review)}
            className="ml-auto rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            Open
          </button>
        ) : null}
      </div>
    </li>
  );
}

export default ReviewInbox;
