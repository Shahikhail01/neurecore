'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/creatio/Modal';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { deliverablesService, type Deliverable, type DeliverableVersion } from '@/services/deliverables.service';

interface DeliverablesModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  deliverables: Deliverable[];
  onChanged: () => Promise<void>;
}

export function DeliverablesModal({
  open,
  onClose,
  projectId,
  deliverables: initialDeliverables,
  onChanged,
}: DeliverablesModalProps) {
  const [deliverables, setDeliverables] = useState<Deliverable[]>(initialDeliverables);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<Record<string, DeliverableVersion[]>>({});

  useEffect(() => {
    setDeliverables(initialDeliverables);
  }, [initialDeliverables]);

  if (!open) return null;

  const add = async () => {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await deliverablesService.create({
        projectId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName('');
      setDescription('');
      await onChanged();
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this deliverable?')) return;
    await deliverablesService.delete(id);
    await onChanged();
  };

  const loadVersions = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!versions[id]) {
      const v = await deliverablesService.listVersions(id);
      setVersions((prev) => ({ ...prev, [id]: v }));
    }
  };

  return (
    <Modal open onClose={onClose} title="Project Deliverables">
      <div className="space-y-3">
        {deliverables.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">
            No deliverables yet.
          </p>
        ) : (
          <div className="space-y-2">
            {deliverables.map((d) => (
              <div
                key={d.id}
                className="border border-surface-border rounded-lg overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-100 truncate">{d.name}</div>
                    {d.description && (
                      <div className="text-xs text-zinc-500 truncate">
                        {d.description}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={d.status} />
                  <ActionButton variant="ghost" size="sm" onClick={() => loadVersions(d.id)}>
                    {expandedId === d.id ? 'Hide' : 'Versions'}
                  </ActionButton>
                  <ActionButton variant="ghost" size="sm" onClick={() => remove(d.id)}>
                    Remove
                  </ActionButton>
                </div>
                {expandedId === d.id && (
                  <div className="border-t border-surface-border p-2 bg-surface-muted">
                    <p className="text-xs text-zinc-500 mb-2">Version History</p>
                    {(versions[d.id] ?? []).length === 0 ? (
                      <p className="text-xs text-zinc-600">No versions yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {(versions[d.id] ?? []).map((v) => (
                          <div key={v.id} className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400">
                              v{v.version} · {new Date(v.createdAt).toLocaleDateString()}
                            </span>
                            {v.summary && (
                              <span className="text-zinc-500 truncate max-w-32">{v.summary}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 pt-3 border-t border-surface-border">
          <input
            aria-label="Deliverable name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Deliverable name"
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
              disabled={adding || !name.trim()}
            >
              Add Deliverable
            </ActionButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
