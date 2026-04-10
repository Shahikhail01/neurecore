"use client";

import { useState } from "react";
import { NocoBaseShell } from "@/components/shell/NocoBaseShell";
import { useAuthStore } from "@/stores/authStore";
import { useSchemaInitializer } from "@/schema-initializer";
import {
  Users,
  GitBranch,
  CheckSquare,
  BarChart3,
  Zap,
  TrendingUp,
  Bell,
  Activity,
} from "lucide-react";

interface StatCard {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  Icon: React.FC<{ className?: string }>;
}

const STAT_CARDS: StatCard[] = [
  { label: "Active Agents", value: "—", delta: "", positive: true, Icon: Users },
  { label: "Workflows", value: "—", delta: "", positive: true, Icon: GitBranch },
  { label: "Open Tasks", value: "—", delta: "", positive: false, Icon: CheckSquare },
  { label: "Actions Today", value: "—", delta: "", positive: true, Icon: Activity },
];

export default function NocoBaseUIDashboard() {
  const { user } = useAuthStore();
  const { getAll } = useSchemaInitializer();
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  const registeredInitializers = Object.keys(getAll());

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
              <span className="text-emerald-400 font-medium">(NocoBase Integration)</span>
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
          {STAT_CARDS.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500 truncate">{label}</p>
                <p className="text-lg font-semibold text-zinc-100 mt-0.5">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* NocoBase Block Canvas */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-zinc-200">
                Block Canvas
              </h2>
            </div>
            <span className="text-xs text-zinc-500">
              Dynamic schema blocks will render here
            </span>
          </div>

          <div className="p-5">
            {/* Schema Initializer Status */}
            <div className="flex flex-wrap gap-2 mb-4">
              {registeredInitializers.length > 0 ? (
                registeredInitializers.map((name) => (
                  <button
                    key={name}
                    onClick={() =>
                      setExpandedBlock(expandedBlock === name ? null : name)
                    }
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      expandedBlock === name
                        ? "border-violet-500 bg-violet-500/10 text-violet-300"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {name}
                  </button>
                ))
              ) : (
                <p className="text-xs text-zinc-600">
                  No schema initializers registered yet. Register via{" "}
                  <code className="text-zinc-500">SchemaInitializerProvider</code>.
                </p>
              )}
            </div>

            {/* Placeholder blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { type: "table", label: "Agents Table", color: "violet" },
                { type: "form", label: "Quick Task Form", color: "emerald" },
                { type: "grid", label: "Analytics Grid", color: "sky" },
                { type: "details", label: "Active Workflow Details", color: "amber" },
              ].map(({ type, label, color }) => (
                <div
                  key={type}
                  className="border border-zinc-800 rounded-lg p-4 bg-zinc-800/30"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-zinc-400">
                      {label}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize
                      ${color === "violet" ? "border-violet-500/30 text-violet-400 bg-violet-500/10" : ""}
                      ${color === "emerald" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : ""}
                      ${color === "sky" ? "border-sky-500/30 text-sky-400 bg-sky-500/10" : ""}
                      ${color === "amber" ? "border-amber-500/30 text-amber-400 bg-amber-500/10" : ""}
                    `}
                    >
                      {type}
                    </span>
                  </div>
                  <div className="h-16 flex items-center justify-center border border-dashed border-zinc-700 rounded-md">
                    <span className="text-xs text-zinc-600">
                      Schema block · {type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity placeholder */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800">
            <Bell className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-200">
              Recent Activity
            </h2>
          </div>
          <div className="p-5 flex items-center justify-center h-24">
            <p className="text-xs text-zinc-600">
              Activity feed will populate via NocoBase data blocks.
            </p>
          </div>
        </div>
      </div>
    </NocoBaseShell>
  );
}
