'use client';

import type { DelegationFormData } from '@/types/delegation.types';

interface Props {
  form: DelegationFormData;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-surface-border last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-200 text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW:      'text-zinc-400',
  MEDIUM:   'text-indigo-300',
  HIGH:     'text-amber-300',
  CRITICAL: 'text-red-300',
};

export function StepReview({ form }: Props) {
  const authorityLabel: Record<string, string> = {
    EXECUTE:           'Execute Autonomously',
    APPROVE_THRESHOLD: `Approve > $${form.approvalThreshold ?? 0}`,
    APPROVE_ME:        'Always Approve',
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Summary card */}
      <div className="bg-surface-overlay border border-surface-border rounded-xl p-4">
        <Row label="Title"      value={form.title} />
        <Row label="Department" value={form.departmentName || '—'} />
        <Row label="Agent"      value={form.agentName ?? 'Auto-assign'} />
        <Row
          label="Priority"
          value={
            <span className={PRIORITY_COLOR[form.priority] ?? ''}>{form.priority}</span>
          }
        />
        <Row label="Authority"  value={authorityLabel[form.authority] ?? form.authority} />
        {form.deadline && <Row label="Deadline" value={new Date(form.deadline).toLocaleString()} />}
        <Row label="Max Retries" value={form.maxRetries} />
        {form.tags.length > 0 && <Row label="Tags" value={form.tags.join(', ')} />}
      </div>

      {/* Estimated cost */}
      {form.estimatedCost !== undefined && (
        <div className="flex items-center justify-between bg-surface-overlay border border-surface-border rounded-xl px-4 py-3">
          <span className="text-xs text-zinc-500">Estimated Cost</span>
          <span className="text-sm font-mono font-semibold text-status-profit">
            ${form.estimatedCost.toFixed(4)}
          </span>
        </div>
      )}

      {/* Description preview */}
      <div>
        <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
          Description
        </div>
        <p className="text-sm text-zinc-300 bg-surface-overlay border border-surface-border rounded-xl p-4 whitespace-pre-wrap">
          {form.description}
        </p>
      </div>
    </div>
  );
}
