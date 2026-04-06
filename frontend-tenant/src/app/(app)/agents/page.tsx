"use client";
// ─── agents/page.tsx ──────────────────────────────────────────────────────────
// SRP: Composes agent list view — layout only. Data via useAgentData().
// OCP: Adding filters or columns is done in AgentFilter/AgentGrid — not here.

import Link from "next/link";
import { Bot, Plus } from "lucide-react";
import { useState, useCallback } from "react";

import { useAgentData } from "@/shared/hooks/useAgentData";
import {
  AgentFilter,
  DEFAULT_AGENT_FILTERS,
  type AgentFilters as UIFilters,
} from "@/features/agents/components/AgentFilter";
import { AgentGrid } from "@/features/agents/components/AgentGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";
import type { AgentCardAction } from "@/types/ui.types";
import { useRouter } from "next/navigation";

export default function AgentsPage() {
  const router = useRouter();
  const [uiFilters, setUiFilters] = useState<UIFilters>(DEFAULT_AGENT_FILTERS);

  const { agents, total, loading, setFilters } = useAgentData({
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

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Agent Team"
        icon={<Bot className="w-4 h-4" />}
        subtitle={
          loading
            ? "Loading…"
            : `${total} deployed · ${agents.filter((a) => a.status === "RUNNING" || a.status === "IDLE").length} available`
        }
        actions={
          <Link
            href="/agents/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-brand text-brand-foreground text-caption font-medium hover:bg-brand-dim transition-colors duration-fast"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Hire Agent
          </Link>
        }
      />

      <PageContent className="flex flex-col gap-4">
        <AgentFilter filters={uiFilters} onChange={handleFilterChange} />
        <AgentGrid
          agents={agents}
          loading={loading}
          onAction={handleAgentAction}
        />
      </PageContent>
    </div>
  );
}
