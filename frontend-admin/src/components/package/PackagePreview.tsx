"use client";

/**
 * PackagePreview — Phase 10.
 *
 * Live preview panel shown next to the composer. Shows totals, missing items,
 * and category breakdown. Single Responsibility: visual summary of the
 * composition draft.
 */

import type { PackagePreviewResult } from '@/services/packages.service';
import type { PackageRecommendationHistoryEntry } from '@/services/packages.service';
import { useMemo, useState } from 'react';

export function PackagePreview({
  industryName,
  tierName,
  readiness,
  totals,
  missing,
  categories,
  rules,
  onApplySuggested,
  onDismissSuggested,
  onSnoozeSuggested,
  recommendationHistory = [],
}: {
  industryName?: string;
  tierName?: string;
  readiness: PackagePreviewResult['readiness'];
  totals: PackagePreviewResult['totals'];
  missing: PackagePreviewResult['missing'];
  categories: PackagePreviewResult['categories'];
  rules: PackagePreviewResult['rules'];
  onApplySuggested?: (() => void) | undefined;
  onDismissSuggested?: ((reason: string) => void | Promise<void>) | undefined;
  onSnoozeSuggested?: ((reason: string, snoozeUntil: string) => void | Promise<void>) | undefined;
  recommendationHistory?: PackageRecommendationHistoryEntry[];
}) {
  const [dismissReason, setDismissReason] = useState('');
  const [snoozeReason, setSnoozeReason] = useState('');
  const [snoozeUntil, setSnoozeUntil] = useState('2026-08-10');
  const [historyFilter, setHistoryFilter] = useState<
    'ALL' | 'ACCEPTED' | 'DISMISSED' | 'SNOOZED' | 'ACTIVE_SNOOZES' | 'OVERDUE_SNOOZES'
  >('ALL');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const historyWithDiff = useMemo(
    () =>
      recommendationHistory.map((entry, index) => {
        const current = entry.details?.suggestedFeatureKeys ?? [];
        const previous = recommendationHistory[index + 1]?.details?.suggestedFeatureKeys ?? [];
        return {
          entry,
          added: current.filter((item) => !previous.includes(item)),
          removed: previous.filter((item) => !current.includes(item)),
        };
      }),
    [recommendationHistory],
  );
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'ALL') return historyWithDiff;
    if (historyFilter === 'ACTIVE_SNOOZES') {
      return historyWithDiff.filter(({ entry }) => (
        entry.action === 'packages.recommendations.snoozed' &&
        typeof entry.details?.snoozeUntil === 'string' &&
        new Date(entry.details.snoozeUntil).getTime() > Date.now()
      ));
    }
    if (historyFilter === 'OVERDUE_SNOOZES') {
      return historyWithDiff.filter(({ entry }) => (
        entry.action === 'packages.recommendations.snoozed' &&
        typeof entry.details?.snoozeUntil === 'string' &&
        new Date(entry.details.snoozeUntil).getTime() <= Date.now()
      ));
    }
    const action =
      historyFilter === 'ACCEPTED'
        ? 'packages.recommendations.accepted'
        : historyFilter === 'DISMISSED'
          ? 'packages.recommendations.dismissed'
          : 'packages.recommendations.snoozed';
    return historyWithDiff.filter(({ entry }) => entry.action === action);
  }, [historyFilter, historyWithDiff]);
  const decisionSummary = useMemo(() => {
    const accepted = recommendationHistory.filter(
      (entry) => entry.action === 'packages.recommendations.accepted',
    ).length;
    const dismissed = recommendationHistory.filter(
      (entry) => entry.action === 'packages.recommendations.dismissed',
    ).length;
    const snoozed = recommendationHistory.filter(
      (entry) => entry.action === 'packages.recommendations.snoozed',
    ).length;
    const activeSnoozes = recommendationHistory.filter((entry) => {
      if (entry.action !== 'packages.recommendations.snoozed') return false;
      const until = entry.details?.snoozeUntil;
      return typeof until === 'string' && new Date(until).getTime() > Date.now();
    }).length;
    const overdueSnoozes = recommendationHistory.filter((entry) => {
      if (entry.action !== 'packages.recommendations.snoozed') return false;
      const until = entry.details?.snoozeUntil;
      return typeof until === 'string' && new Date(until).getTime() <= Date.now();
    }).length;
    return { accepted, dismissed, snoozed, activeSnoozes, overdueSnoozes };
  }, [recommendationHistory]);

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4 space-y-3 sticky top-4">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-zinc-600">
          Composing
        </div>
        <div className="text-base font-semibold text-zinc-100 mt-1">
          {industryName ?? '—'} · {tierName ?? '—'}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Depts" value={totals.departments} />
        <Stat label="Employees" value={totals.agents} />
        <Stat label="Features" value={totals.features} />
      </div>

      <div className={`rounded-xl border p-3 ${
        rules.conflicts.length > 0 || readiness.label === 'AT_RISK'
          ? 'border-red-800/50 bg-red-950/30'
          : readiness.label === 'NEEDS_REVIEW'
            ? 'border-amber-800/50 bg-yellow-950/20'
            : 'border-emerald-800/50 bg-emerald-950/20'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">
              Deploy readiness
            </div>
            <div className="text-sm font-semibold text-zinc-100 mt-1">
              {readiness.label.replace('_', ' ')}
            </div>
          </div>
          <div className="text-2xl font-semibold text-zinc-100">
            {readiness.score}
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-surface-overlay overflow-hidden">
          <div
            className={`h-full transition-all ${
              readiness.label === 'AT_RISK'
                ? 'bg-red-500'
                : readiness.label === 'NEEDS_REVIEW'
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, readiness.score))}%` }}
          />
        </div>
      </div>

      {Object.keys(categories).length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600">
            Feature categories
          </div>
          {Object.entries(categories).map(([cat, n]) => (
            <div key={cat} className="flex justify-between text-xs text-zinc-400">
              <span>{cat.toLowerCase()}</span>
              <span className="text-zinc-200">{n}</span>
            </div>
          ))}
        </div>
      )}

      {(missing.departments.length > 0 ||
        missing.agents.length > 0 ||
        missing.features.length > 0) && (
        <div className="rounded-lg bg-[color:var(--state-danger)]/50 border border-red-800/60 p-2 text-xs text-red-200">
          {missing.departments.length + missing.agents.length + missing.features.length}{' '}
          references won't resolve
        </div>
      )}

      {rules.conflicts.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-red-300">Conflicts</div>
          {rules.conflicts.map((item) => (
            <div key={item} className="rounded-lg border border-red-800/50 bg-red-950/30 p-2 text-xs text-red-200">
              {item}
            </div>
          ))}
        </div>
      )}

      {rules.dependencies.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-amber-300">Dependencies</div>
          {rules.dependencies.map((item) => (
            <div key={item} className="rounded-lg border border-amber-800/50 bg-yellow-950/30 p-2 text-xs text-amber-200">
              {item}
            </div>
          ))}
        </div>
      )}

      {rules.recommendations.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-emerald-300">Recommendations</div>
            <div className="flex items-center gap-3">
              {onApplySuggested && rules.suggestedFeatureKeys.length > 0 && (
                <button
                  type="button"
                  onClick={onApplySuggested}
                  className="text-[10px] text-emerald-200 hover:text-emerald-100"
                >
                  Apply suggested
                </button>
              )}
              {onDismissSuggested && rules.suggestedFeatureKeys.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const reason = dismissReason.trim();
                    if (!reason) return;
                    void onDismissSuggested(reason);
                    setDismissReason('');
                  }}
                  className="text-[10px] text-amber-200 hover:text-amber-100"
                >
                  Dismiss with reason
                </button>
              )}
              {onSnoozeSuggested && rules.suggestedFeatureKeys.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const reason = snoozeReason.trim();
                    const resumeDate = snoozeUntil.trim();
                    if (!reason || !resumeDate) return;
                    void onSnoozeSuggested(reason, resumeDate);
                    setSnoozeReason('');
                  }}
                  className="text-[10px] text-sky-200 hover:text-sky-100"
                >
                  Apply later
                </button>
              )}
            </div>
          </div>
          {(rules.recommendationDetails.length > 0
            ? rules.recommendationDetails
            : rules.recommendations.map((item) => ({
                message: item,
                severity: 'MEDIUM' as const,
                reason: '',
              }))).map((item) => (
            <div key={item.message} className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-2 text-xs text-emerald-200">
              <div className="flex items-center justify-between gap-2">
                <span>{item.message}</span>
                <span className="rounded-full border border-emerald-700/40 px-1.5 py-0.5 text-[10px]">
                  {item.severity}
                </span>
              </div>
              {item.reason && <div className="mt-1 text-emerald-300/80">{item.reason}</div>}
            </div>
          ))}
          {onDismissSuggested && rules.suggestedFeatureKeys.length > 0 && (
            <textarea
              aria-label="Dismiss reason"
              value={dismissReason}
              onChange={(event) => setDismissReason(event.target.value)}
              rows={3}
              placeholder="Why is this recommendation being overridden or dismissed?"
              className="w-full rounded-lg border border-amber-800/50 bg-yellow-950/20 px-3 py-2 text-xs text-amber-100 placeholder-amber-300/60 focus:outline-none"
            />
          )}
          {onSnoozeSuggested && rules.suggestedFeatureKeys.length > 0 && (
            <div className="space-y-2 rounded-lg border border-sky-800/40 bg-sky-950/20 p-2">
              <textarea
                aria-label="Snooze reason"
                value={snoozeReason}
                onChange={(event) => setSnoozeReason(event.target.value)}
                rows={2}
                placeholder="Why should this be applied later?"
                className="w-full rounded-lg border border-sky-800/50 bg-sky-950/10 px-3 py-2 text-xs text-sky-100 placeholder-sky-300/60 focus:outline-none"
              />
              <input
                aria-label="Snooze until date"
                type="date"
                value={snoozeUntil}
                min="2026-08-04"
                onChange={(event) => setSnoozeUntil(event.target.value)}
                className="w-full rounded-lg border border-sky-800/50 bg-sky-950/10 px-3 py-2 text-xs text-sky-100 focus:outline-none"
              />
            </div>
          )}
        </div>
      )}

      {rules.suggestedBundles.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-sky-300">Suggested bundles</div>
          {rules.suggestedBundles.map((bundle) => (
            <div
              key={bundle.key}
              className="rounded-lg border border-sky-800/40 bg-sky-950/20 p-2 text-xs text-sky-100"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{bundle.label}</span>
                <span className="rounded-full border border-sky-700/40 px-1.5 py-0.5 text-[10px]">
                  {bundle.priority}
                </span>
              </div>
              <div className="mt-1 text-sky-200/80">{bundle.reason}</div>
              <div className="mt-2 text-[11px] text-sky-300/80">
                Adds: {bundle.featureKeys.join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {recommendationHistory.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600">
            Recommendation audit
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-2 text-center">
              <div className="text-sm font-semibold text-emerald-200">{decisionSummary.accepted}</div>
              <div className="text-[10px] uppercase tracking-widest text-emerald-300/80">Accepted</div>
            </div>
            <div className="rounded-lg border border-amber-800/40 bg-yellow-950/20 p-2 text-center">
              <div className="text-sm font-semibold text-amber-200">{decisionSummary.dismissed}</div>
              <div className="text-[10px] uppercase tracking-widest text-amber-300/80">Dismissed</div>
            </div>
            <div className="rounded-lg border border-sky-800/40 bg-sky-950/20 p-2 text-center">
              <div className="text-sm font-semibold text-sky-200">{decisionSummary.snoozed}</div>
              <div className="text-[10px] uppercase tracking-widest text-sky-300/80">Snoozed</div>
            </div>
            <div className="rounded-lg border border-cyan-800/40 bg-cyan-950/20 p-2 text-center">
              <div className="text-sm font-semibold text-cyan-200">{decisionSummary.activeSnoozes}</div>
              <div className="text-[10px] uppercase tracking-widest text-cyan-300/80">Active snoozes</div>
            </div>
            <div className="rounded-lg border border-rose-800/40 bg-rose-950/20 p-2 text-center">
              <div className="text-sm font-semibold text-rose-200">{decisionSummary.overdueSnoozes}</div>
              <div className="text-[10px] uppercase tracking-widest text-rose-300/80">Overdue snoozes</div>
            </div>
          </div>
          <div className="flex gap-1">
            {(['ALL', 'ACCEPTED', 'DISMISSED', 'SNOOZED', 'ACTIVE_SNOOZES', 'OVERDUE_SNOOZES'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setHistoryFilter(filter)}
                className={`rounded-full border px-2 py-1 text-[10px] ${
                  historyFilter === filter
                    ? 'border-[color:var(--accent-500)] text-zinc-100'
                    : 'border-surface-border text-zinc-500'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          {filteredHistory.slice(0, 6).map(({ entry, added, removed }) => {
            const actorName = entry.user
              ? `${entry.user.firstName} ${entry.user.lastName}`.trim() || entry.user.email
              : 'Operator';
            const suggested = entry.details?.suggestedFeatureKeys?.join(', ') || 'Suggested features';
            const actionLabel =
              entry.action === 'packages.recommendations.dismissed'
                ? 'Dismissed'
                : entry.action === 'packages.recommendations.snoozed'
                  ? 'Snoozed'
                  : 'Accepted';
            const snoozeUntilMs =
              typeof entry.details?.snoozeUntil === 'string'
                ? new Date(entry.details.snoozeUntil).getTime()
                : null;
            const snoozeState =
              entry.action === 'packages.recommendations.snoozed' && snoozeUntilMs !== null
                ? (snoozeUntilMs > Date.now() ? 'Active' : 'Overdue')
                : null;
            return (
              <div
                key={entry.id}
                className="rounded-lg border border-surface-border bg-surface-overlay p-2 text-xs text-zinc-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-100">{actorName}</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-surface-border px-1.5 py-0.5 text-[10px] text-zinc-300">
                      {actionLabel}
                    </span>
                    <span className="text-zinc-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="mt-1 text-zinc-400">{suggested}</div>
                {(added.length > 0 || removed.length > 0) && (
                  <div className="mt-1 space-y-1">
                    {added.length > 0 && (
                      <div className="text-emerald-300/80">+ {added.join(', ')}</div>
                    )}
                    {removed.length > 0 && (
                      <div className="text-red-300/80">- {removed.join(', ')}</div>
                    )}
                  </div>
                )}
                {entry.details?.reason && (
                  <div className="mt-1 text-amber-300/80">{entry.details.reason}</div>
                )}
                {entry.details?.snoozeUntil && (
                  <div className={`mt-1 ${snoozeState === 'Overdue' ? 'text-rose-300/90' : 'text-sky-300/80'}`}>
                    {snoozeState ? `${snoozeState} · ` : ''}Resume on {new Date(entry.details.snoozeUntil).toLocaleDateString()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setExpandedHistoryId((current) => (current === entry.id ? null : entry.id))}
                  className="mt-2 text-[10px] text-zinc-400 hover:text-zinc-200"
                >
                  {expandedHistoryId === entry.id ? 'Hide details' : 'Show details'}
                </button>
                {expandedHistoryId === entry.id && (
                  <div className="mt-2 rounded-lg border border-surface-border bg-black/10 p-2 text-[10px] text-zinc-400">
                    <div>Resource: {entry.resourceId ?? 'n/a'}</div>
                    <div>Features at decision: {(entry.details?.currentFeatureIds ?? []).length}</div>
                    <div>Departments at decision: {(entry.details?.currentDepartmentIds ?? []).length}</div>
                    <div>Agents at decision: {(entry.details?.currentAiAgentIds ?? []).length}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-overlay p-2">
      <div className="text-lg font-bold text-zinc-100">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-600 mt-0.5">{label}</div>
    </div>
  );
}
