"use client";

import { useParams } from "next/navigation";
import { useState, useCallback } from "react";
import Link from "next/link";
import { NocoBaseShell } from "@/components/shell/NocoBaseShell";
import { useAgentData } from "@/shared/hooks/useAgentData";
import {
  AgentFilter,
  DEFAULT_AGENT_FILTERS,
  type AgentFilters as UIFilters,
} from "@/features/agents/components/AgentFilter";
import { AgentGrid } from "@/features/agents/components/AgentGrid";
import { useRouter } from "next/navigation";
import type { AgentCardAction } from "@/types/ui.types";
import {
  Users,
  GitBranch,
  CheckSquare,
  BarChart3,
  Building2,
  Target,
  Bell,
  Plug,
  Settings,
  Construction,
  ExternalLink,
} from "lucide-react";

const PAGE_META: Record<
  string,
  { label: string; description: string; Icon: React.FC<{ className?: string }> }
> = {
  agents: {
    label: "Agents",
    description: "Deploy and manage AI agents.",
    Icon: Users,
  },
  workflows: {
    label: "Workflows",
    description: "Build multi-step automated pipelines.",
    Icon: GitBranch,
  },
  departments: {
    label: "Departments",
    description: "Manage your virtual org structure.",
    Icon: Building2,
  },
  tasks: {
    label: "Tasks",
    description: "Track and delegate tasks across agents.",
    Icon: CheckSquare,
  },
  goals: {
    label: "Goals",
    description: "Set and monitor strategic objectives.",
    Icon: Target,
  },
  analytics: {
    label: "Analytics",
    description: "Real-time KPIs and performance telemetry.",
    Icon: BarChart3,
  },
  approvals: {
    label: "Approvals",
    description: "Human-in-the-loop approval gates.",
    Icon: Bell,
  },
  connectors: {
    label: "Connectors",
    description: "Connect to external tools and APIs.",
    Icon: Plug,
  },
  settings: {
    label: "Settings",
    description: "Configure workspace and agent settings.",
    Icon: Settings,
  },
};

export default function NocoBaseUISubPage() {
  const params = useParams();
  const router = useRouter();
  const slugParts = Array.isArray(params.slug)
    ? params.slug
    : [params.slug ?? ""];
  const section = slugParts[0] ?? "";
  const meta = PAGE_META[section];

  // Agents-specific state (only used when section === "agents")
  const [uiFilters, setUiFilters] = useState<UIFilters>(DEFAULT_AGENT_FILTERS);
  const {
    agents,
    total,
    loading: agentsLoading,
    setFilters,
  } = useAgentData({
    status: uiFilters.status || undefined,
    departmentId: uiFilters.departmentId || undefined,
    search: uiFilters.search || undefined,
    page: 1,
    limit: 40,
  });

  const handleFilterChange = useCallback(
    (patch: Partial<UIFilters>) => {
      const next = { ...uiFilters, ...patch };
      setUiFilters(next);
      setFilters({
        status: next.status || undefined,
        departmentId: next.departmentId || undefined,
        search: next.search || undefined,
      });
    },
    [uiFilters, setFilters],
  );

  const handleAgentAction = useCallback(
    (action: AgentCardAction, agentId: string) => {
      if (action === "inspect") {
        router.push(`/agents/${agentId}`);
      }
    },
    [router],
  );

  if (!meta) {
    return (
      <NocoBaseShell>
        <div className="p-6 flex items-center justify-center h-full">
          <p className="text-zinc-500 text-sm">Page not found: /{section}</p>
        </div>
      </NocoBaseShell>
    );
  }

  const { label, description, Icon } = meta;

  return (
    <NocoBaseShell>
      <div className="p-6 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">{label}</h1>
              <p className="text-sm text-zinc-500 mt-0.5">{description}</p>
            </div>
          </div>
          {section !== "agents" && (
            <Link
              href={`/${section}`}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 rounded-lg px-3 py-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Legacy view
            </Link>
          )}
        </div>

        {/* Agents section — real data wired */}
        {section === "agents" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <AgentFilter
                filters={uiFilters}
                onFilterChange={handleFilterChange}
              />
              <span className="text-xs text-zinc-500">
                {agentsLoading
                  ? "Loading…"
                  : `${total} agent${total !== 1 ? "s" : ""}`}
              </span>
            </div>
            <AgentGrid
              agents={agents}
              loading={agentsLoading}
              onAction={handleAgentAction}
            />
          </div>
        )}

        {/* All other sections — construction placeholder with legacy link */}
        {section !== "agents" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800">
              <Construction className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-zinc-200">
                {label} — NocoBase Block
              </h2>
              <span className="ml-auto text-xs text-zinc-600">
                Coming in Phase 15
              </span>
            </div>

            <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
              <Construction className="w-8 h-8 text-zinc-700" />
              <p className="text-sm text-zinc-400 max-w-sm">
                This section will render a NocoBase{" "}
                <code className="text-violet-400">SchemaComponent</code> block
                connected to the{" "}
                <code className="text-violet-400">{section}</code> collection.
              </p>
              <Link
                href={`/${section}`}
                className="mt-1 flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open {label} in legacy view
              </Link>
            </div>
          </div>
        )}
      </div>
    </NocoBaseShell>
  );
}
