"use client";

import { useState } from "react";
import { useOnboardingStore } from "@/stores/onboardingStore";

interface ReviewStepProps {
  onSubmit?: () => void;
  onBack?: () => void;
  isCompleting?: boolean;
}

export function ReviewStep({ onSubmit, onBack, isCompleting }: ReviewStepProps) {
  const { wizardData, isLoading } = useOnboardingStore();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setError("Please accept the terms and conditions");
      return;
    }
    onSubmit?.();
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 max-w-2xl mx-auto shadow-xl backdrop-blur-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">
          Review &amp; Launch
        </h2>
        <p className="text-sm text-zinc-400">
          Review your setup and launch your workspace
        </p>
      </div>

      <div className="space-y-3 mb-6">
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
            Organization
          </h3>
          <p className="text-sm font-medium text-white">
            {wizardData.company?.name || (
              <span className="text-zinc-500 font-normal">Not configured</span>
            )}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
            Admin
          </h3>
          <p className="text-sm font-medium text-white">
            {wizardData.admin?.firstName ? (
              `${wizardData.admin.firstName} ${wizardData.admin.lastName ?? ""}`.trim()
            ) : (
              <span className="text-zinc-500 font-normal">Not configured</span>
            )}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
            Plan
          </h3>
          <p className="text-sm font-medium text-white">
            {wizardData.plan?.tierId || (
              <span className="text-zinc-500 font-normal">Not selected</span>
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            id="terms"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-violet-600 focus:ring-violet-500/50 focus:ring-offset-0"
          />
          <span className="text-sm text-zinc-400">
            I agree to the Terms of Service and Privacy Policy
          </span>
        </label>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            {error}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-300"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isLoading || isCompleting}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:opacity-50"
          >
            {(isLoading || isCompleting) ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Creating…
              </>
            ) : (
              "🚀 Launch Workspace"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
