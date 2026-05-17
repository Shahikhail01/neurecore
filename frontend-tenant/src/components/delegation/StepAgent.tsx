'use client';

import { useEffect, useState } from 'react';
import { delegationService, type Agent } from '@/services/delegation.service';
import type { DelegationFormData } from '@/types/delegation.types';

const STATUS_COLOR: Record<string, string> = {
  IDLE:    'bg-zinc-600',
  RUNNING: 'bg-status-profit',
  PAUSED:  'bg-amber-400',
  ERROR:   'bg-status-risk',
};

interface Props {
  form: DelegationFormData;
  patch: (u: Partial<DelegationFormData>) => void;
}

export function StepAgent({ form, patch }: Props) {
  const [agents, setAgents]   = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!form.departmentId) return;
    setLoading(true);
    delegationService.listAgentsByDepartment(form.departmentId).then((a) => {
      setAgents(a);
      setLoading(false);
    });
  }, [form.departmentId]);

  const select = (agent: Agent | null) =>
    patch({ agentId: agent?.id ?? null, agentName: agent?.name ?? null });

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-surface-overlay animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Auto-assign option */}
      <button
        onClick={() => select(null)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition ${
          form.agentId === null
            ? 'border-violet-500 bg-violet-500/10 text-violet-200'
            : 'border-surface-border text-zinc-400 hover:border-zinc-600 hover:bg-surface-overlay'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-indigo-400" />
        <span className="font-medium">Auto-assign best available agent</span>
      </button>

      {agents.map((agent) => {
        const selected = form.agentId === agent.id;
        const dotColor = STATUS_COLOR[agent.status] ?? 'bg-zinc-600';
        return (
          <button
            key={agent.id}
            onClick={() => select(agent)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition ${
              selected
                ? 'border-violet-500 bg-violet-500/10 text-violet-200'
                : 'border-surface-border text-zinc-300 hover:border-zinc-600 hover:bg-surface-overlay'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full ${dotColor}`} />
              <span className="font-medium">{agent.name}</span>
            </div>
            <span className="text-[10px] text-zinc-500 uppercase">{agent.status}</span>
          </button>
        );
      })}

      {!agents.length && (
        <p className="text-sm text-zinc-500 text-center py-4">
          No agents in this department yet.
        </p>
      )}
    </div>
  );
}
