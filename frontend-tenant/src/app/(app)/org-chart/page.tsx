"use client";

import { useEffect, useState } from "react";
import { GitFork } from "lucide-react";
import api from "@/services/api";

interface OrgNode {
  id: string;
  name: string;
  role: string;
  type: "human" | "agent";
  children?: OrgNode[];
}

function OrgNodeCard({ node }: { node: OrgNode }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`rounded-lg border px-3 py-2 text-center w-36 ${node.type === "agent" ? "bg-violet-500/10 border-violet-500/30" : "bg-[var(--surface-raised)] border-[var(--surface-border)]"}`}
      >
        <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
          {node.name}
        </p>
        <p className="text-[10px] text-[var(--text-secondary)] truncate">
          {node.role}
        </p>
        {node.type === "agent" && (
          <span className="text-[9px] text-violet-400 font-medium">
            AI Agent
          </span>
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-px h-4 bg-[var(--surface-border)]" />
          <div className="flex gap-6 relative">
            {node.children.length > 1 && (
              <div className="absolute top-0 left-[calc(50%/var(--child-count,1))] right-[calc(50%/var(--child-count,1))] h-px bg-[var(--surface-border)]" />
            )}
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-[var(--surface-border)]" />
                <OrgNodeCard node={child} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const [root, setRoot] = useState<OrgNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/org-chart")
      .catch(() => ({ data: null }))
      .then((res) => {
        setRoot(res.data ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)]">
        <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <GitFork className="w-4 h-4 text-blue-400" /> Org Chart
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Visual hierarchy of your team and agents
        </p>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-36 h-12 rounded-lg bg-[var(--surface-overlay)] animate-pulse" />
          </div>
        ) : root ? (
          <div className="flex justify-center">
            <OrgNodeCard node={root} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <GitFork className="w-10 h-10 text-blue-500/20 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Org chart not configured
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Add departments and agents to build your hierarchy
            </p>
            <a
              href="/departments"
              className="mt-4 px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors"
            >
              Manage Departments
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
