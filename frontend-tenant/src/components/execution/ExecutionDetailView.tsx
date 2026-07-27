// src/components/execution/ExecutionDetailView.tsx
//
// Phase 7 (§9.1) — Execution attempt detail. Shows the full trace
// (attempt metadata, tool calls, evidence artifacts, reviews) and
// exposes the operator recovery controls (retry / cancel).

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  RefreshCcw,
  XCircle,
} from 'lucide-react';
import {
  executionService,
  type ExecutionAttemptSummary,
} from '@/services/execution.service';
import { UnifiedTimeline } from '@/components/timeline';
import { EvidenceViewer } from '@/components/execution/EvidenceViewer';
import { cn } from '@/lib/utils';

export interface ExecutionDetailViewProps {
  attemptId: string;
  className?: string;
  onRetry?: (attemptId: string) => Promise<void> | void;
  onCancel?: (attemptId: string) => Promise<void> | void;
}

type RecoveryState =
  | { kind: 'idle' }
  | { kind: 'busy'; action: 'retry' | 'cancel' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; action: 'retry' | 'cancel'; message: string };

export function ExecutionDetailView({
  attemptId,
  className,
  onRetry,
  onCancel,
}: ExecutionDetailViewProps) {
  const [attempt, setAttempt] = useState<ExecutionAttemptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RecoveryState>({ kind: 'idle' });

  const fetchOnce = useCallback(async () => {
    try {
      const next = await executionService.getAttempt(attemptId);
      setAttempt(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'attempt fetch failed');
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    void fetchOnce();
  }, [fetchOnce]);

  const handleRetry = async () => {
    if (recovery.kind === 'busy') return;
    setRecovery({ kind: 'busy', action: 'retry' });
    try {
      if (onRetry) {
        await onRetry(attemptId);
      } else {
        await executionService.retry(attemptId);
      }
      setRecovery({ kind: 'success', action: 'retry', message: 'New attempt queued.' });
      await fetchOnce();
    } catch (e) {
      setRecovery({
        kind: 'error',
        message: e instanceof Error ? e.message : 'retry failed',
      });
    }
  };

  const handleCancel = async () => {
    if (recovery.kind === 'busy') return;
    setRecovery({ kind: 'busy', action: 'cancel' });
    try {
      if (onCancel) {
        await onCancel(attemptId);
      } else {
        await executionService.cancel(attemptId);
      }
      setRecovery({ kind: 'success', action: 'cancel', message: 'Attempt cancelled.' });
      await fetchOnce();
    } catch (e) {
      setRecovery({
        kind: 'error',
        message: e instanceof Error ? e.message : 'cancel failed',
      });
    }
  };

  if (loading && !attempt) {
    return (
      <div
        role="status"
        className={cn(
          'flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600',
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading execution attempt…
      </div>
    );
  }

  if (error && !attempt) {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700',
          className,
        )}
      >
        <AlertOctagon className="h-4 w-4" aria-hidden />
        <span className="flex-1">{error}</span>
        <button
          type="button"
          onClick={fetchOnce}
          className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!attempt) return null;

  const statusVisual = STATUS_VISUAL[attempt.status] ?? STATUS_VISUAL.DEFAULT;
  const StatusIcon = statusVisual.icon;
  const canRetry = ['FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED', 'TIMED_OUT'].includes(
    attempt.status,
  );
  const canCancel = ['CREATED', 'QUEUED', 'RUNNING', 'WAITING_FOR_TOOL', 'PRODUCING_EVIDENCE', 'PAUSED'].includes(
    attempt.status,
  );

  return (
    <section
      aria-label={`Execution attempt ${attempt.id}`}
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full ring-2',
              statusVisual.bg,
              statusVisual.ring,
            )}
            aria-hidden
          >
            <StatusIcon className={cn('h-5 w-5', statusVisual.tone)} />
          </span>
          <div>
            <p className="text-xs uppercase text-slate-500">Attempt</p>
            <h2 className="text-base font-semibold text-slate-900">
              #{attempt.attemptNumber} · {attempt.status}
            </h2>
            {attempt.task ? (
              <Link
                href={`/projects/${attempt.task.projectId}?task=${attempt.task.id}`}
                className="text-xs text-slate-500 hover:underline"
              >
                Task: {attempt.task.title}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canRetry ? (
            <button
              type="button"
              onClick={handleRetry}
              disabled={recovery.kind === 'busy'}
              className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="execution-retry"
            >
              <RefreshCcw className="h-3 w-3" aria-hidden />
              {recovery.kind === 'busy' && recovery.action === 'retry'
                ? 'Retrying…'
                : 'Retry'}
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              onClick={handleCancel}
              disabled={recovery.kind === 'busy'}
              className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-sm text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="execution-cancel"
            >
              <XCircle className="h-3 w-3" aria-hidden />
              {recovery.kind === 'busy' && recovery.action === 'cancel'
                ? 'Cancelling…'
                : 'Cancel'}
            </button>
          ) : null}
        </div>
      </header>

      {recovery.kind === 'error' ? (
        <p
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {recovery.message}
        </p>
      ) : null}
      {recovery.kind === 'success' ? (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {recovery.message}
        </p>
      ) : null}

      <AttemptMetrics attempt={attempt} />

      {attempt.lastError ? (
        <FailureRecovery error={attempt.lastError} classification={attempt.lastErrorClassification} />
      ) : null}

      <Section title="Tool calls">
        {attempt.toolCalls.length === 0 ? (
          <EmptyHint message="No tool calls were made for this attempt." />
        ) : (
          <ol className="flex flex-col gap-1" role="list">
            {attempt.toolCalls.map((call) => (
              <li
                key={call.id}
                className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <Clock className="h-4 w-4 text-slate-400" aria-hidden />
                <span className="font-mono text-xs">{call.toolName}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    call.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : call.status === 'FAILED'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-200 text-slate-700',
                  )}
                >
                  {call.status}
                </span>
                {call.sideEffect ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                    side-effect
                  </span>
                ) : null}
                {call.errorClassification ? (
                  <span className="text-xs text-rose-600">
                    {call.errorClassification}
                  </span>
                ) : null}
                <span className="ml-auto text-xs text-slate-500">
                  {new Date(call.occurredAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Evidence">
        {attempt.evidence.length === 0 ? (
          <EmptyHint message="No evidence artifacts were produced." />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {attempt.evidence.map((evidence) => (
              <EvidenceViewer key={evidence.id} evidence={evidence} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Reviews">
        {attempt.reviews.length === 0 ? (
          <EmptyHint message="No review requests attached to this attempt." />
        ) : (
          <ul className="flex flex-col gap-2" role="list">
            {attempt.reviews.map((review) => (
              <li
                key={review.id}
                className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">
                  {review.decision ?? 'PENDING'}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(review.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Timeline">
        <UnifiedTimeline
          entityType="ExecutionAttempt"
          entityId={attempt.id}
          ariaLabel={`Execution attempt ${attempt.attemptNumber} timeline`}
          emptyMessage="No execution events yet."
        />
      </Section>
    </section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
      {message}
    </p>
  );
}

function AttemptMetrics({ attempt }: { attempt: ExecutionAttemptSummary }) {
  return (
    <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Metric label="Tokens" value={String(attempt.tokensUsed)} />
      <Metric label="Cost" value={`$${(attempt.costCents / 100).toFixed(2)}`} />
      <Metric label="Tool calls" value={String(attempt.toolCallCount)} />
      <Metric
        label="Duration"
        value={
          attempt.startedAt && attempt.endedAt
            ? `${Math.round(
                (new Date(attempt.endedAt).getTime() -
                  new Date(attempt.startedAt).getTime()) /
                  1000,
              )}s`
            : '—'
        }
      />
    </dl>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function FailureRecovery({
  error,
  classification,
}: {
  error: string;
  classification: string | null;
}) {
  return (
    <div
      className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
      role="alert"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <p className="font-semibold">
          {classification ? `Failure: ${classification}` : 'Execution failed'}
        </p>
      </div>
      <p className="mt-2 text-xs">{error}</p>
      <p className="mt-2 text-xs text-rose-600">
        Use the retry control above to re-queue the task. The retry creates
        a fresh attempt; the prior attempt and its evidence remain
        immutable for audit.
      </p>
    </div>
  );
}

const STATUS_VISUAL: Record<
  string,
  {
    icon: typeof CheckCircle2;
    tone: string;
    bg: string;
    ring: string;
  }
> = {
  RUNNING: {
    icon: Loader2,
    tone: 'text-blue-600',
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
  },
  WAITING_FOR_TOOL: {
    icon: Clock,
    tone: 'text-amber-600',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
  },
  PRODUCING_EVIDENCE: {
    icon: Circle,
    tone: 'text-indigo-600',
    bg: 'bg-indigo-50',
    ring: 'ring-indigo-200',
  },
  SUBMITTED_FOR_REVIEW: {
    icon: CheckCircle2,
    tone: 'text-indigo-600',
    bg: 'bg-indigo-50',
    ring: 'ring-indigo-200',
  },
  NEEDS_INPUT: {
    icon: AlertTriangle,
    tone: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-300',
  },
  FAILED_RETRYABLE: {
    icon: AlertOctagon,
    tone: 'text-rose-600',
    bg: 'bg-rose-50',
    ring: 'ring-rose-200',
  },
  FAILED_FINAL: {
    icon: XCircle,
    tone: 'text-rose-700',
    bg: 'bg-rose-50',
    ring: 'ring-rose-300',
  },
  CANCELLED: {
    icon: XCircle,
    tone: 'text-slate-500',
    bg: 'bg-slate-50',
    ring: 'ring-slate-200',
  },
  COMPLETED: {
    icon: CheckCircle2,
    tone: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-300',
  },
  DEFAULT: {
    icon: Circle,
    tone: 'text-slate-600',
    bg: 'bg-slate-50',
    ring: 'ring-slate-200',
  },
};

export default ExecutionDetailView;
