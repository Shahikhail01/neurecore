'use client';

import { useState } from 'react';
import { Modal } from '@/components/creatio/Modal';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import type { ProjectMember, ProjectRole } from '@/services/projects.service';
import { projectsService } from '@/services/projects.service';
import { PROJECT_ROLES } from '@/components/projects/constants';

interface TeamModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  members: ProjectMember[];
  onChanged: () => Promise<void>;
}

export function TeamModal({
  open,
  onClose,
  projectId,
  members,
  onChanged,
}: TeamModalProps) {
  const [actorId, setActorId] = useState('');
  const [actorType, setActorType] = useState<'HUMAN' | 'AI' | 'SYSTEM'>('AI');
  const [role, setRole] = useState<ProjectRole>('REVIEWER');
  const [adding, setAdding] = useState(false);

  if (!open) return null;

  const add = async () => {
    if (!actorId.trim()) return;
    setAdding(true);
    try {
      await projectsService.assignMember(projectId, {
        actorId: actorId.trim(),
        actorType,
        role,
      });
      setActorId('');
      await onChanged();
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this team member?')) return;
    await projectsService.removeMember(projectId, id);
    await onChanged();
  };

  return (
    <Modal open onClose={onClose} title="Project Team">
      <div className="space-y-3">
        {members.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">
            No team assigned yet.
          </p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 p-2 border border-surface-border rounded-lg"
              >
                <div className="flex-1">
                  <div className="text-sm text-zinc-100">
                    {m.role.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {m.actorType} · {m.actorId}
                  </div>
                </div>
                <ActionButton variant="ghost" size="sm" onClick={() => remove(m.id)}>
                  Remove
                </ActionButton>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-surface-border">
          <input
            aria-label="Actor ID"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            placeholder="actor id"
            className="col-span-3 px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
          />
          <select
            aria-label="Actor type"
            value={actorType}
            onChange={(e) =>
              setActorType(e.target.value as 'HUMAN' | 'AI' | 'SYSTEM')
            }
            className="px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
          >
            <option value="HUMAN">Human</option>
            <option value="AI">AI</option>
            <option value="SYSTEM">System</option>
          </select>
          <select
            aria-label="Project role"
            value={role}
            onChange={(e) => setRole(e.target.value as ProjectRole)}
            className="col-span-2 px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
          >
            {PROJECT_ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <ActionButton
            variant="primary"
            size="md"
            onClick={add}
            disabled={adding || !actorId.trim()}
          >
            Assign Member
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
}
