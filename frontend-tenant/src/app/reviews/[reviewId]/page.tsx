'use client';
// ─── /reviews/[reviewId] — Review decision page (Phase 6, plan §8.1) ─────
// Shows the full execution context (task, attempt summary, evidence
// artifacts) and exposes the four decision actions:
//   APPROVED            — task → APPROVED
//   REVISION_REQUESTED  — task → QUEUED, new revision attempt created
//   REJECTED            — task → CANCELLED
//   CANCELLED           — review is closed without changing task state
//
// All decisions are atomic. The page is fully refresh-safe (G6): reload
// always returns the authoritative review state.

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  XCircle,
  Ban,
  Loader2,
  FileText,
  Bot,
  Hash,
  Receipt,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import TenantShell from '@/components/TenantShell';
import { GlassPanel } from '@/components/home/GlassPanel';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import {
  reviewsService,
  type ReviewDetail,
  type DecideReviewInput,
} from '@/services/reviews.service';
import { useTenantAuth } from '@/hooks/useTenantAuth';

type Decision = 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED' | 'CANCELLED';

export default function ReviewDetailPage() {
  const params = useParams<{ reviewId: string }>();
  const reviewId = params?.reviewId;
  const router = useRouter();
  const user = useTenantAuth();

  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<Decision | null>(null);
  const [comment, setComment] = useState('');
  const [revisionInstructions, setRevisionInstructions] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !reviewId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await reviewsService.getDetail(reviewId);
      if (!detail) {
        setError('REVIEW_NOT_FOUND');
      } else {
        setReview(detail);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load review');
    } finally {
      setLoading(false);
    }
  }, [user, reviewId]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (decision: Decision) => {
      if (!reviewId) return;
      setSubmitting(decision);
      setActionError(null);
      try {
        const payload: DecideReviewInput = {
          decision,
          comment: comment.trim() || undefined,
          revisionInstructions:
            decision === 'REVISION_REQUESTED'
              ? revisionInstructions.trim() || undefined
              : undefined,
        };
        await reviewsService.decide(reviewId, payload);
        await load();
      } catch (e) {
        setActionError(
          e instanceof Error ? e.message : 'Decision failed',
        );
      } finally {
        setSubmitting(null);
      }
    },
    [reviewId, comment, revisionInstructions, load],
  );

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-zinc-500">
        Loading review…
      </div>
    );
  }

  if (loading) {
    return (
      <TenantShell user={user}>
        <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-zinc-500">
          Loading review…
        </div>
      </TenantShell>
    );
  }

  if (error || !review) {
    return (
      <TenantShell user={user}>
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error ?? 'Review not found'}
          </div>
          <Link
            href="/reviews"
            className="mt-4 inline-flex items-center text-sm text-zinc-600 hover:text-zinc-900"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to inbox
          </Link>
        </div>
      </TenantShell>
    );
  }

  const isPending = review.status === 'PENDING';
  const isAIAssigned =
    Boolean(review.task?.agentId && review.task.agentId === user.id);

  return (
    <TenantShell user={user}>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href="/reviews"
          className="inline-flex items-center text-sm text-zinc-600 hover:text-zinc-900"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to inbox
        </Link>

        <div className="mt-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {review.task?.title ?? `Task ${review.taskId}`}
            </h1>
            {review.task?.description && (
              <p className="mt-1 text-sm text-zinc-500">
                {review.task.description}
              </p>
            )}
            <div className="mt-3 flex items-center gap-3">
              <StatusBadge status={review.status} />
              <span className="text-xs text-zinc-500">
                Created {new Date(review.decidedAt ?? Date.now()).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Execution summary */}
            <GlassPanel>
              <div className="p-5">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Execution summary
                </h2>
                {review.attempt ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <Field label="Attempt #" value={review.attempt.attemptNumber} />
                    <Field label="Status" value={review.attempt.status} />
                    <Field
                      label="Started"
                      value={
                        review.attempt.startedAt
                          ? new Date(review.attempt.startedAt).toLocaleString()
                          : '—'
                      }
                    />
                    <Field
                      label="Ended"
                      value={
                        review.attempt.endedAt
                          ? new Date(review.attempt.endedAt).toLocaleString()
                          : '—'
                      }
                    />
                    <Field label="Tokens" value={review.attempt.tokensUsed} />
                    <Field
                      label="Cost (¢)"
                      value={review.attempt.costCents}
                    />
                    <Field
                      label="Tool calls"
                      value={review.attempt.toolCallCount}
                    />
                    <Field
                      label="Model"
                      value={review.attempt.modelVersion ?? '—'}
                    />
                    <Field
                      label="Prompt ver."
                      value={review.attempt.promptVersion ?? '—'}
                    />
                    <Field
                      label="Graph ver."
                      value={review.attempt.graphVersion ?? '—'}
                    />
                    {review.attempt.outputSummary && (
                      <div className="col-span-2">
                        <Field
                          label="Output summary"
                          value={review.attempt.outputSummary}
                          multiline
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-zinc-500">
                    No attempt linked to this review.
                  </div>
                )}
              </div>
            </GlassPanel>

            {/* Evidence viewer */}
            <GlassPanel>
              <div className="p-5">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Evidence artifacts ({review.attempt?.evidence?.length ?? 0})
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  These are immutable. Approval cannot rewrite prior
                  evidence; revisions create a new attempt with new
                  evidence.
                </p>
                {review.attempt?.evidence?.length ? (
                  <ul className="mt-3 space-y-2">
                    {review.attempt.evidence.map((e) => (
                      <li
                        key={e.id}
                        data-testid={`evidence-row-${e.id}`}
                        className="flex items-start gap-3 rounded border border-zinc-200 bg-white p-3"
                      >
                        <FileText className="mt-0.5 h-4 w-4 text-zinc-400" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                            {e.artifactType}
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600">
                              {e.source}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate font-mono text-xs text-zinc-500">
                            {e.storageRef}
                          </div>
                          <div className="mt-0.5 text-[10px] text-zinc-400">
                            sha256: {e.checksum}
                          </div>
                        </div>
                        <a
                          href={e.storageRef}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          Open
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 text-sm text-zinc-500">
                    No evidence linked to this attempt.
                  </div>
                )}
              </div>
            </GlassPanel>
          </div>

          {/* Decision panel */}
          <div>
            <GlassPanel>
              <div className="p-5">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Decision
                </h2>
                {!isPending ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <Field label="Outcome" value={review.decision} />
                    <Field
                      label="Reviewer"
                      value={review.reviewerId ?? '—'}
                    />
                    <Field
                      label="Decided at"
                      value={
                        review.decidedAt
                          ? new Date(review.decidedAt).toLocaleString()
                          : '—'
                      }
                    />
                    {review.comment && (
                      <Field
                        label="Comment"
                        value={review.comment}
                        multiline
                      />
                    )}
                    {review.revisionInstructions && (
                      <Field
                        label="Revision instructions"
                        value={review.revisionInstructions}
                        multiline
                      />
                    )}
                  </div>
                ) : (
                  <>
                    {isAIAssigned && (
                      <div
                        role="alert"
                        className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800"
                        data-testid="ai-self-review-block"
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                        <span>
                          You are the assigned AI agent for this task and
                          cannot approve your own work.
                        </span>
                      </div>
                    )}

                    <label
                      htmlFor="review-comment"
                      className="mt-3 block text-xs font-medium text-zinc-700"
                    >
                      Comment (optional)
                    </label>
                    <textarea
                      id="review-comment"
                      data-testid="review-comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    />

                    <label
                      htmlFor="revision-instructions"
                      className="mt-3 block text-xs font-medium text-zinc-700"
                    >
                      Revision instructions (required when requesting a
                      revision)
                    </label>
                    <textarea
                      id="revision-instructions"
                      data-testid="revision-instructions"
                      value={revisionInstructions}
                      onChange={(e) => setRevisionInstructions(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    />

                    {actionError && (
                      <div
                        role="alert"
                        className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800"
                        data-testid="review-action-error"
                      >
                        {actionError}
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <DecisionButton
                        onClick={() => void decide('APPROVED')}
                        disabled={isAIAssigned}
                        loading={submitting === 'APPROVED'}
                        tone="success"
                        testId="decide-approve"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </DecisionButton>
                      <DecisionButton
                        onClick={() => void decide('REVISION_REQUESTED')}
                        loading={submitting === 'REVISION_REQUESTED'}
                        tone="warning"
                        testId="decide-revise"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Revise
                      </DecisionButton>
                      <DecisionButton
                        onClick={() => void decide('REJECTED')}
                        loading={submitting === 'REJECTED'}
                        tone="danger"
                        testId="decide-reject"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </DecisionButton>
                      <DecisionButton
                        onClick={() => void decide('CANCELLED')}
                        loading={submitting === 'CANCELLED'}
                        tone="neutral"
                        testId="decide-cancel"
                      >
                        <Ban className="h-3.5 w-3.5" /> Cancel
                      </DecisionButton>
                    </div>
                  </>
                )}
              </div>
            </GlassPanel>

            <GlassPanel>
              <div className="p-5">
                <h2 className="text-sm font-semibold text-zinc-900">
                  AI assignee
                </h2>
                <div className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
                  <Bot className="h-4 w-4 text-zinc-400" />
                  {review.task?.agentId ? (
                    <span className="font-mono text-xs">
                      {review.task.agentId}
                    </span>
                  ) : (
                    <span className="text-zinc-500">Unassigned</span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                  <Hash className="h-3.5 w-3.5" />
                  attempt {review.attempt?.attemptNumber ?? '?'}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  <Receipt className="h-3.5 w-3.5" />
                  review {review.id}
                </div>
              </div>
            </GlassPanel>
          </div>
        </div>
      </div>
    </TenantShell>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | number;
  multiline?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div
        className={
          'mt-0.5 text-sm text-zinc-900 ' +
          (multiline ? 'whitespace-pre-wrap' : 'truncate')
        }
      >
        {value}
      </div>
    </div>
  );
}

type Tone = 'success' | 'warning' | 'danger' | 'neutral';

const toneClasses: Record<Tone, string> = {
  success:
    'border-emerald-300 text-emerald-800 hover:bg-emerald-50 disabled:opacity-50',
  warning:
    'border-amber-300 text-amber-800 hover:bg-amber-50 disabled:opacity-50',
  danger:
    'border-red-300 text-red-800 hover:bg-red-50 disabled:opacity-50',
  neutral:
    'border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50',
};

function DecisionButton({
  children,
  onClick,
  disabled,
  loading,
  tone,
  testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone: Tone;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      data-testid={testId}
      className={
        'inline-flex items-center justify-center gap-1.5 rounded border bg-white px-2 py-1.5 text-xs font-medium ' +
        toneClasses[tone]
      }
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}
