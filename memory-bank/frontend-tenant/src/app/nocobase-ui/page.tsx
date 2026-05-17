"use client";

import { useState } from "react";
import Link from "next/link";
import { NocoBaseShell } from "@/components/shell/NocoBaseShell";
import { useAuthStore } from "@/stores/authStore";
import { useSchemaInitializer } from "@/schema-initializer";
import { useDashboardData } from "@/shared/hooks/useDashboardData";
import { ActiveAgentsGrid } from "@/features/dashboard/components/ActiveAgentsGrid";
import { RecentActivityFeed } from "@/features/dashboard/components/RecentActivityFeed";
import {
  Users,
  GitBranch,
  CheckSquare,
  Zap,
  TrendingUp,
  Bell,
  Activity,
  ChevronRight,
} from "lucide-react";

export default function NocoBaseUIDashboard() {
  const { user } = useAuthStore();
  const { getAll } = useSchemaInitializer();
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const { metrics, timeline, topAgents, loading } = useDashboardData();

  const registeredInitializers = Object.keys(getAll());

  const kpiCards = [
    {
      label: "Active Agents",
      value: loading ? "—" : String(metrics?.activeAgents ?? "—"),
      Icon: Users,
    },
    {
      label: "Active Workflows",
      value: loading ? "—" : String(metrics?.activeWorkflows ?? "—"),
      Icon: GitBranch,
    },
    {
      label: "Pending Tasks",
      value: loading ? "—" : String(metrics?.tasksPending ?? "—"),
      Icon: CheckSquare,
    },
    {
      label: "Actions Today",
      value: loading ? "—" : String(metrics?.tasksCompletedToday ?? "—"),
      Icon: Activity,
    },
  ];

  return (
    <NocoBaseShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              NeureCore · New UI{" "}
              <span className="text-emerald-400 font-medium">
                (NocoBase Integration)
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-1.5">
            <Zap className="w-3.5 h-3.5" />
            Schema engine active ·{" "}
            <span className="font-medium">
              {registeredInitializers.length} initializers
            </span>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiCards.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500 truncate">{label}</p>
                {loading ? (
                  <div className="h-5 mt-1 w-10 rounded bg-zinc-800 animate-pulse" />
                ) : (
                  <p className="text-lg font-semibold text-zinc-100 mt-0.5">
                    {value}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agents block — 2/3 width */}
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-zinc-200">
                  Active Agents
                </h2>
              </div>
              <Link
                href="/nocobase-ui/agents"
                className="flex items-center gap-0.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Manage <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4">
              <ActiveAgentsGrid agents={topAgents} loading={loading} />
            </div>
          </div>

          {/* Schema Initializer panel — 1/3 width */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-zinc-200">
                Schema Registry
              </h2>
            </div>
            <div className="p-4 space-y-2">
              {registeredInitializers.length > 0 ? (
                registeredInitializers.map((name) => (
                  <button
                    key={name}
                    onClick={() =>
                      setExpandedBlock(expandedBlock === name ? null : name)
                    }
                    className={`w-full text-left text-xs px-3 py-2 rounded-md border transition-colors ${
                      expandedBlock === name
                        ? "border-violet-500 bg-violet-500/10 text-violet-300"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {name}
                  </button>
                ))
              ) : (
                <p className="text-xs text-zinc-600 px-1">
                  No initializers registered yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-200">
                Recent Activity
              </h2>
            </div>
            <Link
              href="/activity"
              className="flex items-center gap-0.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4">
            <RecentActivityFeed timeline={timeline} loading={loading} />
          </div>
        </div>
      </div>
    </NocoBaseShell>
  );
}
