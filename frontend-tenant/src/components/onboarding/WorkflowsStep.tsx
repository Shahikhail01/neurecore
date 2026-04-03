"use client";

import { useOnboardingStore } from "@/stores/onboardingStore";

interface WorkflowsStepProps {
  onSubmit?: (data: unknown) => void;
  onSkip?: () => void;
}

export function WorkflowsStep({ onSubmit, onSkip }: WorkflowsStepProps) {
  const { setAgentsData } = useOnboardingStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAgentsData([]);
    onSkip?.();
  };

  return (
    <div className="bg-white rounded-lg shadow p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Configure Workflows
        </h2>
        <p className="text-gray-600">Set up your first workflow (optional)</p>
      </div>

      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-purple-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>
        <p className="text-gray-500">Workflows can be configured after setup</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={onSkip}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Skip
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
