"use client";

import { useState } from "react";
import { onboardingApi } from "@/services/onboarding.service";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { DataResidency } from "@/types/onboarding.types";

interface SecurityStepProps {
  onSubmit?: (data: unknown) => void;
  onSkip?: () => void;
}

export function SecurityStep({ onSubmit, onSkip }: SecurityStepProps) {
  const { wizardId, setSecurityData } = useOnboardingStore();
  const [gdprConsent, setGdprConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [require2FA, setRequire2FA] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!wizardId) {
      setError("Wizard session not found. Please refresh and try again.");
      return;
    }

    if (!gdprConsent || !termsAccepted || !privacyAccepted) {
      setError("Please accept all required consents to continue.");
      return;
    }

    setIsLoading(true);
    try {
      const dto = {
        wizardId,
        dataResidency: DataResidency.US,
        gdprConsent,
        termsAccepted,
        privacyAccepted,
        auditRetentionDays: 365,
        require2FA,
      };
      await onboardingApi.updateSecurity(dto);
      setSecurityData(dto);
      onSubmit?.(dto);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save security settings",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const checkboxCls =
    "h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-violet-600 focus:ring-violet-500/50 focus:ring-offset-0";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 max-w-2xl mx-auto shadow-xl backdrop-blur-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">
          Security Settings
        </h2>
        <p className="text-sm text-zinc-400">
          Configure security settings (can be changed later)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-5 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={gdprConsent}
              onChange={(e) => setGdprConsent(e.target.checked)}
              className={checkboxCls}
            />
            <span className="text-sm text-zinc-300">
              <span className="font-medium text-white">GDPR Consent *</span> — I
              consent to the processing of personal data in accordance with
              GDPR.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className={checkboxCls}
            />
            <span className="text-sm text-zinc-300">
              <span className="font-medium text-white">Terms of Service *</span>{" "}
              — I accept the Terms of Service.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className={checkboxCls}
            />
            <span className="text-sm text-zinc-300">
              <span className="font-medium text-white">Privacy Policy *</span> —
              I have read and accept the Privacy Policy.
            </span>
          </label>
        </div>

        <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-5">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm text-zinc-300">
              <span className="font-medium text-white block">
                Require Two-Factor Authentication
              </span>
              <span className="text-zinc-500">
                Enforce 2FA for all team members
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={require2FA}
              onClick={() => setRequire2FA((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                require2FA ? "bg-violet-600" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                  require2FA ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>
        </div>

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
            onClick={onSkip}
            className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-300"
          >
            Skip
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:opacity-50"
          >
            {isLoading ? (
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
                Saving…
              </>
            ) : (
              "Continue →"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
