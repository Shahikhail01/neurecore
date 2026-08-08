'use client';

/**
 * Phase 11 — SkillInvocationDrawer.
 *
 * The "Use" button opens this drawer with a typed input form. The
 * actual invocation goes through the chat dispatcher so the call is
 * persisted to chat history + audited.
 *
 * SRP: this component owns ONLY the form state + submit glue.
 */

import { FormEvent, useState } from 'react';
import {
  SkillDescriptor,
  SkillInvokeInputMap,
  skillsService,
} from '@/services/skills.service';

interface SkillInvocationDrawerProps {
  skill: SkillDescriptor;
  onClose: () => void;
}

interface DrawerState {
  loading: boolean;
  result: string | null;
  error: string | null;
}

const initial: DrawerState = { loading: false, result: null, error: null };

/** Form-to-payload mapping. One function per skill; pure for testability. */
function buildPayload(skillId: string, text: string): unknown {
  switch (skillId) {
    case 'summarize':
      return { source: { kind: 'text', text } } satisfies SkillInvokeInputMap['summarize'];
    case 'rewrite':
      return { text, mode: 'shorten' } satisfies SkillInvokeInputMap['rewrite'];
    case 'translate':
      return { text, targetLocale: 'es' } satisfies SkillInvokeInputMap['translate'];
    case 'extract':
      return {
        source: { kind: 'text', text },
        schema: { topic: { type: 'string' } },
      } satisfies SkillInvokeInputMap['extract'];
    case 'compare':
      return {
        left: { kind: 'text', text },
        right: { kind: 'text', text: '' },
      } satisfies SkillInvokeInputMap['compare'];
    case 'draft-report':
      return {
        topic: text,
        sources: [{ kind: 'text', text }],
      } satisfies SkillInvokeInputMap['draft-report'];
    case 'draft-email':
      return {
        source: { kind: 'text', text },
        recipient: { email: 'demo@example.com' },
        intent: text,
      } satisfies SkillInvokeInputMap['draft-email'];
    default:
      return { text };
  }
}

function fieldLabel(skillId: string): string {
  switch (skillId) {
    case 'summarize':
      return 'Text to summarize';
    case 'rewrite':
      return 'Text to rewrite (shorten)';
    case 'translate':
      return 'Text to translate (defaults to Spanish)';
    case 'extract':
      return 'Text to extract fields from';
    case 'compare':
      return 'Paste left text, then a separator, then right text';
    case 'draft-report':
      return 'Report topic';
    case 'draft-email':
      return 'Email intent';
    default:
      return 'Input';
  }
}

function placeholderHint(skillId: string): string {
  switch (skillId) {
    case 'summarize':
      return 'Paste the source you want summarized here…';
    case 'rewrite':
      return 'Paste the original text and the skill will shorten it…';
    case 'translate':
      return 'Paste the text in any language…';
    case 'extract':
      return 'Paste free-form text; the skill extracts a "topic" string field.';
    case 'compare':
      return 'A versus B — the comparison skill finds differences.';
    case 'draft-report':
      return '"Quarterly forecasting risk analysis" — the skill drafts a report.';
    case 'draft-email':
      return 'Reply to confirm Tuesday at 3pm';
    default:
      return '';
  }
}

export function SkillInvocationDrawer({ skill, onClose }: SkillInvocationDrawerProps) {
  const [state, setState] = useState<DrawerState>(initial);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const text = String(fd.get('text') ?? '');
    if (!text.trim()) return;
    setState({ loading: true, result: null, error: null });
    try {
      const out = await (skillsService.invokeViaChat as (
        id: string,
        payload: unknown,
      ) => Promise<{ content: string }>)(skill.id, buildPayload(skill.id, text));
      setState({ loading: false, result: out.content, error: null });
    } catch (err) {
      setState({ loading: false, result: null, error: (err as Error).message });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`skill-${skill.id}-title`}
      className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
    >
      <div
        className="bg-background rounded-t-lg md:rounded-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); } }}
      >
        <header className="mb-4">
          <h2 id={`skill-${skill.id}-title`} className="font-semibold text-foreground">
            {skill.name}
          </h2>
          <p className="text-xs text-foreground-muted mt-1">
            {skill.description}
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-sm text-foreground">{fieldLabel(skill.id)}</span>
            <textarea
              name="text"
              required
              rows={5}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder={placeholderHint(skill.id)}
            />
          </label>

          {state.error ? (
            <p className="text-sm text-red-600">{state.error}</p>
          ) : null}
          {state.result ? (
            <pre className="text-sm whitespace-pre-wrap bg-surface-muted rounded p-3 border border-border">
              {state.result}
            </pre>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-sm border border-border"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={state.loading}
              className="px-3 py-1.5 rounded text-sm bg-primary text-primary-foreground disabled:opacity-50"
            >
              {state.loading ? 'Running…' : 'Run skill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
