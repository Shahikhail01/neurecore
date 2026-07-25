'use client';

/**
 * FieldEditor — single row of a field schema (per plan §5.2).
 * One field = one row in the JSONB builder.
 */

import { useState } from 'react';

export type FieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT';

export interface EditingField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
}

export const EMPTY_FIELD: EditingField = {
  key: '',
  label: '',
  type: 'TEXT',
  required: false,
  options: [],
};

const FIELD_TYPES: readonly FieldType[] = [
  'TEXT',
  'NUMBER',
  'DATE',
  'SELECT',
  'MULTI_SELECT',
];

interface FieldEditorProps {
  field: EditingField;
  onChange: (patch: Partial<EditingField>) => void;
  onRemove: () => void;
  readOnly?: boolean;
}

export function FieldEditor({
  field,
  onChange,
  onRemove,
  readOnly = false,
}: FieldEditorProps) {
  const [optionsText, setOptionsText] = useState(field.options.join(', '));

  function handleOptionsChange(text: string) {
    setOptionsText(text);
    onChange({ options: text.split(',').map((o) => o.trim()).filter(Boolean) });
  }

  return (
    <div className="rounded-lg border border-surface-border bg-surface-overlay p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Field label"
          disabled={readOnly}
          className="flex-1 px-2 py-1 bg-surface text-xs text-zinc-200 rounded border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)] disabled:opacity-50"
        />
        <select
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value as FieldType })}
          disabled={readOnly}
          className="px-2 py-1 bg-surface text-xs text-zinc-200 rounded border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)] disabled:opacity-50"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[10px] text-zinc-400">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            disabled={readOnly}
            className="rounded border-zinc-600 disabled:opacity-50"
          />
          Required
        </label>
        {!readOnly && (
          <button
            type="button"
            onClick={onRemove}
            className="text-zinc-600 hover:text-[color:var(--state-danger)] transition"
            aria-label="Remove field"
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={field.key}
          onChange={(e) =>
            onChange({ key: e.target.value.toLowerCase().replace(/\s+/g, '_') })
          }
          placeholder="field_key"
          disabled={readOnly}
          className="flex-1 px-2 py-1 bg-surface text-xs text-zinc-400 rounded border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)] font-mono disabled:opacity-50"
        />
        {(field.type === 'SELECT' || field.type === 'MULTI_SELECT') && (
          <input
            value={optionsText}
            onChange={(e) => handleOptionsChange(e.target.value)}
            placeholder="option1, option2, option3"
            disabled={readOnly}
            className="flex-1 px-2 py-1 bg-surface text-xs text-zinc-400 rounded border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)] disabled:opacity-50"
          />
        )}
      </div>
    </div>
  );
}
