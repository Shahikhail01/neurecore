"use client";

import { useParams } from "next/navigation";
import { NocoBaseShell } from "@/components/shell/NocoBaseShell";
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
  const slugParts = Array.isArray(params.slug) ? params.slug : [params.slug ?? ""];
  const section = slugParts[0] ?? "";
  const meta = PAGE_META[section];

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
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">{label}</h1>
            <p className="text-sm text-zinc-500 mt-0.5">{description}</p>
          </div>
        </div>

        {/* Content placeholder — will be replaced with NocoBase blocks */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800">
            <Construction className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-200">
              {label} — NocoBase Block
            </h2>
            <span className="ml-auto text-xs text-zinc-600">
              Phase 14 implementation
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
            <p className="text-xs text-zinc-600">
              Register a schema initializer and wire a{" "}
              <code className="text-zinc-500">BlockProvider</code> to activate.
            </p>
          </div>
        </div>
      </div>
    </NocoBaseShell>
  );
}
