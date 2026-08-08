/**
 * InterviewSkin — chat-bubble view.
 *
 * Phase 2D: visual surface only. The Hermes conversational channel
 * (Phase 2E) wires the real LLM via askInterview/answerInterview.
 * For now the skin renders the question as a "Hermes asked…" bubble
 * with a text reply input.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { ResolvedQuestion } from '../types';

export interface InterviewSkinProps {
  question: ResolvedQuestion;
  onSubmit: (value: unknown) => Promise<void>;
  submitting?: boolean;
  disabled?: boolean;
}

export function InterviewSkin({
  question,
  onSubmit,
  submitting,
  disabled,
}: InterviewSkinProps) {
  const [reply, setReply] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setReply('');
  }, [question.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    await onSubmit(reply.trim());
  }

  return (
    <div className="space-y-3" data-testid="interview-skin">
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        <Bubble role="assistant">
          {question.helpText ? (
            <span className="text-zinc-300">{question.helpText}</span>
          ) : (
            <span className="text-zinc-300">Tell me about</span>
          )}{' '}
          <strong className="text-zinc-100">{question.label}</strong>
          {question.required ? <span className="text-[color:var(--visual-accent-rose-400)]"> *</span> : null}
        </Bubble>
        {reply.trim() ? (
          <Bubble role="user">{reply}</Bubble>
        ) : null}
      </div>
      <form ref={formRef} onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          aria-label="Your answer"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          disabled={disabled || submitting}
          placeholder="Type your answer…"
          data-testid="interview-skin-input"
          className="flex-1 text-sm rounded border border-surface-border bg-surface-base px-2 py-1.5 text-zinc-100 focus:outline-none focus:border-[color:var(--accent-500)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={submitting || disabled || !reply.trim()}
          data-testid="interview-skin-submit"
          className="text-sm px-3 py-1.5 rounded bg-[color:var(--accent-500)] text-white hover:bg-[color:var(--accent-500)] disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function Bubble({
  role,
  children,
}: {
  role: 'assistant' | 'user';
  children: React.ReactNode;
}) {
  const isAssistant = role === 'assistant';
  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] text-sm rounded-lg px-3 py-2 ${
          isAssistant
            ? 'bg-surface-elevated text-zinc-200'
            : 'bg-[color:var(--accent-500)]/20 text-indigo-100 border border-[color:var(--accent-500)]/30'
        }`}
      >
        <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">
          {isAssistant ? 'Hermes' : 'You'}
        </div>
        {children}
      </div>
    </div>
  );
}