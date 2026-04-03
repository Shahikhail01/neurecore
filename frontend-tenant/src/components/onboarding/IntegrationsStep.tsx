"use client";

import { useState } from "react";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { INTEGRATION_TYPE_OPTIONS } from "@/types/onboarding.types";

interface IntegrationsStepProps {
  onSubmit?: (data: { integrations: string[] }) => void;
  onSkip?: () => void;
}

const INTEGRATION_ICONS: Record<string, string> = {
  CRM_SALESFORCE: "☁️",
  CRM_HUBSPOT: "🔶",
  CRM_PIPEDRIVE: "🟢",
  EMAIL_SMTP: "📧",
  EMAIL_GMAIL: "📩",
  CALENDAR_GOOGLE: "📅",
  CALENDAR_OFFICE365: "🗓️",
  STORAGE_GOOGLE_DRIVE: "🗂️",
  STORAGE_ONEDRIVE: "💾",
  COMMUNICATION_SLACK: "💬",
  COMMUNICATION_TEAMS: "🟦",
};

export function IntegrationsStep({ onSubmit, onSkip }: IntegrationsStepProps) {
  const { setIntegrationsData } = useOnboardingStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const toggle = (value: string) =>
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Store selections in wizard state — connectors are created when wizard completes
      setIntegrationsData(selected);
      onSubmit?.({ integrations: selected });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 max-w-3xl mx-auto shadow-xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-1">
          Connect Integrations
        </h2>
        <p className="text-sm text-zinc-400">
          Select tools you want to connect. Full configuration completes after
          setup.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-6">
          {INTEGRATION_TYPE_OPTIONS.slice(0, 9).map(
            (intg: { value: string; label: string; tier?: string }) => {
              const active = selected.includes(intg.value);
              return (
                <button
                  key={intg.value}
                  type="button"
                  onClick={() => toggle(intg.value)}
                  className={`relative rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-violet-500/60 bg-violet-900/30 ring-1 ring-violet-500/40"
                      : "border-zinc-700/50 bg-zinc-800/40 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-xl">
                      {INTEGRATION_ICONS[intg.value] ?? "🔌"}
                    </span>
                    <span className="text-sm font-medium text-zinc-100">
                      {intg.label}
                    </span>
                  </div>
                  {intg.tier && (
                    <span className="text-xs text-zinc-500">{intg.tier}</span>
                  )}
                  {active && (
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-violet-400" />
                  )}
                </button>
              );
            },
          )}
        </div>

        {selected.length > 0 && (
          <p className="text-xs text-zinc-500 mb-4">
            {selected.length} integration{selected.length > 1 ? "s" : ""}{" "}
            selected. You'll configure credentials in{" "}
            <span className="text-zinc-300">Settings → Integrations</span> after
            setup.
          </p>
        )}

        <div className="flex justify-between pt-2">
          <button
            type="button"
            onClick={onSkip}
            className="px-5 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition"
          >
            Skip
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:opacity-50"
          >
            {selected.length > 0
              ? `Continue with ${selected.length} integration${selected.length > 1 ? "s" : ""} →`
              : "Continue →"}
          </button>
        </div>
      </form>
    </div>
  );
}
