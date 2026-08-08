'use client';

import { useState } from 'react';
import { Modal } from '@/components/creatio/Modal';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import type { ProjectStage } from '@/services/projects.service';
import { projectsService } from '@/services/projects.service';

interface StagesModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  stages: ProjectStage[];
  onChanged: () => Promise<void>;
}

export function StagesModal({
  open,
  onClose,
  projectId,
  stages,
  onChanged,
}: StagesModalProps) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  if (!open) return null;

  const add = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await projectsService.createStage(projectId, {
        name: newName.trim(),
        order: stages.length,
      });
      setNewName('');
      await onChanged();
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this stage?')) return;
    await projectsService.deleteStage(projectId, id);
    await onChanged();
  };

  return (
    <Modal open onClose={onClose} title="Stages">
      <div className="space-y-3">
        {stages.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">No stages yet.</p>
        ) : (
          <div className="space-y-2">
            {stages.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 p-2 border border-surface-border rounded-lg"
              >
                <div className="flex-1">
                  <div className="text-sm text-zinc-100">{s.name}</div>
                  <div className="text-xs text-zinc-500">
                    Order {s.order} · {s.status}
                  </div>
                </div>
                <ActionButton
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(s.id)}
                >
                  Remove
                </ActionButton>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-3 border-t border-surface-border">
          <input
            aria-label="New stage name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New stage name"
            className="flex-1 px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
          />
          <ActionButton variant="primary" size="md" onClick={add} disabled={adding || !newName.trim()}>
            Add
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
}
