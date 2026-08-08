'use client';

import { useState } from 'react';
import { BookOpen, Gavel } from 'lucide-react';
import { Modal } from '@/components/creatio/Modal';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import type { ProjectMemory } from '@/services/project-memory.service';
import { projectMemoryService } from '@/services/project-memory.service';
import type { ProjectDecision } from '@/services/project-decisions.service';
import { projectDecisionsService } from '@/services/project-decisions.service';
import { MEMORY_CATEGORIES, CATEGORY_COLORS } from '@/components/projects/constants';

interface KnowledgeModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  memories: ProjectMemory[];
  decisions: ProjectDecision[];
  onMemoriesChanged: () => Promise<void>;
  onDecisionsChanged: () => Promise<void>;
}

function MemoryEntry({
  memory,
  onPin,
}: {
  memory: ProjectMemory;
  onPin: (id: string, current: boolean) => Promise<void>;
}) {
  return (
    <div className="flex items-start gap-2 p-2 border border-surface-border rounded-lg hover:border-surface-overlay transition-colors">
      <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 mt-0.5 ${CATEGORY_COLORS[memory.category]}`}>
        {memory.category}
      </span>
      <p className="text-xs text-zinc-300 flex-1 line-clamp-3">{memory.content}</p>
      <button
        className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
          memory.isPinned
            ? 'border-yellow-500/40 text-yellow-400'
            : 'border-surface-border text-zinc-500 hover:text-zinc-300'
        }`}
        onClick={() => void onPin(memory.id, memory.isPinned)}
        title={memory.isPinned ? 'Unpin' : 'Pin'}
      >
        {memory.isPinned ? '★ Pinned' : 'Pin'}
      </button>
    </div>
  );
}

export function KnowledgeModal({
  open,
  onClose,
  projectId,
  memories,
  decisions,
  onMemoriesChanged,
  onDecisionsChanged,
}: KnowledgeModalProps) {
  const [tab, setTab] = useState<'memory' | 'decisions'>('memory');
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryCategory, setMemoryCategory] = useState<(typeof MEMORY_CATEGORIES)[number]>('NOTE');
  const [memorySearch, setMemorySearch] = useState('');
  const [submittingMemory, setSubmittingMemory] = useState(false);

  const [decisionTitle, setDecisionTitle] = useState('');
  const [decisionDesc, setDecisionDesc] = useState('');
  const [decisionRationale, setDecisionRationale] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const filteredMemories = memories.filter((m) => {
    if (!memorySearch) return true;
    const q = memorySearch.toLowerCase();
    return m.content.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
  });

  const handleAddMemory = async () => {
    if (!memoryContent.trim()) return;
    setSubmittingMemory(true);
    try {
      await projectMemoryService.create({
        projectId,
        content: memoryContent.trim(),
        category: memoryCategory,
        authorType: 'HUMAN',
      });
      setMemoryContent('');
      await onMemoriesChanged();
    } finally {
      setSubmittingMemory(false);
    }
  };

  const handlePinMemory = async (id: string, current: boolean) => {
    await projectMemoryService.update(id, { isPinned: !current });
    await onMemoriesChanged();
  };

  const handleAddDecision = async () => {
    if (!decisionTitle.trim()) return;
    setSubmittingDecision(true);
    try {
      await projectDecisionsService.create({
        projectId,
        title: decisionTitle.trim(),
        description: decisionDesc.trim() || undefined,
        rationale: decisionRationale.trim() || undefined,
      });
      setDecisionTitle('');
      setDecisionDesc('');
      setDecisionRationale('');
      await onDecisionsChanged();
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleVote = async (id: string, vote: 'FOR' | 'AGAINST' | 'ABSTAIN') => {
    await projectDecisionsService.castVote(id, vote);
    await onDecisionsChanged();
  };

  const handleApproveDecision = async (id: string) => {
    await projectDecisionsService.approve(id, 'current-user', 'HUMAN');
    await onDecisionsChanged();
  };

  if (!open) return null;

  const pinnedMemories = filteredMemories.filter((m) => m.isPinned);
  const unpinnedMemories = filteredMemories.filter((m) => !m.isPinned);

  return (
    <Modal open onClose={onClose} title="Knowledge Base" size="lg">
      <div className="flex gap-1 mb-4 border-b border-surface-border pb-3">
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
            tab === 'memory'
              ? 'bg-surface-overlay text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          onClick={() => setTab('memory')}
        >
          <BookOpen className="w-4 h-4" />
          Memory ({memories.length})
        </button>
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
            tab === 'decisions'
              ? 'bg-surface-overlay text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          onClick={() => setTab('decisions')}
        >
          <Gavel className="w-4 h-4" />
          Decisions ({decisions.length})
        </button>
      </div>

      {tab === 'memory' && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search memories…"
            aria-label="Search memories"
            value={memorySearch}
            onChange={(e) => setMemorySearch(e.target.value)}
            className="w-full px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
          />

          <div className="space-y-2 p-3 border border-surface-border rounded-lg bg-surface-muted/30">
            <p className="text-xs text-zinc-500 font-medium">Add Memory Entry</p>
            <div className="flex gap-2">
              <select
                value={memoryCategory}
                onChange={(e) => setMemoryCategory(e.target.value as (typeof MEMORY_CATEGORIES)[number])}
                aria-label="Memory category"
                className="px-2 py-1.5 bg-surface text-xs text-zinc-300 rounded border border-surface-border focus:outline-none focus:border-primary"
              >
                {MEMORY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="What should the project remember?"
                aria-label="Memory content"
                value={memoryContent}
                onChange={(e) => setMemoryContent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleAddMemory()}
                className="flex-1 px-3 py-1.5 bg-surface text-sm text-zinc-200 rounded border border-surface-border focus:outline-none focus:border-primary"
              />
              <ActionButton
                variant="primary"
                size="sm"
                onClick={() => void handleAddMemory()}
                disabled={submittingMemory || !memoryContent.trim()}
              >
                Add
              </ActionButton>
            </div>
          </div>

          {pinnedMemories.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">
                Pinned ({pinnedMemories.length})
              </p>
              <div className="space-y-2">
                {pinnedMemories.map((m) => (
                  <MemoryEntry
                    key={m.id}
                    memory={m}
                    onPin={handlePinMemory}
                  />
                ))}
              </div>
            </div>
          )}

          {unpinnedMemories.length > 0 ? (
            <div className="space-y-2">
              {unpinnedMemories.map((m) => (
                <MemoryEntry
                  key={m.id}
                  memory={m}
                  onPin={handlePinMemory}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-4">
              {memorySearch ? 'No matching memories.' : 'No memories yet. Add one above.'}
            </p>
          )}
        </div>
      )}

      {tab === 'decisions' && (
        <div className="space-y-4">
          <div className="space-y-2 p-3 border border-surface-border rounded-lg bg-surface-muted/30">
            <p className="text-xs text-zinc-500 font-medium">Record a Decision</p>
            <input
              id="decision-title"
              type="text"
              placeholder="Decision title"
              aria-label="Decision title"
              value={decisionTitle}
              onChange={(e) => setDecisionTitle(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface text-sm text-zinc-200 rounded border border-surface-border focus:outline-none focus:border-primary"
            />
            <textarea
              id="decision-description"
              placeholder="Description (optional)"
              aria-label="Decision description"
              value={decisionDesc}
              onChange={(e) => setDecisionDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 bg-surface text-sm text-zinc-200 rounded border border-surface-border focus:outline-none focus:border-primary resize-none"
            />
            <textarea
              id="decision-rationale"
              placeholder="Rationale (optional)"
              aria-label="Decision rationale"
              value={decisionRationale}
              onChange={(e) => setDecisionRationale(e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 bg-surface text-sm text-zinc-200 rounded border border-surface-border focus:outline-none focus:border-primary resize-none"
            />
            <ActionButton
              variant="primary"
              size="sm"
              onClick={() => void handleAddDecision()}
              disabled={submittingDecision || !decisionTitle.trim()}
            >
              Record Decision
            </ActionButton>
          </div>

          {decisions.length > 0 ? (
            <div className="space-y-3">
              {decisions.map((d) => (
                <div
                  key={d.id}
                  className="p-3 border border-surface-border rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-100 font-medium">{d.title}</p>
                      {d.description && (
                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{d.description}</p>
                      )}
                    </div>
                    <StatusBadge status={d.status} />
                  </div>

                  {d.rationale && (
                    <p className="text-xs text-zinc-500 italic">Rationale: {d.rationale}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <span className="text-[color:var(--state-success)]">▲ {d.votesFor}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-[color:var(--state-danger)]">▼ {d.votesAgainst}</span>
                    </span>
                    <span>— {d.abstentions} abstentions</span>
                    {d.decidedAt && (
                      <span className="ml-auto">
                        {new Date(d.decidedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {d.status === 'PROPOSED' && (
                    <div className="flex gap-2 pt-1">
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleVote(d.id, 'FOR')}
                      >
                        Vote For
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleVote(d.id, 'AGAINST')}
                      >
                        Vote Against
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleVote(d.id, 'ABSTAIN')}
                      >
                        Abstain
                      </ActionButton>
                      <ActionButton
                        variant="primary"
                        size="sm"
                        onClick={() => void handleApproveDecision(d.id)}
                      >
                        Approve
                      </ActionButton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-4">
              No decisions recorded yet. Record one above.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
