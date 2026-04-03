"use client";

import { useEffect, useState } from "react";
import { Link2, Plus, CheckCircle2, XCircle, Settings } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

interface Connector {
  id: string;
  name: string;
  type: string;
  status: "connected" | "disconnected" | "error";
  lastSync?: string;
}

const AVAILABLE = [
  {
    type: "slack",
    label: "Slack",
    icon: "💬",
    desc: "Team messaging + agent notifications",
  },
  {
    type: "notion",
    label: "Notion",
    icon: "📝",
    desc: "Knowledge base integration",
  },
  {
    type: "github",
    label: "GitHub",
    icon: "🐙",
    desc: "Code repos + pull request agent",
  },
  {
    type: "salesforce",
    label: "Salesforce",
    icon: "☁️",
    desc: "CRM + deal tracking",
  },
  {
    type: "stripe",
    label: "Stripe",
    icon: "💳",
    desc: "Payment processing + billing",
  },
  {
    type: "google",
    label: "Google Workspace",
    icon: "📊",
    desc: "Docs, Sheets, Calendar",
  },
];

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/connectors")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setConnectors(res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const connected = connectors.map((c) => c.type);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)]">
        <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Link2 className="w-4 h-4 text-blue-400" /> Connectors
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Connect external tools your agents can use
        </p>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-5 space-y-6">
        {connectors.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
              Active Connections
            </p>
            <div className="space-y-2">
              {connectors.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-3 bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-xl"
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      c.status === "connected"
                        ? "bg-green-500"
                        : c.status === "error"
                          ? "bg-red-500"
                          : "bg-zinc-500",
                    )}
                  />
                  <p className="flex-1 text-sm font-medium text-[var(--text-primary)] capitalize">
                    {c.name}
                  </p>
                  {c.lastSync && (
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      Synced {new Date(c.lastSync).toLocaleString()}
                    </p>
                  )}
                  <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
            Available Integrations
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {AVAILABLE.map((avail) => {
              const isConnected = connected.includes(avail.type);
              return (
                <div
                  key={avail.type}
                  className={cn(
                    "bg-[var(--surface-raised)] border rounded-xl p-4 transition-colors",
                    isConnected
                      ? "border-green-500/30"
                      : "border-[var(--surface-border)] hover:border-blue-500/30 cursor-pointer",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{avail.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {avail.label}
                      </p>
                    </div>
                    {isConnected ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : (
                      <Plus className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {avail.desc}
                  </p>
                  {!isConnected && (
                    <button className="mt-3 w-full py-1.5 rounded-md border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-blue-500/40 transition-colors">
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
