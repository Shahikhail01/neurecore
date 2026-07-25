'use client';

// /onboarding/setup — Initial onboarding wizard orchestrator.
// 7 steps total: Company → Logo → Localization → Plan → Template
// → Integrations → Complete.
// Google Workspace and Brevo are first-class steps because they are vital
// for company working (documentation, calendar, email, notifications).
// Team invites + Review are demoted to sub-wizards (see /settings/wizard/team).
//
// This page is intentionally thin: it manages step state, hydrates from
// GET /tenants/me/current, and delegates each step to its own component.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { tenantsService, type TenantSelf } from '@/services/tenants.service';
import { onboardingService } from '@/services/onboarding.service';
import { Skeleton } from '@/components/ui/skeleton';
import { PageShell, PageHero, GlassPanel, GradientText } from '@neurecore/ui-visual';
import { CompanyStep } from './steps/CompanyStep';
import { LogoStep } from './steps/LogoStep';
import { LocalizationStep } from './steps/LocalizationStep';
import { PlanStep } from './steps/PlanStep';
import { TemplateStep } from './steps/TemplateStep';
import { CompleteStep } from './steps/CompleteStep';
import { IntegrationsStep } from './steps/IntegrationsStep';

type Tier1Step = 'company' | 'logo' | 'localization' | 'plan' | 'template' | 'integrations' | 'complete';

const STEPS: { id: Tier1Step; label: string }[] = [
  { id: 'company', label: 'Company' },
  { id: 'logo', label: 'Logo' },
  { id: 'localization', label: 'Locale' },
  { id: 'plan', label: 'Plan' },
  { id: 'template', label: 'Template' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'complete', label: 'Done' },
];

export default function OnboardingSetupPage() {
  const user = useTenantAuth();
  const [step, setStep] = useState<Tier1Step>('company');
  const [tenant, setTenant] = useState<TenantSelf | null>(null);
  const [isReRun, setIsReRun] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Re-fetch tenant from the server. Called after every step transition so
   * the next step renders with the latest persisted values (e.g. logo URL).
   */
  const refreshTenant = async (): Promise<TenantSelf | null> => {
    try {
      const t = await tenantsService.getCurrent();
      setTenant(t);
      return t;
    } catch {
      return null;
    }
  };

  // Hydrate: pull current tenant + onboarding state in parallel.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const [t, state] = await Promise.all([
          tenantsService.getCurrent(),
          onboardingService.getState().catch(() => null),
        ]);
        if (cancelled) return;
        setTenant(t);
        // INDUSTRY-SETUP-CONCEPT.md §3.1 G8 (Phase 1 G8): capture isReRun
        // so CompanyStep renders the industry as a locked badge on
        // re-running tenants (industry is Super-Admin-only per D7).
        const reRun = Boolean(state?.isReRun);
        setIsReRun(reRun);
        // Resume from the server-tracked step if any. Per INDUSTRY-SETUP-CONCEPT.md
        // §1.2 D7: on re-run, jump straight to Plan — Company/Logo/Localization
        // are skipped because industry (company step) is Super-Admin-only and
        // logo/locale rarely change post-launch.
        if (reRun) {
          setStep('plan');
        } else if (state?.step === 'plan') setStep('plan');
        else if (state?.step === 'template') setStep('template');
        else if (state?.step === 'review' || state?.step === 'team')
          setStep('integrations');
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <PageShell variant="default">
        <GlassPanel variant="panel" padding="md">
          <Skeleton className="h-12 w-full" />
        </GlassPanel>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell variant="default">
        <GlassPanel variant="panel" padding="md" className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </GlassPanel>
      </PageShell>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <PageShell variant="default">
      <PageHero
        eyebrow={<><Sparkles className="w-3.5 h-3.5 inline mr-1" /> Setup</>}
        title="Welcome to NeureCore"
        subtitle="Let us set up your organization in a few quick steps. The rest can wait — find optional items under Things to do on your home page."
      />

      <GlassPanel variant="panel" padding="md">
        <ol className="flex items-center gap-2 overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const isComplete = i < currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <li key={s.id} className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isComplete
                      ? 'bg-[color:var(--state-success)] text-white'
                      : isCurrent
                        ? 'nv-btn-accent !p-0 !w-7 !h-7'
                        : 'nv-surface-inline !w-7 !h-7 !rounded-full text-zinc-500'
                  }`}
                >
                  {isComplete ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span
                  className={`text-xs ${isCurrent ? 'font-medium text-zinc-100' : 'text-zinc-500'}`}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-zinc-500 mx-1" />
                )}
              </li>
            );
          })}
        </ol>
      </GlassPanel>

      {error && (
        <GlassPanel variant="panel" padding="md" className="border border-[color:var(--state-danger)]/40 text-[color:var(--state-danger)]">
          {error}
        </GlassPanel>
      )}

      <GlassPanel variant="panel" padding="lg">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {step === 'company' && (
              <CompanyStep
                initialName={tenant?.name ?? ''}
                initialIndustry={tenant?.industry ?? ''}
                isReRun={isReRun}
                onNext={() => {
                  void refreshTenant();
                  setStep('logo');
                }}
              />
            )}
            {step === 'logo' && (
              <LogoStep
                initialLogoUrl={tenant?.logoUrl ?? null}
                onNext={() => {
                  void refreshTenant();
                  setStep('localization');
                }}
                onBack={() => setStep('company')}
              />
            )}
            {step === 'localization' && (
              <LocalizationStep
                initialTimezone={tenant?.timezone ?? 'UTC'}
                initialCurrency={tenant?.currency ?? 'USD'}
                onNext={() => {
                  void refreshTenant();
                  setStep('plan');
                }}
                onBack={() => setStep('logo')}
              />
            )}
            {step === 'plan' && (
              <PlanStep
                initialTierId={tenant?.tierId ?? null}
                onNext={() => {
                  void refreshTenant();
                  setStep('template');
                }}
                onBack={() => setStep('localization')}
              />
            )}
            {step === 'template' && (
              <TemplateStep
                initialSlug={null}
                onNext={() => setStep('integrations')}
                onSkip={() => setStep('integrations')}
                onBack={() => setStep('plan')}
              />
            )}
            {step === 'integrations' && (
              <IntegrationsStep
                onNext={() => setStep('complete')}
                onBack={() => setStep('template')}
              />
            )}
            {step === 'complete' && <CompleteStep />}
          </motion.div>
        </AnimatePresence>
      </GlassPanel>
    </PageShell>
  );
}