/**
 * FormSkin — traditional field rendering per question.
 *
 * Single Responsibility: render ONE question as an editable form control.
 * No fetches. The engine decides which question is "next"; this skin
 * only paints it.
 */

'use client';

import { useEffect, useState } from 'react';
import type { ResolvedQuestion } from '../types';

export interface FormSkinProps {
  question: ResolvedQuestion;
  /** Pre-existing response value from the database (if any). */
  existingValue?: unknown;
  onSubmit: (value: unknown) => Promise<void>;
  submitting?: boolean;
  disabled?: boolean;
}

export function FormSkin({ question, existingValue, onSubmit, submitting, disabled }: FormSkinProps) {
  const [value, setValue] = useState<unknown>('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Reset state when the question changes, using existing value if available.
  useEffect(() => {
    setValue(existingValue !== undefined ? existingValue : '');
    setLocalError(null);
  }, [question.id, existingValue]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (question.required && (value === '' || value === null || value === undefined)) {
      setLocalError('This question is required.');
      return;
    }
    await onSubmit(value);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" data-testid="form-skin">
      <div>
        <label className="block text-sm text-zinc-200 font-medium">
          {question.label}
          {question.required ? <span className="text-[color:var(--visual-accent-rose-400)] ml-0.5">*</span> : null}
        </label>
        {question.helpText ? (
          <p className="mt-0.5 text-xs text-zinc-500">{question.helpText}</p>
        ) : null}
      </div>
      <FieldControl question={question} value={value} onChange={setValue} disabled={disabled} />
      {localError ? <p className="text-xs text-[color:var(--visual-accent-rose-400)]">{localError}</p> : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || disabled}
          data-testid="form-skin-submit"
          className="text-sm px-3 py-1.5 rounded bg-[color:var(--accent-500)] text-white hover:bg-[color:var(--accent-500)] disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save answer'}
        </button>
      </div>
    </form>
  );
}

function FieldControl({
  question,
  value,
  onChange,
  disabled,
}: {
  question: ResolvedQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const baseInput =
    'w-full text-sm rounded border border-surface-border bg-surface-base px-2 py-1.5 text-zinc-100 focus:outline-none focus:border-[color:var(--accent-500)] disabled:opacity-50';
  switch (question.type) {
    case 'TEXT':
      return (
        <input
          type="text"
          className={baseInput}
          aria-label={question.label}
          value={(value as string) ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'NUMBER':
    case 'CURRENCY':
      return (
        <input
          type="number"
          step="any"
          className={baseInput}
          aria-label={question.label}
          value={value === '' || value === null || value === undefined ? '' : (value as number)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    case 'DATE':
      return (
        <input
          type="date"
          className={baseInput}
          aria-label={question.label}
          value={
            typeof value === 'string'
              ? value.slice(0, 10)
              : ''
          }
          disabled={disabled}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      );
    case 'BOOLEAN':
      return (
        <select
          className={baseInput}
          aria-label={question.label}
          value={value === true || value === 'true' ? 'true' : value === false || value === 'false' ? 'false' : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')}
        >
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    case 'SELECT':
      return (
        <select
          className={baseInput}
          aria-label={question.label}
          value={(value as string) ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">— Select —</option>
          {(question.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case 'MULTI_SELECT': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {(question.options ?? []).map((opt) => {
            const selected = arr.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(
                    selected ? arr.filter((v) => v !== opt) : [...arr, opt],
                  );
                }}
                className={`text-xs px-2 py-0.5 rounded-full border transition disabled:opacity-50 ${
                  selected
                    ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/20 text-indigo-200'
                    : 'border-surface-border text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    }
    default:
      return null;
  }
}