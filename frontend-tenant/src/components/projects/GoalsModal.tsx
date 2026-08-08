'use client';

import { useState } from 'react';
import { Modal } from '@/components/creatio/Modal';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { goalsService, type Goal } from '@/services/goals.service';

interface GoalsModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  goals: Goal[];
  onChanged: () => Promise<void>;
}

export function GoalsModal({
  open,
  onClose,
  projectId,
  goals,
  onChanged,
}: GoalsModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);

  if (!open) return null;

  const add = async () => {
    if (!title.trim()) return;
    setAdding(true);
    try {
      await goalsService.create({
        title: title.trim(),
        description: description.trim() || undefined,
        projectId,
      });
      setTitle('');
      setDescription('');
      await onChanged();
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this goal?')) return;
    await goalsService.delete(id);
    await onChanged();
  };

  const recalc = async (id: string) => {
    await goalsService.recalculateProgress(id);
    await onChanged();
  };

  return (
    <Modal open onClose={onClose} title="Project Goals">
      <div className="space-y-3">
        {goals.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">
            No goals linked to this project.
          </p>
        ) : (
          <div className="space-y-2">
            {goals.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between gap-2 p-2 border border-surface-border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-100 truncate">{g.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                      <div
                        className="h-full bg-accent-500 transition-all"
                        style={{ width: `${g.progress ?? 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-zinc-400 w-10 text-right">
                      {g.progress ?? 0}%
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <ActionButton variant="ghost" size="sm" onClick={() => recalc(g.id)}>
                    Recalc
                  </ActionButton>
                  <ActionButton variant="ghost" size="sm" onClick={() => remove(g.id)}>
                    Remove
                  </ActionButton>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 pt-3 border-t border-surface-border">
          <input
            aria-label="Goal title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Goal title"
            className="w-full px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
          />
          <input
            aria-label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
          />
          <div className="flex justify-end">
            <ActionButton
              variant="primary"
              size="md"
              onClick={add}
              disabled={adding || !title.trim()}
            >
              Add Goal
            </ActionButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
