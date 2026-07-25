/**
 * ProjectCreationDiscovery — Layer 2 of the 3-host create flow.
 *
 * Owns the Information Engine interaction. Renders the CompletenessMeter
 * and the QuestionEngine. On `onSkip` returns to the host with
 * `skipped=true`; on `onComplete` returns with `skipped=false`.
 *
 * Reads from `useProjectStore` so the meter stays in sync across
 * navigation. Does NOT fetch directly.
 */

'use client';

import { useEffect, useMemo } from 'react';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import {
  CompletenessMeter,
  QuestionEngine,
  useAdaptiveNext,
  useCompleteness,
  useResolvedRequirements,
  useRecordResponse,
} from '@/components/discovery';

export interface ProjectCreationDiscoveryProps {
  projectId: string;
  onSkip: () => void;
  onComplete: () => void;
  onBack: () => void;
}

export function ProjectCreationDiscovery({
  projectId,
  onSkip,
  onComplete,
  onBack,
}: ProjectCreationDiscoveryProps) {
  const { snapshot, loading: snapLoading, error: snapError, refresh: refreshSnap } =
    useCompleteness(projectId);
  const { questions, loading: reqLoading, refresh: refreshReqs } =
    useResolvedRequirements(projectId);
  const { question, existingResponse, loading: nextLoading, refresh: refreshNext } =
    useAdaptiveNext(projectId);
  const { record, error: recordError } = useRecordResponse(projectId);

  // When the user submits an answer, re-fetch requirements + next + meter.
  // Only advance if the write actually succeeded — useRecordResponse returns
  // null on failure (and sets recordError), so we must not blindly refresh
  // (which would re-fetch the same unanswered question and appear to "loop").
  async function handleRecord(value: unknown) {
    if (!question) return;
    const result = await record({
      questionId: question.questionId,
      value,
      sourceType: 'USER_INPUT',
      sourceLabel: 'Discovery form',
      confidence: 100,
    });
    if (result === null) {
      // Write failed — recordError is set and surfaced via QuestionEngine.
      return;
    }
    await Promise.all([refreshReqs(), refreshNext(), refreshSnap()]);
  }

  // Recompute meter once on mount.
  useEffect(() => {
    void refreshSnap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const totalRequired = snapshot?.totalRequired ?? 0;
  const allRequiredAnswered = totalRequired > 0 && snapshot?.score === 100;

  // For untyped projects (engine returns 0 required), auto-advance only
  // after loading has definitively finished (reqLoading === false means "done",
  // undefined means "not yet started" — we must not skip in that window).
  const noQuestions = useMemo(
    () => reqLoading === false && questions.length === 0,
    [reqLoading, questions.length],
  );

  useEffect(() => {
    if (noQuestions && projectId) {
      onComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noQuestions, projectId]);

  return (
    <div className="space-y-4" data-testid="discovery-host">
      <div className="border-t border-surface-border pt-3">
        <CompletenessMeter
          snapshot={snapshot}
          loading={snapLoading}
          error={snapError}
          onRetry={refreshSnap}
        />
      </div>
      <div>
        <QuestionEngine
          projectId={projectId}
          question={question}
          existingResponseValue={existingResponse?.value}
          loading={nextLoading || reqLoading}
          onRecord={handleRecord}
          onSkip={onSkip}
          onComplete={onComplete}
        />
        {recordError ? (
          <p
            className="mt-2 text-xs text-[color:var(--visual-accent-rose-400)]"
            data-testid="discovery-record-error"
          >
            Could not save your answer: {recordError}
          </p>
        ) : null}
      </div>
      <div className="flex justify-between gap-2 pt-3 border-t border-surface-border">
        <ActionButton variant="ghost" size="md" onClick={onBack}>
          ← Back to Essentials
        </ActionButton>
        <div className="flex gap-2">
          <ActionButton variant="ghost" size="md" onClick={onSkip} data-testid="discovery-skip">
            Skip for now
          </ActionButton>
          <ActionButton
            variant="primary"
            size="md"
            onClick={onComplete}
            disabled={!allRequiredAnswered && totalRequired > 0}
            data-testid="discovery-continue"
          >
            {allRequiredAnswered ? 'Continue to Review →' : 'Skip to Review →'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}