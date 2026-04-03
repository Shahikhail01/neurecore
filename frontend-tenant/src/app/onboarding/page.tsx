"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { onboardingApi as onboardingService } from "@/services/onboarding.service";
import { authService } from "@/services/auth.service";
import { WizardStep, STEP_LABELS } from "@/types/onboarding.types";
import { OrganizationStep } from "@/components/onboarding/OrganizationStep";
import { AdminStep } from "@/components/onboarding/AdminStep";
import { PlanStep } from "@/components/onboarding/PlanStep";
import { DepartmentsStep } from "@/components/onboarding/DepartmentsStep";
import { TeamStep } from "@/components/onboarding/TeamStep";
import { IntegrationsStep } from "@/components/onboarding/IntegrationsStep";
import { AgentsStep } from "@/components/onboarding/AgentsStep";
import { SecurityStep } from "@/components/onboarding/SecurityStep";
import { ReviewStep } from "@/components/onboarding/ReviewStep";

const ACTIVE_STEPS = [
  WizardStep.ORGANIZATION,
  WizardStep.ADMIN,
  WizardStep.PLAN,
  WizardStep.DEPARTMENTS,
  WizardStep.TEAM,
  WizardStep.INTEGRATIONS,
  WizardStep.AGENTS,
  WizardStep.SECURITY,
  WizardStep.REVIEW,
];

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated, user, setUser } = useAuthStore();
  const {
    wizardId,
    wizardData,
    currentStep,
    isLoading,
    error,
    startWizard,
    setLoading,
    setError,
    setCurrentStep,
    resetWizard,
  } = useOnboardingStore();
  const [completing, setCompleting] = useState(false);

  // Guard: must be logged in
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user?.tenantId) {
      router.replace("/dashboard");
      return;
    }
  }, [_hasHydrated, isAuthenticated, user?.tenantId, router]);

  // If auth'd but no wizardId (direct navigation), start a new wizard
  const autoStart = useCallback(async () => {
    try {
      const { tokenManager } =
        await import("@/core/infrastructure/auth/TokenManager");
      const token = tokenManager.getAccessToken();
      if (!token) return;
      setLoading(true);
      const result = await onboardingService.startAuthenticatedWizard(token);
      startWizard(result.wizardId, token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start wizard");
    } finally {
      setLoading(false);
    }
  }, [startWizard, setLoading, setError]);

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || wizardId) return;
    autoStart();
  }, [_hasHydrated, isAuthenticated, wizardId, autoStart]);

  // ── Step navigation helpers ───────────────────────────────────────────
  const goNext = useCallback(() => {
    const idx = ACTIVE_STEPS.indexOf(currentStep as WizardStep);
    if (idx < ACTIVE_STEPS.length - 1) {
      setCurrentStep(ACTIVE_STEPS[idx + 1]);
    }
  }, [currentStep, setCurrentStep]);

  const goPrev = useCallback(() => {
    const idx = ACTIVE_STEPS.indexOf(currentStep as WizardStep);
    if (idx > 0) {
      setCurrentStep(ACTIVE_STEPS[idx - 1]);
    }
  }, [currentStep, setCurrentStep]);

  // ── Complete wizard ───────────────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    if (!wizardId) return;
    setCompleting(true);
    setError(null);
    try {
      await onboardingService.completeWizard({
        wizardId,
        marketingConsent: wizardData?.marketingConsent ?? false,
      });
      // Refresh tokens so the new tenantId appears in the JWT
      await authService.refresh();
      // Fetch updated user record (now has tenantId)
      const freshUser = await authService.me();
      setUser(freshUser);
      resetWizard();
      router.replace("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to complete setup");
      setCompleting(false);
    }
  }, [wizardId, wizardData, setError, setUser, resetWizard, router]);

  // ── Render current step with wired callbacks ──────────────────────────
  function renderStep(step: WizardStep) {
    switch (step) {
      case WizardStep.ORGANIZATION:
        return <OrganizationStep onSubmit={goNext} onSkip={goNext} />;
      case WizardStep.ADMIN:
        return <AdminStep onSubmit={goNext} onSkip={goNext} />;
      case WizardStep.PLAN:
        return <PlanStep onSubmit={goNext} onSkip={goNext} />;
      case WizardStep.DEPARTMENTS:
        return <DepartmentsStep onSubmit={goNext} onSkip={goNext} />;
      case WizardStep.TEAM:
        return <TeamStep onSubmit={goNext} onSkip={goNext} />;
      case WizardStep.INTEGRATIONS:
        return <IntegrationsStep onSubmit={goNext} onSkip={goNext} />;
      case WizardStep.AGENTS:
        return <AgentsStep onSubmit={goNext} onSkip={goNext} />;
      case WizardStep.SECURITY:
        return <SecurityStep onSubmit={goNext} onSkip={goNext} />;
      case WizardStep.REVIEW:
        return (
          <ReviewStep
            onSubmit={handleComplete}
            onBack={goPrev}
            isCompleting={completing}
          />
        );
      default:
        return null;
    }
  }

  const stepIndex = ACTIVE_STEPS.indexOf(currentStep as WizardStep);
  const safeStepIndex = stepIndex >= 0 ? stepIndex : 0;

  if (!_hasHydrated || (!wizardId && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07070a]">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070a] flex flex-col">
      {/* Thin top bar */}
      <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-6">
        <span className="text-sm font-bold tracking-tight">
          <span className="text-violet-400">Neure</span>Core
          <span className="text-zinc-500 font-normal ml-2">· Setup</span>
        </span>
        <button
          onClick={() => {
            resetWizard();
            router.replace("/login");
          }}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Exit
        </button>
      </div>

      <div className="flex-1 flex">
        {/* Left step list */}
        <div className="w-52 border-r border-zinc-800 bg-zinc-900/40 p-4 flex-shrink-0 hidden md:flex flex-col gap-1 pt-8">
          {ACTIVE_STEPS.map((step, idx) => {
            const done = idx < safeStepIndex;
            const active = idx === safeStepIndex;
            return (
              <div
                key={step}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm ${
                  active
                    ? "bg-violet-600/20 text-violet-300"
                    : done
                      ? "text-zinc-400"
                      : "text-zinc-600"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <span
                    className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${active ? "border-violet-500 text-violet-400" : "border-zinc-700 text-zinc-600"}`}
                  >
                    {idx + 1}
                  </span>
                )}
                <span className="truncate">{STEP_LABELS[step]}</span>
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="flex-1 flex flex-col items-center justify-start py-10 px-4 overflow-auto">
          {/* Step indicator mobile */}
          <div className="flex items-center gap-1.5 mb-8 md:hidden">
            {ACTIVE_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-1 rounded-full transition-all ${idx === safeStepIndex ? "w-6 bg-violet-500" : idx < safeStepIndex ? "w-3 bg-green-500" : "w-3 bg-zinc-700"}`}
              />
            ))}
          </div>

          <div className="w-full max-w-xl">
            {error && (
              <div className="mb-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-4 py-3">
                {error}
              </div>
            )}

            {renderStep(currentStep as WizardStep)}
          </div>
        </div>
      </div>
    </div>
  );
}
