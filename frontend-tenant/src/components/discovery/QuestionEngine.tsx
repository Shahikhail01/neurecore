/**
 * QuestionEngine — Single Responsibility: dispatch one question to the
 * right skin. The engine knows nothing about the form, the list, or the
 * store. Callers (Discovery host) feed it the next question and a
 * `recordAnswer` callback.
 */

'use client';

import { useEffect, useState } from 'react';
import type { ResolvedQuestion, AskChannel } from './types';
import { FormSkin } from './skins/FormSkin';
import { InterviewSkin } from './skins/InterviewSkin';
import { DocumentSkin } from './skins/DocumentSkin';
import { AdaptiveNextButton } from './AdaptiveNextButton';
import {
  SkinSwitcher,
  type SkinKind,
  readSkinChoice,
} from './SkinSwitcher';

export interface QuestionEngineProps {
  projectId: string;
  question: ResolvedQuestion | null;
  /** Pre-existing response value for the current question (from DB). */
  existingResponseValue?: unknown;
  loading?: boolean;
  error?: string | null;
  onRecord: (value: unknown) => Promise<void>;
  onSkip?: () => void;
  onComplete?: () => void;
  /** Externally-provided preferred skin (persisted). */
  initialSkin?: SkinKind;
}

export function QuestionEngine({
  projectId,
  question,
  existingResponseValue,
  loading,
  error,
  onRecord,
  onSkip,
  onComplete,
  initialSkin,
}: QuestionEngineProps) {
  const [skin, setSkin] = useState<SkinKind>(initialSkin ?? 'form');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSkin(readSkinChoice(projectId, initialSkin ?? 'form'));
  }, [projectId, initialSkin]);

  if (loading) {
    return (
      <div className="text-xs text-zinc-500" data-testid="question-engine-loading">
        Loading next question…
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-xs text-[color:var(--visual-accent-rose-400)]" data-testid="question-engine-error">
        {error}
      </div>
    );
  }
  if (!question) {
    return (
      <div className="space-y-2" data-testid="question-engine-done">
        <p className="text-sm text-emerald-300">All required questions answered.</p>
        {onComplete ? (
          <button
            type="button"
            onClick={onComplete}
            className="text-sm px-3 py-1.5 rounded bg-[color:var(--accent-500)] text-white hover:bg-[color:var(--accent-500)]"
          >
            Continue
          </button>
        ) : null}
      </div>
    );
  }

  const allowedSkins = question.askVia && question.askVia.length > 0 ? question.askVia : (['form'] as AskChannel[]);
  const allowedAsKinds: SkinKind[] = allowedSkins as unknown as SkinKind[];

  async function handleSubmit(value: unknown) {
    setSubmitting(true);
    try {
      await onRecord(value);
    } finally {
      setSubmitting(false);
    }
  }

  function handleChannelPick(channel: AskChannel) {
    setSkin(channel);
  }

  return (
    <div className="space-y-4" data-testid="question-engine">
      <div className="flex items-center justify-between">
        <SkinSwitcher
          projectId={projectId}
          value={skin}
          onChange={setSkin}
          allowed={allowedAsKinds}
        />
        <AdaptiveNextButton
          askVia={allowedSkins}
          onPick={handleChannelPick}
          disabled={submitting}
        />
      </div>
      <div>
        {skin === 'interview' ? (
          <InterviewSkin
            question={question}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        ) : skin === 'document' ? (
          <DocumentSkin
            question={question}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        ) : (
          <FormSkin
            question={question}
            existingValue={existingResponseValue}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        )}
      </div>
      {onSkip ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSkip}
            disabled={submitting}
            className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
            data-testid="question-engine-skip"
          >
            Skip for now →
          </button>
        </div>
      ) : null}
    </div>
  );
}