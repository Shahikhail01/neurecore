"use client";

import { WizardStep } from "@/types/onboarding.types";

interface ProgressBarProps {
  currentStep: WizardStep;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const progress = ((currentStep - 1) / totalSteps) * 100;

  return (
    <div className="w-full bg-gray-200 h-2">
      <div
        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
