'use client';

/**
 * useDelegation.ts — Task Delegation wizard state + submission hook
 *
 * S: wizard navigation + API calls only
 * D: depends on delegationService abstraction
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { delegationService } from '@/services/delegation.service';
import { EMPTY_FORM, DELEGATION_STEPS } from '@/types/delegation.types';
import type { DelegationFormData, DelegationStep } from '@/types/delegation.types';

const TOTAL_STEPS = DELEGATION_STEPS.length;

export function useDelegation() {
  const router = useRouter();

  const [step, setStep]       = useState(1);
  const [form, setForm]       = useState<DelegationFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const currentStep: DelegationStep = DELEGATION_STEPS[step - 1];

  const patch = useCallback(
    (updates: Partial<DelegationFormData>) =>
      setForm((prev) => ({ ...prev, ...updates })),
    [],
  );

  const next = useCallback(async () => {
    // On step 5→6 estimate cost
    if (step === 5) {
      try {
        const cost = await delegationService.estimateCost(form);
        patch({ estimatedCost: cost });
      } catch { /* non-blocking */ }
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, [step, form, patch]);

  const back = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  const submit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await delegationService.delegateTask(form);
      setSuccess(true);
      setTimeout(() => router.push('/tasks'), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delegation failed');
    } finally {
      setLoading(false);
    }
  }, [form, router]);

  const canAdvance = (() => {
    switch (step) {
      case 1: return form.title.trim().length > 2 && form.description.trim().length > 5;
      case 2: return !!form.departmentId;
      case 3: return true; // agent is optional
      case 4: return true;
      case 5: return true;
      default: return true;
    }
  })();

  return {
    step,
    totalSteps: TOTAL_STEPS,
    currentStep,
    form,
    patch,
    next,
    back,
    submit,
    loading,
    error,
    success,
    canAdvance,
  };
}
