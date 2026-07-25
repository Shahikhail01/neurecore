'use client';

import { useState, useEffect } from 'react';
import { CheckSquare, XSquare, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/creatio/Modal';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import type { Deliverable } from '@/services/deliverables.service';
import { deliverablesService } from '@/services/deliverables.service';
import type { ApprovalWorkflow } from '@/services/approval-chains.service';
import { approvalChainsService } from '@/services/approval-chains.service';
import { executionLogService } from '@/services/execution-log.service';

interface ApprovalsModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  deliverables: Deliverable[];
  approvals: ApprovalWorkflow[];
  onApprovalsLoaded: (w: ApprovalWorkflow[]) => void;
}

export function ApprovalsModal({
  open,
  onClose,
  projectId,
  deliverables,
  approvals,
  onApprovalsLoaded,
}: ApprovalsModalProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    approvalChainsService
      .getPendingWorkflows()
      .then((w) => onApprovalsLoaded(w))
      .catch(() => onApprovalsLoaded([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const inReviewDeliverables = deliverables.filter((d) => d.status === 'IN_REVIEW');

  const handleApprove = async (deliverableId: string, taskId?: string | null) => {
    if (taskId) {
      await executionLogService.create({
        taskId,
        action: 'APPROVE',
        actorType: 'HUMAN',
        actorId: '',
        notes: '',
      });
    }
    await deliverablesService.update(deliverableId, { status: 'APPROVED' });
    const updated = await approvalChainsService.getPendingWorkflows();
    onApprovalsLoaded(updated);
  };

  const handleReject = async (deliverableId: string, taskId?: string | null) => {
    if (taskId) {
      await executionLogService.create({
        taskId,
        action: 'REJECT',
        actorType: 'HUMAN',
        actorId: '',
        notes: '',
      });
    }
    await deliverablesService.update(deliverableId, { status: 'REJECTED' });
    const updated = await approvalChainsService.getPendingWorkflows();
    onApprovalsLoaded(updated);
  };

  return (
    <Modal open onClose={onClose} title="Approval Queue">
      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-zinc-500 text-center py-4">Loading…</p>
        ) : inReviewDeliverables.length === 0 && approvals.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">
            No pending approvals for this project.
          </p>
        ) : (
          <>
            {inReviewDeliverables.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">
                  Deliverables In Review
                </p>
                <div className="space-y-2">
                  {inReviewDeliverables.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 p-3 border border-surface-border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-100 truncate">{d.name}</p>
                        {d.description && (
                          <p className="text-xs text-zinc-500 truncate">{d.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {d.riskTier && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                d.riskTier === 'HIGH'
                                  ? 'border-[color:var(--state-danger)]/30 text-[color:var(--state-danger)]'
                                  : d.riskTier === 'MEDIUM'
                                    ? 'border-yellow-500/30 text-yellow-400'
                                    : 'border-[color:var(--state-success)]/30 text-[color:var(--state-success)]'
                              }`}
                            >
                              {d.riskTier}
                            </span>
                          )}
                          <StatusBadge status={d.status} />
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <ActionButton
                          variant="ghost"
                          size="sm"
                          icon={<CheckSquare className="w-3.5 h-3.5 text-[color:var(--state-success)]" />}
                          onClick={() => handleApprove(d.id, d.taskId)}
                        >
                          Approve
                        </ActionButton>
                        <ActionButton
                          variant="ghost"
                          size="sm"
                          icon={<XSquare className="w-3.5 h-3.5 text-[color:var(--state-danger)]" />}
                          onClick={() => handleReject(d.id, d.taskId)}
                        >
                          Reject
                        </ActionButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {approvals.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">
                  Pending Approval Workflows
                </p>
                <div className="space-y-2">
                  {approvals.map((w) => (
                    <div
                      key={w.id}
                      className="p-3 border border-surface-border rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-zinc-100">{w.name || 'Approval Workflow'}</p>
                        <StatusBadge status={w.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {w.steps.map((step, idx) => (
                          <div
                            key={step.id}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${
                              step.status === 'APPROVED'
                                ? 'border-[color:var(--state-success)]/30 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]'
                                : step.status === 'REJECTED'
                                  ? 'border-[color:var(--state-danger)]/30 bg-[color:var(--state-danger)]/10 text-[color:var(--state-danger)]'
                                  : 'border-surface-border text-zinc-400'
                            }`}
                          >
                            {step.blockedByPriorStep && idx > 0 && (
                              <AlertTriangle className="w-3 h-3 text-yellow-500" />
                            )}
                            <span>{step.approverRole[0]?.replace(/_/g, ' ') ?? `Step ${idx + 1}`}</span>
                            {step.status === 'APPROVED' && <CheckSquare className="w-3 h-3" />}
                            {step.status === 'REJECTED' && <XSquare className="w-3 h-3" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
