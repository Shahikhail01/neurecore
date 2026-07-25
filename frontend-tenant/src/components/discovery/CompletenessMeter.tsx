/**
 * CompletenessMeter — 0-100 bar + missing list.
 *
 * SRP: visual surface only; reads from props. No fetches.
 */

'use client';

import type { EntityCompleteness, MissingItem } from './types';

export interface CompletenessMeterProps {
  snapshot: EntityCompleteness | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function pctClass(score: number): string {
  if (score >= 100) return 'bg-[color:var(--state-success)]';
  if (score >= 75) return 'bg-[color:var(--state-success)]/70';
  if (score >= 50) return 'bg-[color:var(--state-warning)]';
  return 'bg-[color:var(--visual-accent-rose-500)]';
}

function fmtCount(s: EntityCompleteness | null): string {
  if (!s) return '—';
  return `${s.totalResolved}/${s.totalRequired}`;
}

export function CompletenessMeter({
  snapshot,
  loading,
  error,
  onRetry,
}: CompletenessMeterProps) {
  if (loading) {
    return (
      <div className="text-xs text-zinc-500" data-testid="completeness-loading">
        Computing completeness…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-[color:var(--visual-accent-rose-400)]" data-testid="completeness-error">
        <span>{error}</span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="underline hover:text-rose-300"
          >
            retry
          </button>
        ) : null}
      </div>
    );
  }
  if (!snapshot) {
    return (
      <div className="text-xs text-zinc-500" data-testid="completeness-empty">
        No completeness data yet.
      </div>
    );
  }

  const { score, missing } = snapshot;
  return (
    <div className="space-y-2" data-testid="completeness-meter">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-zinc-400 uppercase tracking-wider">Completeness</span>
        <span className="text-xs text-zinc-300 font-mono">{fmtCount(snapshot)} · {score}%</span>
      </div>
      <div
        className="h-1.5 w-full rounded-full bg-surface-border overflow-hidden"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full ${pctClass(score)} transition-all duration-300`}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>
      {missing.length > 0 ? (
        <details className="text-xs text-zinc-400">
          <summary className="cursor-pointer hover:text-zinc-300">
            {missing.length} missing
          </summary>
          <ul className="mt-2 space-y-1 pl-3">
            {missing.map((m: MissingItem) => (
              <li key={m.questionId} className="flex items-baseline gap-2">
                <span className="text-zinc-500">{m.whyMissing.toLowerCase().replace(/_/g, ' ')}</span>
                <span className="text-zinc-300">{m.label}</span>
                {m.suggestSourceTypes.length > 0 ? (
                  <span className="text-[10px] text-zinc-600">
                    via {m.suggestSourceTypes.slice(0, 2).join(', ')}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}