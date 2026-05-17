'use client';

import type { AuthorityLevel, DelegationFormData } from '@/types/delegation.types';

interface AuthorityOption {
  value: AuthorityLevel;
  label: string;
  description: string;
  icon: string;
}

const OPTIONS: AuthorityOption[] = [
  {
    value: 'EXECUTE',
    label: 'Execute Autonomously',
    description: 'Agent runs the task without requiring any approval.',
    icon: '⚡',
  },
  {
    value: 'APPROVE_THRESHOLD',
    label: 'Approve Above Threshold',
    description: 'Auto-execute unless estimated cost exceeds the set threshold.',
    icon: '⚖',
  },
  {
    value: 'APPROVE_ME',
    label: 'Always Approve',
    description: 'Every action the agent proposes needs your explicit sign-off.',
    icon: '🔒',
  },
];

interface Props {
  form: DelegationFormData;
  patch: (u: Partial<DelegationFormData>) => void;
}

export function StepAuthority({ form, patch }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((opt) => {
        const selected = form.authority === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => patch({ authority: opt.value })}
            className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition ${
              selected
                ? 'border-violet-500 bg-violet-500/10'
                : 'border-surface-border hover:border-zinc-600 hover:bg-surface-overlay'
            }`}
          >
            <span className="text-xl mt-0.5 shrink-0">{opt.icon}</span>
            <div>
              <div className={`text-sm font-semibold ${selected ? 'text-violet-200' : 'text-zinc-200'}`}>
                {opt.label}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">{opt.description}</div>
            </div>
            <span
              className={`ml-auto mt-1 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                selected ? 'border-violet-500 bg-violet-500' : 'border-zinc-600'
              }`}
            >
              {selected && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
          </button>
        );
      })}

      {/* Threshold input (conditionally shown) */}
      {form.authority === 'APPROVE_THRESHOLD' && (
        <div className="mt-2 pl-2">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
            Approval Threshold (USD)
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.approvalThreshold ?? ''}
            onChange={(e) =>
              patch({ approvalThreshold: e.target.value ? parseFloat(e.target.value) : null })
            }
            placeholder="0.50"
            className="w-36 bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500 transition"
          />
        </div>
      )}
    </div>
  );
}
