'use client';

// app/settings/wizard/page.tsx — Settings index page for all 13 progressive
// onboarding wizards grouped by setup phase with weighted progress.

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, CheckCircle2 } from 'lucide-react';
import { useOnboardingChecklist } from '@/hooks/useOnboardingChecklist';
import { PHASE_LABELS, PHASE_DESCRIPTIONS, WIZARD_PHASES } from '@/lib/wizard/types';
import type { WizardPhase } from '@/lib/wizard/types';
import { PageShell, PageHero, GlassPanel, StatTile, StatRow } from '@neurecore/ui-visual';

export default function WizardIndexPage() {
  const { entries, isHydrated, isLoading, phaseProgress, progress, doneSlugs } = useOnboardingChecklist();

  if (!isHydrated || isLoading) {
    return (
      <PageShell variant="default">
        <GlassPanel variant="panel" padding="md" className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </GlassPanel>
      </PageShell>
    );
  }

  const entriesByPhase = (phase: WizardPhase) =>
    entries.filter((e) => e.config.phase === phase);

  return (
    <PageShell variant="default">
      <PageHero
        eyebrow="Settings"
        title="Setup Center"
        subtitle={
          <>
            Complete these steps to fully configure NeureCore for your organization.
            <br />
            Weighted progress: {progress.doneWeight}/{progress.totalWeight} ({progress.percent}%)
          </>
        }
      />

      <StatRow>
        <StatTile label="Overall" value={`${progress.percent}%`} accent="violet" hint={`${progress.doneWeight}/${progress.totalWeight} weighted`} />
        <StatTile label="Done" value={Array.from(doneSlugs).length} accent="emerald" hint="of all setup tasks" />
        <StatTile label="Remaining" value={entries.length - Array.from(doneSlugs).length} accent="amber" hint="to unlock all features" />
        <StatTile label="Phases" value={WIZARD_PHASES.length} accent="cyan" hint="Setup phases" />
      </StatRow>

      <Progress value={progress.percent} className="h-2" />

      {WIZARD_PHASES.map((phase) => {
        const phaseEntries = entriesByPhase(phase);
        if (phaseEntries.length === 0) return null;
        const pp = phaseProgress[phase];
        const allDone = phaseEntries.every(
          (e) => e.state === 'DONE' || e.state === 'SKIPPED',
        );

        return (
          <GlassPanel key={phase} variant="panel" padding="md">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-zinc-100">
                  {allDone && <CheckCircle2 className="w-4 h-4 text-[color:var(--state-success)]" />}
                  Phase {phase}: {PHASE_LABELS[phase]}
                </h2>
                <p className="text-xs text-zinc-400">
                  {PHASE_DESCRIPTIONS[phase]}
                </p>
              </div>
              <span className="text-sm text-zinc-400 shrink-0 ml-4">
                {pp.doneWeight}/{pp.totalWeight}
              </span>
            </div>
            <Progress value={pp.percent} className="h-1.5 mb-3" />
            <div className="space-y-2">
              {phaseEntries.map((entry) => {
                const deps: string[] = entry.config.dependsOn ?? [];
                const locked = deps.length > 0 && !deps.every((d) => doneSlugs.has(d));
                return (
                  <Link
                    key={entry.slug}
                    href={locked ? '#' : `/settings/wizard/${entry.slug}`}
                    onClick={(e) => { if (locked) e.preventDefault(); }}
                    className="block"
                  >
                    <Card className={`transition ${
                      locked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-[color:var(--accent-500)]/40'
                    } ${
                      entry.state === 'DONE'
                        ? 'border-[color:var(--state-success)]/30 bg-[color:var(--state-success)]/5'
                        : entry.state === 'SKIPPED'
                          ? 'border-white/10 bg-white/5'
                          : ''
                    }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            {locked && <Lock className="w-3.5 h-3.5 text-zinc-500" />}
                            {entry.config.title}
                            {entry.state === 'DONE' && (
                              <CheckCircle2 className="w-4 h-4 text-[color:var(--state-success)]" />
                            )}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                entry.state === 'DONE'
                                  ? 'default'
                                  : entry.state === 'SKIPPED'
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {entry.state === 'DONE'
                                ? 'Done'
                                : entry.state === 'SKIPPED'
                                  ? 'Skipped'
                                  : locked
                                    ? 'Locked'
                                    : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-zinc-400">
                          {entry.config.description}
                        </p>
                        <p className="text-xs text-zinc-500 mt-2">
                          {entry.config.estimatedValue} · ~{entry.config.estimatedMinutes}m
                          {deps.length > 0 && locked && (
                            <span className="ml-2 text-[color:var(--state-danger)]">
                              Requires: {deps.join(', ')}
                            </span>
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </GlassPanel>
        );
      })}
    </PageShell>
  );
}
