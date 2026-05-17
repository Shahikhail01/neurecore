'use client';

import type { DelegationFormData } from '@/types/delegation.types';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const PRIORITY_STYLE: Record<string, string> = {
  LOW:      'border-zinc-600 text-zinc-400',
  MEDIUM:   'border-indigo-500/60 text-indigo-300',
  HIGH:     'border-amber-500/60 text-amber-300',
  CRITICAL: 'border-red-500/60 text-red-300',
};

interface Props {
  form: DelegationFormData;
  patch: (u: Partial<DelegationFormData>) => void;
}

export function StepDescription({ form, patch }: Props) {
  return (
    <div className="flex flex-col gap-5">
      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
          Task Title
        </label>
        <input
          value={form.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="e.g. Generate monthly cost report"
          className="w-full bg-surface-overlay border border-surface-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-500 transition"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          rows={4}
          placeholder="Describe in detail what the agent should accomplish…"
          className="w-full bg-surface-overlay border border-surface-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-500 resize-none transition"
        />
        <div className="text-right text-[10px] text-zinc-600 mt-0.5">
          {form.description.length} chars
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
          Priority
        </label>
        <div className="grid grid-cols-4 gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => patch({ priority: p })}
              className={`py-2 rounded-lg border text-xs font-semibold transition ${
                form.priority === p
                  ? (PRIORITY_STYLE[p] ?? '') + ' bg-surface-overlay'
                  : 'border-surface-border text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
