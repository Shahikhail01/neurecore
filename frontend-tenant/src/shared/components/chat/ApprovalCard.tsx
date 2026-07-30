'use client';

import { useState } from 'react';
import { Check, ShieldAlert, X } from 'lucide-react';
import type { AutonomousApprovalData } from '@/shared/types/chat.types';

export function ApprovalCard({ approval, onDecision }: {
  approval: AutonomousApprovalData;
  onDecision: (approval: AutonomousApprovalData, decision: 'approve' | 'reject') => Promise<AutonomousApprovalData | null>;
}) {
  const [current, setCurrent] = useState(approval);
  const [status, setStatus] = useState(current.status);
  const [busy, setBusy] = useState(false);
  const decide = async (decision: 'approve' | 'reject') => {
    setBusy(true);
    try {
      const next = await onDecision(current, decision);
      if (decision === 'approve' && next) {
        setCurrent(next);
        setStatus('PENDING');
      } else {
        setStatus(decision === 'approve' ? 'APPROVED' : 'REJECTED');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 border-t border-surface-border pt-2" data-testid="autonomous-approval-card">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-zinc-100">Approval required</div>
          <div className="break-words text-[10px] text-zinc-400">{current.toolName}</div>
          <div className="mt-0.5 text-[10px] text-zinc-500">{current.reason}</div>
        </div>
      </div>
      {status === 'PENDING' ? (
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy} onClick={() => void decide('approve')} className="inline-flex h-7 items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2 text-[10px] text-emerald-300 disabled:opacity-50">
            <Check className="h-3 w-3" /> Approve
          </button>
          <button type="button" disabled={busy} onClick={() => void decide('reject')} className="inline-flex h-7 items-center gap-1 rounded border border-red-500/40 bg-red-500/10 px-2 text-[10px] text-red-300 disabled:opacity-50">
            <X className="h-3 w-3" /> Reject
          </button>
        </div>
      ) : (
        <div className="mt-2 text-[10px] font-medium text-zinc-300">{status === 'APPROVED' ? 'Approved and resumed' : 'Rejected and stopped'}</div>
      )}
    </div>
  );
}
