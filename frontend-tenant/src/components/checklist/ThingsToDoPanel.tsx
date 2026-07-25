'use client';

// components/checklist/ThingsToDoPanel.tsx — Phase-aware floating card
// on the Home page showing pending onboarding wizards grouped by setup phase
// with weighted progress, dependency awareness, and smart next-item recommendation.

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useOnboardingChecklist } from '@/hooks/useOnboardingChecklist';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import { PHASE_LABELS, WIZARD_PHASES } from '@/lib/wizard/types';
import type { WizardPhase } from '@/lib/wizard/types';
import { Lock, ChevronRight } from 'lucide-react';

export function ThingsToDoPanel() {
  const {
    isHydrated,
    isLoading,
    lastError,
    visiblePending,
    progress,
    phaseProgress,
    nextRecommended,
    doneSlugs,
    globalDismissed,
  } = useOnboardingChecklist();
  const entries = useOnboardingChecklistStore((s) => s.entries);
  const dismissAll = useOnboardingChecklistStore((s) => s.dismissAll);

  if (!isHydrated || isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (lastError) {
    return (
      <Card className="w-full max-w-md border-destructive/40">
        <CardHeader>
          <CardTitle className="text-sm">Things to do</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-destructive">
            Couldn't load your setup checklist: {lastError}
          </p>
        </CardContent>
      </Card>
    );
  }

  const allDone = entries.length > 0 && entries.every(
    (e) => e.state === 'DONE' || e.state === 'SKIPPED',
  );

  if (allDone || visiblePending.length === 0) {
    return (
      <Card className="w-full max-w-md border-[color:var(--state-success)]/30 bg-[color:var(--state-success)]/5">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <span>✅</span> All caught up
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Your portal is fully configured. Revisit later from{' '}
            <Link href="/settings/wizard" className="underline">
              Settings → Setup
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Setup progress</CardTitle>
          <span className="text-xs text-muted-foreground">
            {progress.doneWeight}/{progress.totalWeight}
          </span>
        </div>
        <Progress value={progress.percent} className="h-1.5 mt-2" />
        <p className="text-xs text-muted-foreground mt-1">
          {progress.percent}% · weighted by importance
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {nextRecommended && (
          <Link
            href={`/settings/wizard/${nextRecommended.slug}`}
            className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 hover:bg-primary/10 transition"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-primary">Recommended next</p>
              <p className="text-sm truncate">{nextRecommended.config.title}</p>
              <p className="text-xs text-muted-foreground">
                ~{nextRecommended.config.estimatedMinutes}m
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-primary shrink-0" />
          </Link>
        )}

        {WIZARD_PHASES.map((phase) => {
          const phaseEntries = entries.filter((e) => e.config.phase === phase);
          const pendingInPhase = phaseEntries.filter(
            (e) => e.state === 'PENDING' && e.missionFeedItem && !e.missionFeedItem.dismissedAt,
          );
          if (pendingInPhase.length === 0 && phaseEntries.every((e) => e.state === 'DONE' || e.state === 'SKIPPED')) {
            return null;
          }
          const pp = phaseProgress[phase];
          return (
            <div key={phase} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {PHASE_LABELS[phase]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {pp.done}/{pp.total} · {pp.percent}%
                </span>
              </div>
              <Progress value={pp.percent} className="h-1" />
              {pendingInPhase.slice(0, 2).map((entry) => {
                const deps: string[] = entry.config.dependsOn ?? [];
                const locked = deps.length > 0 && !deps.every((d) => doneSlugs.has(d));
                return (
                  <Link
                    key={entry.slug}
                    href={locked ? '#' : `/settings/wizard/${entry.slug}`}
                    className={`flex items-start justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2 transition ${
                      locked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-primary/40 hover:bg-background/60'
                    }`}
                    onClick={(e) => { if (locked) e.preventDefault(); }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate flex items-center gap-1">
                        {locked && <Lock className="w-3 h-3 shrink-0" />}
                        {entry.config.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {entry.config.estimatedValue} · ~{entry.config.estimatedMinutes}m
                      </p>
                    </div>
                    {!locked && (
                      <Button variant="ghost" size="sm" className="shrink-0">
                        Open
                      </Button>
                    )}
                  </Link>
                );
              })}
              {pendingInPhase.length > 2 && (
                <Link
                  href="/settings/wizard"
                  className="block text-center text-xs text-primary hover:underline pt-1"
                >
                  +{pendingInPhase.length - 2} more in {PHASE_LABELS[phase]} →
                </Link>
              )}
            </div>
          );
        })}

        {visiblePending.length > 0 && !globalDismissed && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground mt-1"
            onClick={() => void dismissAll(true)}
          >
            Hide this panel
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
