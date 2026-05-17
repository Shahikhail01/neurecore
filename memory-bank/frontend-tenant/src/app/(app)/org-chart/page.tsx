"use client";
// ─── org-chart/page.tsx ───────────────────────────────────────────────────────
// SRP: Composes the org chart view — layout only.
// OCP: Sidebar and detail content are self-contained feature components.

import { useState } from "react";
import { GitFork, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { TwoColumnLayout } from "@/components/layout/TwoColumnLayout";
import { SectionCard } from "@/components/layout/SectionCard";
import { OrgChartSidebar } from "@/features/org-chart/components/OrgChartSidebar";
import { useOrgChart } from "@/features/org-chart/hooks/useOrgChart";

// ─── Department overview card ────────────────────────────────────────────────
function DeptOverviewCard({
  name,
  agentCount,
  activeCount,
}: {
  name: string;
  agentCount: number;
  activeCount: number;
}) {
  return (
    <div className="bg-surface-raised border border-surface-border rounded-card p-card hover:border-brand/30 transition-colors duration-fast">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-body font-semibold text-text-primary truncate">
            {name}
          </p>
          <p className="text-caption text-text-secondary mt-0.5">
            {agentCount} agent{agentCount !== 1 ? "s" : ""}
            {activeCount > 0 && (
              <span className="ml-2 text-status-profit">
                {activeCount} active
              </span>
            )}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-card bg-brand/10">
          <Users className="w-4 h-4 text-brand" aria-hidden="true" />
        </div>
      </div>

      {/* Agent capacity bar */}
      {agentCount > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-micro text-text-muted mb-1">
            <span>Capacity</span>
            <span>{Math.round((activeCount / agentCount) * 100)}% active</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full rounded-full bg-brand/60 transition-all duration-300"
              style={{ width: `${(activeCount / agentCount) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OrgChartPage() {
  const { tree, isLoading } = useOrgChart();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const leftPanel = (
    <OrgChartSidebar
      isOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
    />
  );

  const rightPanel = (
    <div className="flex flex-col h-full overflow-auto p-4 gap-4">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-card bg-surface-overlay animate-pulse"
            />
          ))}
        </div>
      ) : tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <GitFork
            className="w-10 h-10 text-brand/20 mb-3"
            aria-hidden="true"
          />
          <p className="text-body font-medium text-text-secondary">
            No departments yet
          </p>
          <p className="text-caption text-text-secondary mt-1">
            Add departments and agents to build your hierarchy
          </p>
          <Link
            href="/departments"
            className="mt-4 px-4 py-2 rounded-input bg-brand hover:bg-brand-dim text-caption text-brand-foreground font-medium transition-colors duration-fast"
          >
            Manage Departments
          </Link>
        </div>
      ) : (
        <SectionCard title="Departments">
          <div className="grid grid-cols-1 gap-3 p-card">
            {tree.map((dept) => {
              const activeCount = (dept.children ?? []).filter(
                (a) => a.status === "ACTIVE",
              ).length;
              return (
                <DeptOverviewCard
                  key={dept.id}
                  name={dept.name}
                  agentCount={dept.children?.length ?? 0}
                  activeCount={activeCount}
                />
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Org Chart"
        icon={<GitFork className="w-4 h-4" />}
        subtitle="Visual hierarchy of your team and agents"
        actions={
          !sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-input border border-surface-border text-caption text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors duration-fast"
              aria-label="Show org chart sidebar"
            >
              <GitFork className="w-3.5 h-3.5" />
              Show Tree
            </button>
          )
        }
      />

      <div className="flex-1 overflow-hidden">
        <TwoColumnLayout
          left={leftPanel}
          right={rightPanel}
          rightWidth="flex-1"
        />
      </div>
    </div>
  );
}
