'use client';

/**
 * StageEditor — single stage row in the stage template (per plan §5.2).
 */

export interface EditingStage {
  name: string;
  order: number;
  defaultDurationDays: number;
}

export const EMPTY_STAGE: EditingStage = {
  name: '',
  order: 0,
  defaultDurationDays: 0,
};

interface StageEditorProps {
  stage: EditingStage;
  index: number;
  onChange: (patch: Partial<EditingStage>) => void;
  onRemove: () => void;
  readOnly?: boolean;
}

export function StageEditor({
  stage,
  index,
  onChange,
  onRemove,
  readOnly = false,
}: StageEditorProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-overlay p-2">
      <span className="text-[10px] text-zinc-600 w-4">{index + 1}.</span>
      <input
        aria-label="Stage name"
        value={stage.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Stage name"
        disabled={readOnly}
        className="flex-1 px-2 py-1 bg-surface text-xs text-zinc-200 rounded border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)] disabled:opacity-50"
      />
      <input
        aria-label="Default duration days"
        type="number"
        value={stage.defaultDurationDays || ''}
        onChange={(e) =>
          onChange({ defaultDurationDays: parseInt(e.target.value) || 0 })
        }
        placeholder="Days"
        disabled={readOnly}
        className="w-16 px-2 py-1 bg-surface text-xs text-zinc-200 rounded border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)] text-center disabled:opacity-50"
      />
      <span className="text-[10px] text-zinc-600">days</span>
      {!readOnly && (
        <button
          type="button"
          onClick={onRemove}
          className="text-zinc-600 hover:text-[color:var(--state-danger)] transition"
          aria-label="Remove stage"
        >
          ✕
        </button>
      )}
    </div>
  );
}
