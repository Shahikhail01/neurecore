"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { onboardingApi } from "@/services/onboarding.service";
import { useOnboardingStore } from "@/stores/onboardingStore";
import {
  AgentAutonomyLevel,
  type AgentTemplateDto,
} from "@/types/onboarding.types";

interface AgentsStepProps {
  onSubmit?: (data: unknown) => void;
  onSkip?: () => void;
}

// Emoji icons mapped to agent roles for display
const ROLE_ICONS: Record<string, string> = {
  default: "🤖",
  assistant: "🗂️",
  sales: "📈",
  support: "💬",
  finance: "💰",
  hr: "🤝",
  marketing: "📣",
  legal: "⚖️",
  operations: "⚙️",
  analyst: "📊",
  engineer: "👨‍💻",
};

function getIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(ROLE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return ROLE_ICONS.default;
}

export function AgentsStep({ onSubmit, onSkip }: AgentsStepProps) {
  const { wizardId, tiers, departments, wizardData, setAgentsData } =
    useOnboardingStore();
  const [templates, setTemplates] = useState<AgentTemplateDto[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Detect plan tier for maxAgents limit
  const selectedTierId = wizardData?.plan?.tierId;
  const selectedTier = tiers.find((t) => t.id === selectedTierId);
  const maxAgents =
    selectedTier?.maxAgents && selectedTier.maxAgents !== -1
      ? selectedTier.maxAgents
      : 8;
  const tierName = selectedTier?.name ?? "Starter";

  // First department ID available (for optional departmentId assignment)
  const defaultDeptId = departments?.[0]?.id;

  // Fetch real agent templates on mount
  useEffect(() => {
    onboardingApi
      .getAgentTemplates()
      .then((res) => setTemplates(res.templates.slice(0, maxAgents)))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, [maxAgents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizardId) {
      setError("Wizard session not found. Please refresh.");
      return;
    }
    if (templates.length === 0) {
      // No templates — skip gracefully
      onSkip?.();
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const agents = templates.map((t) => ({
        templateId: t.id,
        name: t.name,
        departmentId: defaultDeptId,
        autonomyLevel: AgentAutonomyLevel.RECOMMEND,
      }));

      const result = await onboardingApi.configureAgents({ wizardId, agents });

      // Store the deployed agent data in wizard store
      setAgentsData(
        agents.map((a) => ({
          templateId: a.templateId,
          name: a.name,
          departmentId: a.departmentId,
          autonomyLevel: a.autonomyLevel,
        })),
      );

      onSubmit?.(result.agents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deploy agents");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTemplates) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 max-w-2xl mx-auto flex items-center justify-center min-h-[260px]">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
          <span className="text-sm">Loading your AI team…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-1">
          Deploy Your AI Team
        </h2>
        <p className="text-sm text-zinc-400">
          Your <span className="text-violet-400 font-medium">{tierName}</span>{" "}
          plan includes up to{" "}
          <span className="text-white font-medium">{maxAgents}</span> AI agents.
          The team below will be activated when you launch.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-6 text-center text-sm text-zinc-500 mb-6">
          No agent templates available. You can add agents from your dashboard
          after setup.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-violet-700/30 bg-violet-900/20 p-3 flex flex-col gap-1.5"
            >
              <div className="text-2xl">{getIcon(t.name)}</div>
              <div className="text-sm font-semibold text-zinc-100 truncate">
                {t.name}
              </div>
              <div className="text-xs text-zinc-400 line-clamp-2">
                {t.description || "AI Agent"}
              </div>
            </div>
          ))}
        </div>
      )}

      {departments.length > 0 && (
        <p className="text-xs text-zinc-500 mb-4">
          Agents will be assigned to{" "}
          <span className="text-zinc-300">{departments[0].name}</span>. You can
          reassign them from the dashboard.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 mb-4">
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

      <form onSubmit={handleSubmit}>
        <div className="flex justify-between pt-2">
          <button
            type="button"
            onClick={onSkip}
            disabled={submitting}
            className="px-5 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-sm text-zinc-300 hover:bg-zinc-700 transition disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            type="submit"
            disabled={submitting || templates.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-violet-600 text-sm font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-900/40 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Deploying…
              </>
            ) : (
              "Deploy Team →"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
