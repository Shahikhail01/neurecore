// src/components/operator/RecoveryActions.tsx
//
// Phase 7 (§9.1) — Operator recovery controls. Provides retry / cancel
// buttons with accessibility, plus a failure-recovery guidance
// panel that surfaces copy-pasteable commands for SREs.

'use client';

import { RefreshCcw, XCircle, ShieldAlert, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RecoveryActionsProps {
  attemptId?: string;
  onRetry?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  onView?: () => void;
  retryDisabled?: boolean;
  cancelDisabled?: boolean;
  className?: string;
}

export function RecoveryActions({
  attemptId,
  onRetry,
  onCancel,
  onView,
  retryDisabled,
  cancelDisabled,
  className,
}: RecoveryActionsProps) {
  return (
    <div
      role="group"
      aria-label="Operator recovery controls"
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2',
        className,
      )}
    >
      {onView ? (
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          data-testid="recovery-view"
        >
          <Eye className="h-3 w-3" aria-hidden />
          View
        </button>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retryDisabled}
          className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="recovery-retry"
        >
          <RefreshCcw className="h-3 w-3" aria-hidden />
          Retry
        </button>
      ) : null}
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelDisabled}
          className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-sm text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="recovery-cancel"
        >
          <XCircle className="h-3 w-3" aria-hidden />
          Cancel
        </button>
      ) : null}
      {attemptId ? (
        <span className="ml-auto font-mono text-xs text-slate-500">
          {attemptId.slice(0, 8)}
        </span>
      ) : null}
    </div>
  );
}

export interface RecoveryHintProps {
  errorMessage: string;
  classification?: string | null;
  runbookLink?: string;
  className?: string;
}

const KNOWN_HINTS: Record<string, string> = {
  TRANSIENT_INFRASTRUCTURE:
    'This is a transient infrastructure error. The system will retry automatically. If retries are exhausted, use the Operator retry control to re-queue the task.',
  INVALID_INPUT:
    'The task is missing required inputs. Edit the task to supply the inputs, then retry — do not retry without supplying inputs.',
  POLICY_DENIAL:
    'Policy denied this execution. Review the policy snapshot in the attempt detail and update the policy assignment before retrying.',
  TOOL_FUNCTIONAL_FAILURE:
    'An integrated tool failed. Inspect the tool call log in the trace and contact the tool owner if the failure persists.',
  MODEL_QUALITY_FAILURE:
    'The model produced below-threshold output. You may retry; the system will rotate the prompt if the policy allows.',
  BUDGET_EXHAUSTION:
    'Token or cost budget exhausted. Increase the budget on the task policy before retrying.',
  CANCELLATION:
    'The attempt was cancelled. Use Operator retry to re-queue.',
};

export function RecoveryHint({
  errorMessage,
  classification,
  runbookLink,
  className,
}: RecoveryHintProps) {
  const hint =
    (classification && KNOWN_HINTS[classification]) ||
    KNOWN_HINTS.INVALID_INPUT;

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4" aria-hidden />
        <p className="font-semibold">Recovery guidance</p>
      </div>
      <p className="text-xs text-amber-700">{hint}</p>
      <p className="text-xs">{errorMessage}</p>
      {runbookLink ? (
        <a
          href={runbookLink}
          className="text-xs font-medium text-amber-700 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Runbook
        </a>
      ) : null}
    </div>
  );
}

export default RecoveryActions;
