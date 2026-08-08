'use client';

import { useState } from 'react';
import { Modal } from '@/components/creatio/Modal';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import type { ProjectStatus } from '@/services/projects.service';

interface TransitionModalProps {
  open: boolean;
  onClose: () => void;
  currentStatus: ProjectStatus;
  allowed: ProjectStatus[];
  onConfirm: (next: ProjectStatus, reason?: string) => Promise<void>;
}

export function TransitionModal({
  open,
  onClose,
  currentStatus,
  allowed,
  onConfirm,
}: TransitionModalProps) {
  const [next, setNext] = useState<ProjectStatus>(allowed[0] ?? currentStatus);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      await onConfirm(next, next === 'LOST' ? reason : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Transition Project Status">
      <div className="space-y-4">
        <p className="text-sm text-zinc-400">
          Current: <span className="text-zinc-200 font-medium">{currentStatus}</span>
        </p>
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Transition to</label>
          <select
            aria-label="Transition to status"
            value={next}
            onChange={(e) => setNext(e.target.value as ProjectStatus)}
            className="w-full px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
          >
            {allowed.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {next === 'LOST' && (
          <div>
            <label className="text-xs text-zinc-500">Reason (required)</label>
            <textarea
              aria-label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
              rows={3}
              placeholder="Why was this project lost?"
            />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
          <ActionButton variant="ghost" size="md" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            size="md"
            onClick={submit}
            disabled={submitting || (next === 'LOST' && !reason)}
          >
            Confirm
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
}
