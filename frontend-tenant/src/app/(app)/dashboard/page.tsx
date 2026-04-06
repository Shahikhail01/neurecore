"use client";
// ─── dashboard/page.tsx ───────────────────────────────────────────────────────
// SRP: Composes dashboard feature components — owns only layout composition and
//      provisioning status fetch (not owned by useDashboardData).
// OCP: All data displayed here is controlled via feature components and hooks;
//      adding new dashboard sections never modifies this page.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useDashboardData } from "@/shared/hooks/useDashboardData";
import { workspaceProvisioningService } from "@/services/workspace-provisioning.service";
import type { ProvisioningStatusDto } from "@/types/onboarding.types";

import { DashboardHero } from "@/features/dashboard/components/DashboardHero";
import { DashboardKPIRow } from "@/features/dashboard/components/DashboardKPIRow";
import { ActiveAgentsGrid } from "@/features/dashboard/components/ActiveAgentsGrid";
import { UpcomingTasksList } from "@/features/dashboard/components/UpcomingTasksList";
import { RecentActivityFeed } from "@/features/dashboard/components/RecentActivityFeed";
import { WorkspaceProvisioningBanner } from "@/components/dashboard/WorkspaceProvisioningBanner";
import { SectionCard } from "@/components/layout/SectionCard";

export default function DashboardPage() {
  const { metrics, timeline, topAgents, pendingTasks, loading } =
    useDashboardData();

  // Provisioning status is not part of useDashboardData — fetched independently
  const [provStatus, setProvStatus] = useState<ProvisioningStatusDto | null>(
    null,
  );
  useEffect(() => {
    workspaceProvisioningService
      .getStatus()
      .then(setProvStatus)
      .catch(() => null);
  }, []);

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <DashboardHero metrics={metrics} loading={loading} />

      <div className="flex-1 p-page space-y-6">
        {/* Workspace provisioning banner — only shows when pending */}
        <WorkspaceProvisioningBanner status={provStatus} />

        {/* ── KPI strip ────────────────────────────────────────── */}
        <DashboardKPIRow metrics={metrics} loading={loading} />

        {/* ── 2/3 + 1/3 grid ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity feed (wider) */}
          <div className="lg:col-span-2">
            <SectionCard
              title="Recent Activity"
              action={
                <Link
                  href="/activity"
                  className="flex items-center gap-0.5 text-micro text-brand hover:underline"
                >
                  View all{" "}
                  <ChevronRight className="w-3 h-3" aria-hidden="true" />
                </Link>
              }
              bodyClassName="p-4"
            >
              <RecentActivityFeed timeline={timeline} loading={loading} />
            </SectionCard>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            <SectionCard
              title="Active Agents"
              action={
                <Link
                  href="/agents"
                  className="flex items-center gap-0.5 text-micro text-brand hover:underline"
                >
                  Manage <ChevronRight className="w-3 h-3" aria-hidden="true" />
                </Link>
              }
              bodyClassName="p-4"
            >
              <ActiveAgentsGrid agents={topAgents} loading={loading} />
            </SectionCard>

            <SectionCard
              title="Upcoming Tasks"
              action={
                <Link
                  href="/tasks"
                  className="flex items-center gap-0.5 text-micro text-brand hover:underline"
                >
                  All tasks{" "}
                  <ChevronRight className="w-3 h-3" aria-hidden="true" />
                </Link>
              }
              bodyClassName="p-4"
            >
              <UpcomingTasksList tasks={pendingTasks} loading={loading} />
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
