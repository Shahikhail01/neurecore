'use client';

/**
 * DelegationForm.tsx — 6-step task delegation wizard
 *
 * S: wizard shell + step dispatch; each step is an independent component
 * O: add a step = add entry to DELEGATION_STEPS + case in renderStep
 * D: data via useDelegation hook; no direct API calls here
 */

import { DELEGATION_STEPS }   from '@/types/delegation.types';
import { useDelegation }      from '@/hooks/useDelegation';
import { StepDescription }    from './StepDescription';
import { StepDepartment }     from './StepDepartment';
import { StepAgent }          from './StepAgent';
import { StepParameters }     from './StepParameters';
import { StepAuthority }      from './StepAuthority';
import { StepReview }         from './StepReview';

export function DelegationForm() {
  const {
    step,
    totalSteps,
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
  } = useDelegation();

  const renderStep = () => {
    switch (step) {
      case 1: return <StepDescription form={form} patch={patch} />;
      case 2: return <StepDepartment  form={form} patch={patch} />;
      case 3: return <StepAgent       form={form} patch={patch} />;
      case 4: return <StepParameters  form={form} patch={patch} />;
      case 5: return <StepAuthority   form={form} patch={patch} />;
      case 6: return <StepReview      form={form} />;
      default: return null;
    }
  };

  if (success) {
    return (
      <div className="min-h-[420px] flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-status-profit/20 border border-status-profit/40 flex items-center justify-center text-3xl">
          ✓
        </div>
        <div>
          <div className="text-lg font-semibold text-zinc-100">Task Delegated</div>
          <div className="text-sm text-zinc-500 mt-1">Redirecting to tasks…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress stepper */}
      <div className="flex items-center gap-0 mb-8">
        {DELEGATION_STEPS.map((s, i) => {
          const done    = step > s.id;
          const current = step === s.id;
          return (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition ${
                  done    ? 'bg-violet-600 text-white'  :
                  current ? 'bg-violet-500/20 border-2 border-violet-500 text-violet-300' :
                            'bg-surface-overlay border border-surface-border text-zinc-500'
                }`}
              >
                {done ? '✓' : s.id}
              </div>
              {i < DELEGATION_STEPS.length - 1 && (
                <div
                  className={`h-px flex-1 mx-1 transition ${
                    done ? 'bg-violet-600' : 'bg-surface-border'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step header */}
      <div className="mb-5">
        <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Step {step} of {totalSteps}
        </div>
        <h2 className="text-lg font-semibold text-zinc-100 mt-0.5">{currentStep.label}</h2>
        <p className="text-sm text-zinc-500">{currentStep.description}</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-status-risk/40 bg-status-risk/10 px-4 py-3 text-sm text-status-risk">
          {error}
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-4">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4 border-t border-surface-border mt-2">
        <button
          onClick={back}
          disabled={step === 1}
          className="flex-1 py-2.5 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 disabled:opacity-30 transition"
        >
          Back
        </button>

        {step < totalSteps ? (
          <button
            onClick={next}
            disabled={!canAdvance}
            className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-semibold text-white transition"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-semibold text-white transition"
          >
            {loading ? 'Delegating…' : 'Delegate Task'}
          </button>
        )}
      </div>
    </div>
  );
}
