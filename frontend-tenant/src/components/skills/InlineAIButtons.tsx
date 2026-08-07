'use client';

/**
 * Phase 11 — Inline AI buttons.
 *
 * Each button is a one-click action that runs the corresponding
 * skill through the chat dispatcher. They expose themselves on
 * records (Customer / Project / Lead / Deal / Case / Quote /
 * Campaign / Thread) where the skill output (summary, rewrite,
 * translation, etc.) is the user-facing artifact.
 *
 * SRP: each component is a single button that hooks into one
 * skill invocation. No state caching, no sharing — the chat
 * dispatcher is the source of truth.
 */

import { useState } from 'react';
import { Sparkles, Languages, Pencil, FileText, Mail, FilePlus, GitCompare } from 'lucide-react';
import { skillsService } from '@/services/skills.service';

interface InlineAIButtonProps {
  /** Free-form text input to feed the skill. */
  text: string;
  /** Optional override for the recipient (only used by draft-email). */
  recipientEmail?: string;
  /** Optional callback when the skill result is ready. */
  onResult?: (content: string) => void;
  /** Visual size — defaults to `sm`. */
  size?: 'sm' | 'md';
  /** Whether the button is rendered as a `disabled` placeholder. */
  disabled?: boolean;
}

function baseClass(size: 'sm' | 'md'): string {
  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5 text-sm';
  return `inline-flex items-center gap-1 rounded border border-border bg-background hover:bg-surface-muted transition-colors ${px}`;
}

async function invoke(
  id: 'summarize' | 'rewrite' | 'translate' | 'extract' | 'compare' | 'draft-report' | 'draft-email',
  payload: unknown,
  onResult: ((content: string) => void) | undefined,
  setLoading: (loading: boolean) => void,
  setError: (err: string | null) => void,
) {
  setLoading(true);
  setError(null);
  try {
    const out = await (skillsService.invokeViaChat as (
      i: typeof id,
      p: unknown,
    ) => Promise<{ content: string }>)(id, payload);
    onResult?.(out.content);
  } catch (err) {
    setError((err as Error).message);
  } finally {
    setLoading(false);
  }
}

export function SummarizeButton({ text, onResult, size = 'sm', disabled }: InlineAIButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={loading || disabled || text.trim().length === 0}
        onClick={() =>
          invoke(
            'summarize',
            { source: { kind: 'text', text } },
            onResult,
            setLoading,
            setError,
          )
        }
        className={baseClass(size)}
        title="Summarize record/thread with citations"
      >
        <Sparkles className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        {loading ? 'Summarizing…' : 'Summarize'}
      </button>
      {error ? <span className="ml-2 text-xs text-red-600">{error}</span> : null}
    </>
  );
}

export function RewriteButton({ text, onResult, size = 'sm', disabled }: InlineAIButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={loading || disabled || text.trim().length === 0}
        onClick={() =>
          invoke(
            'rewrite',
            { text, mode: 'shorten' },
            onResult,
            setLoading,
            setError,
          )
        }
        className={baseClass(size)}
        title="Shorten this text without changing meaning"
      >
        <Pencil className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        {loading ? 'Rewriting…' : 'Rewrite'}
      </button>
      {error ? <span className="ml-2 text-xs text-red-600">{error}</span> : null}
    </>
  );
}

export function TranslateButton({ text, onResult, size = 'sm', disabled }: InlineAIButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={loading || disabled || text.trim().length === 0}
        onClick={() =>
          invoke(
            'translate',
            { text, targetLocale: 'es' },
            onResult,
            setLoading,
            setError,
          )
        }
        className={baseClass(size)}
        title="Translate text preserving entities/dates/currency"
      >
        <Languages className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        {loading ? 'Translating…' : 'Translate'}
      </button>
      {error ? <span className="ml-2 text-xs text-red-600">{error}</span> : null}
    </>
  );
}

export function ExtractButton({ text, onResult, size = 'sm', disabled }: InlineAIButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={loading || disabled || text.trim().length === 0}
        onClick={() =>
          invoke(
            'extract',
            {
              source: { kind: 'text', text },
              schema: { topic: { type: 'string' } },
            },
            onResult,
            setLoading,
            setError,
          )
        }
        className={baseClass(size)}
        title="Extract typed field(s) from free text"
      >
        <FilePlus className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        {loading ? 'Extracting…' : 'Extract'}
      </button>
      {error ? <span className="ml-2 text-xs text-red-600">{error}</span> : null}
    </>
  );
}

export function CompareButton({ text, onResult, size = 'sm', disabled }: InlineAIButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={loading || disabled || text.trim().length === 0}
        onClick={() =>
          invoke(
            'compare',
            {
              left: { kind: 'text', text },
              right: { kind: 'text', text: '' },
            },
            onResult,
            setLoading,
            setError,
          )
        }
        className={baseClass(size)}
        title="Compare this source with another"
      >
        <GitCompare className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        {loading ? 'Comparing…' : 'Compare'}
      </button>
      {error ? <span className="ml-2 text-xs text-red-600">{error}</span> : null}
    </>
  );
}

export function DraftReportButton({ text, onResult, size = 'sm', disabled }: InlineAIButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={loading || disabled || text.trim().length === 0}
        onClick={() =>
          invoke(
            'draft-report',
            { topic: text, sources: [{ kind: 'text', text }] },
            onResult,
            setLoading,
            setError,
          )
        }
        className={baseClass(size)}
        title="Draft a structured report from this topic"
      >
        <FileText className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        {loading ? 'Drafting…' : 'Draft report'}
      </button>
      {error ? <span className="ml-2 text-xs text-red-600">{error}</span> : null}
    </>
  );
}

export function DraftEmailButton({
  text,
  recipientEmail,
  onResult,
  size = 'sm',
  disabled,
}: InlineAIButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={loading || disabled || text.trim().length === 0}
        onClick={() =>
          invoke(
            'draft-email',
            {
              source: { kind: 'text', text },
              recipient: { email: recipientEmail ?? 'demo@example.com' },
              intent: text,
            },
            onResult,
            setLoading,
            setError,
          )
        }
        className={baseClass(size)}
        title="Draft an email reply — sends only after explicit approval"
      >
        <Mail className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        {loading ? 'Drafting…' : 'Draft email'}
      </button>
      {error ? <span className="ml-2 text-xs text-red-600">{error}</span> : null}
    </>
  );
}
