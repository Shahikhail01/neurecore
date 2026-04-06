"use client";

import { useEffect, useState } from "react";
import { Link2, Plus, CheckCircle2, XCircle, Settings } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";

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
      <PageHeader
        title="Connectors"
        subtitle="Connect external tools your agents can use"
        icon={<Link2 className="w-4 h-4" />}
      />

      <PageContent>
        <div className="space-y-6">
          {connectors.length > 0 && (
            <div>
              <p className="text-micro font-semibold uppercase tracking-widest text-text-secondary mb-3">
                Active Connections
              </p>
              <div className="space-y-2">
                {connectors.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 px-4 py-3 bg-surface-raised border border-surface-border rounded-card"
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-dot",
                        c.status === "connected"
                          ? "bg-status-profit"
                          : c.status === "error"
                            ? "bg-status-risk"
                            : "bg-surface-muted",
                      )}
                    />
                    <p className="flex-1 text-sm font-medium text-text-primary capitalize">
                      {c.name}
                    </p>
                    {c.lastSync && (
                      <p className="text-micro text-text-secondary">
                        Synced {new Date(c.lastSync).toLocaleString()}
                      </p>
                    )}
                    <button className="text-text-secondary hover:text-text-primary transition-colors">
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-micro font-semibold uppercase tracking-widest text-text-secondary mb-3">
              Available Integrations
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {AVAILABLE.map((avail) => {
                const isConnected = connected.includes(avail.type);
                return (
                  <div
                    key={avail.type}
                    className={cn(
                      "bg-surface-raised border rounded-card p-4 transition-colors",
                      isConnected
                        ? "border-status-profit/30"
                        : "border-surface-border hover:border-brand/30 cursor-pointer",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{avail.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">
                          {avail.label}
                        </p>
                      </div>
                      {isConnected ? (
                        <CheckCircle2 className="w-4 h-4 text-status-profit flex-shrink-0" />
                      ) : (
                        <Plus className="w-4 h-4 text-text-secondary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-caption text-text-secondary">
                      {avail.desc}
                    </p>
                    {!isConnected && (
                      <button className="mt-3 w-full py-1.5 rounded-input border border-surface-border text-caption text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors">
                        Connect
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </PageContent>
    </div>
  );
}
