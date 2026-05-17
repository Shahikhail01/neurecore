"use client";

import { useState } from "react";
import { useOnboardingStore } from "@/stores/onboardingStore";
import {
  INTEGRATION_TYPE_OPTIONS,
  ProvisioningProvider,
  EmailPattern,
  FolderStructure,
} from "@/types/onboarding.types";
import type { WorkspaceProvisioningConfig } from "@/types/onboarding.types";

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

const STORAGE_TRIGGERS = ["STORAGE_GOOGLE_DRIVE", "STORAGE_ONEDRIVE"];

const DEFAULT_WP_CONFIG: WorkspaceProvisioningConfig = {
  enabled: false,
  provider: ProvisioningProvider.GOOGLE_WORKSPACE,
  emailDomain: "",
  emailPattern: EmailPattern.FIRST_DOT_LAST,
  folderStructure: FolderStructure.BY_DEPARTMENT,
};

export function IntegrationsStep({ onSubmit, onSkip }: IntegrationsStepProps) {
  const { setIntegrationsData, setWorkspaceProvisioningData } =
    useOnboardingStore();

  const [selected, setSelected] = useState<string[]>([]);
  const [wpConfig, setWpConfig] =
    useState<WorkspaceProvisioningConfig>(DEFAULT_WP_CONFIG);
  const [isLoading, setIsLoading] = useState(false);

  const showWorkspacePanel = selected.some((v) => STORAGE_TRIGGERS.includes(v));

  const toggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
    // Auto-detect provider when a storage option is selected
    if (value === "STORAGE_GOOGLE_DRIVE" && !selected.includes(value)) {
      setWpConfig((prev) => ({
        ...prev,
        provider: ProvisioningProvider.GOOGLE_WORKSPACE,
      }));
    } else if (value === "STORAGE_ONEDRIVE" && !selected.includes(value)) {
      setWpConfig((prev) => ({
        ...prev,
        provider: ProvisioningProvider.MICROSOFT_365,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      setIntegrationsData(selected);
      if (showWorkspacePanel && wpConfig.enabled) {
        setWorkspaceProvisioningData(wpConfig);
      }
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
        {/* ── Integration grid ──────────────────────────────────────────── */}
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

        {/* ── Workspace provisioning panel ──────────────────────────────── */}
        {showWorkspacePanel && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-900/10 p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-sm font-semibold text-amber-300">
                  Workspace Auto-Provisioning
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Automatically create corporate email addresses and cloud
                  storage folders for your invited team members.
                </p>
              </div>
              {/* Toggle */}
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={wpConfig.enabled}
                  onChange={(e) =>
                    setWpConfig((p) => ({ ...p, enabled: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-700 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>

            {wpConfig.enabled && (
              <div className="space-y-4">
                {/* Provider */}
                <div>
                  <p className="text-xs font-medium text-zinc-300 mb-2">
                    Workspace Provider
                  </p>
                  <div className="flex gap-3">
                    {(
                      [
                        {
                          value: ProvisioningProvider.GOOGLE_WORKSPACE,
                          label: "Google Workspace",
                          icon: "🅶",
                        },
                        {
                          value: ProvisioningProvider.MICROSOFT_365,
                          label: "Microsoft 365",
                          icon: "Ⓜ",
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setWpConfig((p) => ({ ...p, provider: opt.value }))
                        }
                        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
                          wpConfig.provider === opt.value
                            ? "border-amber-500/60 bg-amber-900/30 text-amber-300"
                            : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        <span>{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email domain */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Corporate Email Domain
                  </label>
                  <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 overflow-hidden">
                    <span className="px-3 text-zinc-500 text-sm select-none">
                      @
                    </span>
                    <input
                      type="text"
                      value={wpConfig.emailDomain}
                      onChange={(e) =>
                        setWpConfig((p) => ({
                          ...p,
                          emailDomain: e.target.value.toLowerCase(),
                        }))
                      }
                      placeholder="yourcompany.com"
                      className="flex-1 bg-transparent pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Email pattern */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-2">
                    Email Pattern
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        {
                          value: EmailPattern.FIRST_DOT_LAST,
                          label: "john.doe",
                        },
                        { value: EmailPattern.FIRSTLAST, label: "johndoe" },
                        { value: EmailPattern.F_DOT_LAST, label: "j.doe" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setWpConfig((p) => ({
                            ...p,
                            emailPattern: opt.value,
                          }))
                        }
                        className={`rounded-lg border px-3 py-1.5 text-xs font-mono transition ${
                          wpConfig.emailPattern === opt.value
                            ? "border-amber-500/60 bg-amber-900/30 text-amber-300"
                            : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        {opt.label}@…
                      </button>
                    ))}
                  </div>
                </div>

                {/* Folder structure */}
                <div>
                  <p className="text-xs font-medium text-zinc-300 mb-2">
                    Folder Structure
                  </p>
                  <div className="flex gap-3">
                    {(
                      [
                        {
                          value: FolderStructure.BY_DEPARTMENT,
                          label: "By Department",
                          sub: "Sales / John Doe",
                        },
                        {
                          value: FolderStructure.FLAT,
                          label: "Flat",
                          sub: "John Doe",
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setWpConfig((p) => ({
                            ...p,
                            folderStructure: opt.value,
                          }))
                        }
                        className={`flex-1 rounded-lg border p-3 text-left text-xs transition ${
                          wpConfig.folderStructure === opt.value
                            ? "border-amber-500/60 bg-amber-900/30"
                            : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-600"
                        }`}
                      >
                        <span
                          className={`font-medium ${wpConfig.folderStructure === opt.value ? "text-amber-300" : "text-zinc-300"}`}
                        >
                          {opt.label}
                        </span>
                        <p className="text-zinc-500 mt-0.5 font-mono">
                          {opt.sub}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-zinc-500 pt-1">
                  💡 You&apos;ll connect your admin account in{" "}
                  <span className="text-zinc-400">Settings → Workspace</span>{" "}
                  after completing the wizard.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Footer hint ───────────────────────────────────────────────── */}
        {selected.length > 0 && (
          <p className="text-xs text-zinc-500 mb-4">
            {selected.length} integration{selected.length > 1 ? "s" : ""}{" "}
            selected. Configure credentials in{" "}
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
