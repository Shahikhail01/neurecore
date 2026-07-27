// src/components/initiation/InitiationStatusView.tsx
//
// Phase 7 (§9.1) — Initiation status surface. Renders the canonical
// InitiationStatus state machine and the history of initiation events
// drawn from the unified timeline. The card is self-contained so it can
// be embedded in the project workspace, the initiation detail page, or
// the home dashboard.

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, Loader2, XCircle, AlertTriangle } from 'lucide-react';
import { UnifiedTimeline } from '@/components/timeline/UnifiedTimeline';
import { cn } from '@/lib/utils';

export type InitiationStatusValue =
  | 'DRAFT'
  | 'DISCOVERING'
  | 'READY_FOR_CONFIRMATION'
  | 'APPROVED'
  | 'MATERIALIZING'
  | 'COMPLETED'
  | 'NEEDS_INPUT'
  | 'FAILED_RETRYABLE'
  | 'FAILED_FINAL'
  | 'CANCELLED';

export interface InitiationStatus {
  id: string;
  status: InitiationStatusValue;
  projectId: string | null;
  projectName?: string;
  approvedByActorId?: string | null;
  approvedAt?: string | null;
  approvalComment?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InitiationStatusViewProps {
  initiation: InitiationStatus;
  className?: string;
  showTimeline?: boolean;
}

const STEP_ORDER: InitiationStatusValue[] = [
  'DRAFT',
  'DISCOVERING',
  'READY_FOR_CONFIRMATION',
  'APPROVED',
  'MATERIALIZING',
  'COMPLETED',
];

const STATUS_LABELS: Record<InitiationStatusValue, string> = {
  DRAFT: 'Draft',
  DISCOVERING: 'Discovering',
  READY_FOR_CONFIRMATION: 'Ready for confirmation',
  APPROVED: 'Approved',
  MATERIALIZING: 'Materializing',
  COMPLETED: 'Completed',
  NEEDS_INPUT: 'Needs input',
  FAILED_RETRYABLE: 'Failed (retryable)',
  FAILED_FINAL: 'Failed (final)',
  CANCELLED: 'Cancelled',
};

const STATUS_TONE: Record<
  InitiationStatusValue,
  { icon: typeof CheckCircle2; tone: string; ring: string; bg: string }
> = {
  DRAFT: {
    icon: Clock,
    tone: 'text-slate-600',
    ring: 'ring-slate-200',
    bg: 'bg-slate-100',
  },
  DISCOVERING: {
    icon: Loader2,
    tone: 'text-sky-600',
    ring: 'ring-sky-200',
    bg: 'bg-sky-50',
  },
  READY_FOR_CONFIRMATION: {
    icon: CheckCircle2,
    tone: 'text-amber-600',
    ring: 'ring-amber-200',
    bg: 'bg-amber-50',
  },
  APPROVED: {
    icon: CheckCircle2,
    tone: 'text-emerald-600',
    ring: 'ring-emerald-200',
    bg: 'bg-emerald-50',
  },
  MATERIALIZING: {
    icon: Loader2,
    tone: 'text-indigo-600',
    ring: 'ring-indigo-200',
    bg: 'bg-indigo-50',
  },
  COMPLETED: {
    icon: CheckCircle2,
    tone: 'text-emerald-700',
    ring: 'ring-emerald-300',
    bg: 'bg-emerald-50',
  },
  NEEDS_INPUT: {
    icon: AlertTriangle,
    tone: 'text-amber-700',
    ring: 'ring-amber-300',
    bg: 'bg-amber-50',
  },
  FAILED_RETRYABLE: {
    icon: AlertTriangle,
    tone: 'text-rose-600',
    ring: 'ring-rose-200',
    bg: 'bg-rose-50',
  },
  FAILED_FINAL: {
    icon: XCircle,
    tone: 'text-rose-700',
    ring: 'ring-rose-300',
    bg: 'bg-rose-50',
  },
  CANCELLED: {
    icon: XCircle,
    tone: 'text-slate-600',
    ring: 'ring-slate-200',
    bg: 'bg-slate-50',
  },
};

export function InitiationStatusView({
  initiation,
  className,
  showTimeline = true,
}: InitiationStatusViewProps) {
  const tone = STATUS_TONE[initiation.status];
  const Icon = tone.icon;
  const isInFinalState = useMemo(
    () =>
      ['COMPLETED', 'CANCELLED', 'FAILED_FINAL'].includes(initiation.status),
    [initiation.status],
  );

  return (
    <section
      aria-label={`Initiation ${initiation.id} status`}
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full ring-2',
              tone.bg,
              tone.ring,
            )}
            aria-hidden
          >
            <Icon className={cn('h-5 w-5', tone.tone)} />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Initiation
            </p>
            <h2 className="text-base font-semibold text-slate-900">
              {STATUS_LABELS[initiation.status]}
            </h2>
          </div>
        </div>
        {initiation.projectId ? (
          <Link
            href={`/projects/${initiation.projectId}`}
            className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            View project
          </Link>
        ) : null}
      </header>

      <Stepper
        status={initiation.status}
        currentStep={STEP_ORDER.indexOf(initiation.status)}
      />

      <dl className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
        {initiation.customerName ? (
          <div>
            <dt className="text-xs uppercase text-slate-500">Customer</dt>
            <dd>{initiation.customerName}</dd>
          </div>
        ) : null}
        {initiation.approvedAt ? (
          <div>
            <dt className="text-xs uppercase text-slate-500">Approved at</dt>
            <dd>{new Date(initiation.approvedAt).toLocaleString()}</dd>
          </div>
        ) : null}
        {initiation.approvalComment ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-slate-500">Approval comment</dt>
            <dd>{initiation.approvalComment}</dd>
          </div>
        ) : null}
      </dl>

      {isInFinalState ? (
        <p
          role="status"
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
        >
          The initiation is closed. Use the project timeline for any
          subsequent task history.
        </p>
      ) : null}

      {showTimeline ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">
            History
          </h3>
          <UnifiedTimeline
            entityType="Initiation"
            entityId={initiation.id}
            emptyMessage="No history yet — discovery events will appear here."
          />
        </div>
      ) : null}
    </section>
  );
}

function Stepper({
  status,
  currentStep,
}: {
  status: InitiationStatusValue;
  currentStep: number;
}) {
  if (currentStep < 0) {
    // Exceptional state — show a single badge instead of an empty bar.
    const tone = STATUS_TONE[status];
    const Icon = tone.icon;
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
          tone.bg,
          tone.ring,
        )}
      >
        <Icon className={cn('h-4 w-4', tone.tone)} aria-hidden />
        <span className="font-medium">{STATUS_LABELS[status]}</span>
      </div>
    );
  }

  return (
    <ol
      className="grid grid-cols-3 gap-2 sm:grid-cols-6"
      aria-label="Initiation progress"
    >
      {STEP_ORDER.map((step, idx) => {
        const reached = idx <= currentStep;
        const stepTone = STATUS_TONE[step];
        const StepIcon = stepTone.icon;
        return (
          <li
            key={step}
            className={cn(
              'flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-center text-xs',
              reached
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-500',
            )}
            aria-current={idx === currentStep ? 'step' : undefined}
          >
            <StepIcon
              className={cn(
                'h-4 w-4',
                reached ? 'text-emerald-600' : 'text-slate-400',
              )}
              aria-hidden
            />
            <span className="font-medium">{STATUS_LABELS[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default InitiationStatusView;
