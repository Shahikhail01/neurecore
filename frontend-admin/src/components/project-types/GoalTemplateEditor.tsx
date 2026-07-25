'use client';

/**
 * GoalTemplateEditor — per-plan §5.2 — pre-populated goal list.
 * Each goal has a title and optional measurable criteria.
 */

// Inline unicode glyphs (× for delete, + for add) — no external icon lib.

import type { GoalTemplate } from '@/services/projectTypes.service';

export type { GoalTemplate };

interface GoalTemplateEditorProps {
  goals: GoalTemplate[];
  onChange: (next: GoalTemplate[]) => void;
  readOnly?: boolean;
}

const EMPTY: GoalTemplate = { title: '', measurableCriteria: '' };

export function GoalTemplateEditor({
  goals,
  onChange,
  readOnly = false,
}: GoalTemplateEditorProps) {
  function add() {
    onChange([...goals, { ...EMPTY }]);
  }
  function remove(idx: number) {
    onChange(goals.filter((_, i) => i !== idx));
  }
  function update(idx: number, patch: Partial<GoalTemplate>) {
    onChange(goals.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">
        Default goals pre-populated when a project of this type is created.
      </p>
      {goals.map((g, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-surface-border bg-surface-overlay p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <input
              value={g.title}
              onChange={(e) => update(idx, { title: e.target.value })}
              placeholder="Goal title"
              disabled={readOnly}
              className="flex-1 px-2 py-1 bg-surface text-xs text-zinc-200 rounded border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)] disabled:opacity-50"
            />
            {!readOnly && (
              <button
                type="button"
                onClick={() => remove(idx)}
                className="text-zinc-600 hover:text-[color:var(--state-danger)] transition"
                aria-label="Remove goal"
              >
                <span aria-hidden className="text-sm">×</span>
              </button>
            )}
          </div>
          <input
            value={g.measurableCriteria ?? ''}
            onChange={(e) =>
              update(idx, { measurableCriteria: e.target.value })
            }
            placeholder="Measurable criteria (optional)"
            disabled={readOnly}
            className="w-full px-2 py-1 bg-surface text-xs text-zinc-400 rounded border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)] disabled:opacity-50"
          />
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={add}
          className="w-full py-2 rounded-lg border border-dashed border-surface-border text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition flex items-center justify-center gap-2"
        >
          <span aria-hidden>+</span>
          Add Goal
        </button>
      )}
    </div>
  );
}
