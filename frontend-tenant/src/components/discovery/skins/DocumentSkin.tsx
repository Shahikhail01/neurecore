/**
 * DocumentSkin — file upload + accept-candidate review.
 *
 * Phase 2D: visual surface only. The upload→candidates flow wires up in
 * Phase 2E when the DocumentExtractionService backend lands. For now the
 * skin renders the question + a file picker that, when present, shows
 * "candidates will appear here after extraction (Phase 2E)".
 */

'use client';

import { useEffect, useState } from 'react';
import type { ResolvedQuestion } from '../types';

export interface DocumentSkinProps {
  question: ResolvedQuestion;
  onSubmit: (value: unknown) => Promise<void>;
  submitting?: boolean;
  disabled?: boolean;
}

export function DocumentSkin({
  question,
  onSubmit,
  submitting,
  disabled,
}: DocumentSkinProps) {
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    setFile(null);
  }, [question.id]);

  return (
    <div className="space-y-3" data-testid="document-skin">
      <div>
        <label className="block text-sm text-zinc-200 font-medium">
          {question.label}
          {question.required ? <span className="text-[color:var(--visual-accent-rose-400)] ml-0.5">*</span> : null}
        </label>
        {question.helpText ? (
          <p className="mt-0.5 text-xs text-zinc-500">{question.helpText}</p>
        ) : null}
      </div>
      <label className="block text-xs text-zinc-400">
        Upload a source document
        <input
          type="file"
          className="mt-1 block w-full text-xs text-zinc-300 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[color:var(--accent-500)] file:text-white file:cursor-pointer"
          disabled={disabled}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          data-testid="document-skin-input"
        />
      </label>
      <p className="text-[11px] text-zinc-500">
        File: {file ? file.name : 'none selected'}.
        Candidate extraction is delivered in Phase 2E.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={submitting || disabled || !file}
          onClick={() => onSubmit(file?.name ?? null)}
          data-testid="document-skin-submit"
          className="text-sm px-3 py-1.5 rounded bg-[color:var(--accent-500)] text-white hover:bg-[color:var(--accent-500)] disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Use document as source'}
        </button>
      </div>
    </div>
  );
}