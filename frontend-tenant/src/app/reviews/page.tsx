'use client';
// ─── /reviews — Review Inbox (Phase 6, plan §8.1) ──────────────────────────
// Lists all pending reviews for the tenant. Each entry links to the
// detail page where the human reviewer can decide (approve / revise /
// reject / cancel) or wait for the AI to resubmit.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle2, FileText, Clock, ChevronRight } from 'lucide-react';
import TenantShell from '@/components/TenantShell';
import { GlassPanel } from '@/components/home/GlassPanel';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { reviewsService, type ReviewListItem } from '@/services/reviews.service';
import { useTenantAuth } from '@/hooks/useTenantAuth';

export default function ReviewsInboxPage() {
  const user = useTenantAuth();
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await reviewsService.listPending();
      setReviews(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reviews');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) {
    return (
      <div className="p-8 text-sm text-zinc-500">Loading review inbox…</div>
    );
  }

  return (
    <TenantShell user={user}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Review Inbox</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Approve, request revisions, or reject work submitted by your AI
              employees. Each decision is atomic and auditable.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            disabled={loading}
            data-testid="reviews-refresh"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <GlassPanel>
          {loading && reviews.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">Loading…</div>
          ) : reviews.length === 0 ? (
            <div
              className="p-12 text-center"
              data-testid="reviews-empty"
            >
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
              <h2 className="mt-4 text-lg font-medium text-zinc-900">
                All caught up
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                No pending reviews right now. Refresh after new AI work
                completes.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200" data-testid="reviews-list">
              {reviews.map((r) => (
                <ReviewRow key={r.id} review={r} />
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>
    </TenantShell>
  );
}

function ReviewRow({ review }: { review: ReviewListItem }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Link
        href={`/reviews/${encodeURIComponent(review.id)}`}
        className="flex items-center justify-between gap-4 p-4 hover:bg-zinc-50"
        data-testid={`review-row-${review.id}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="h-5 w-5 flex-shrink-0 text-zinc-400" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-zinc-900">
              {review.task?.title ?? `Task ${review.taskId}`}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
              <Clock className="h-3 w-3" />
              <span>
                Attempt {review.attempt?.attemptNumber ?? '?'} · {review.attempt?.status ?? 'UNKNOWN'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={review.status} />
          <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-700" />
        </div>
      </Link>
    </motion.li>
  );
}
