'use client';

import { useState } from 'react';
import type { DelegationFormData } from '@/types/delegation.types';

interface Props {
  form: DelegationFormData;
  patch: (u: Partial<DelegationFormData>) => void;
}

export function StepParameters({ form, patch }: Props) {
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) patch({ tags: [...form.tags, t] });
    setTagInput('');
  };

  const removeTag = (tag: string) =>
    patch({ tags: form.tags.filter((t) => t !== tag) });

  return (
    <div className="flex flex-col gap-5">
      {/* Deadline */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
          Deadline (optional)
        </label>
        <input
          type="datetime-local"
          value={form.deadline}
          onChange={(e) => patch({ deadline: e.target.value })}
          className="w-full bg-surface-overlay border border-surface-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-500 transition"
        />
      </div>

      {/* Max retries */}
      <div>
        <div className="flex justify-between mb-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Max Retries
          </label>
          <span className="text-xs font-mono text-violet-300">{form.maxRetries}</span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={form.maxRetries}
          onChange={(e) => patch({ maxRetries: parseInt(e.target.value) })}
          className="w-full h-1.5 rounded-full appearance-none bg-surface-border accent-violet-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
          <span>0</span>
          <span>10</span>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
          Tags
        </label>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            placeholder="Add tag and press Enter"
            className="flex-1 bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500 transition"
          />
          <button
            onClick={addTag}
            className="px-3 py-2 rounded-lg bg-surface-overlay border border-surface-border text-xs text-zinc-400 hover:text-zinc-100 transition"
          >
            Add
          </button>
        </div>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {form.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-[11px] text-violet-300"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="text-violet-400 hover:text-status-risk transition"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
