"use client";

import { useEffect, useState } from "react";
import { Compass, Plus, Lightbulb } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";
import { SectionCard } from "@/components/layout/SectionCard";
import { ScenarioSimulator } from "@/features/strategy/components/ScenarioSimulator";

interface StrategyItem {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  horizon: string;
}

const HORIZONS = [
  {
    key: "now",
    label: "Now",
    color: "text-status-profit",
    border: "border-status-profit/40",
  },
  {
    key: "next",
    label: "Next",
    color: "text-status-ops",
    border: "border-status-ops/40",
  },
  {
    key: "later",
    label: "Later",
    color: "text-text-secondary",
    border: "border-surface-border",
  },
] as const;

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-status-risk",
  medium: "bg-status-warn",
  low: "bg-status-profit",
};

export default function StrategyPage() {
  const [items, setItems] = useState<StrategyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/strategy")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setItems(res.data?.data?.data ?? res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const grouped = HORIZONS.reduce<Record<string, StrategyItem[]>>((acc, h) => {
    acc[h.key] = items.filter((i) => i.horizon?.toLowerCase() === h.key);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Strategy"
        icon={<Compass className="w-4 h-4" />}
        subtitle="Direction and key initiatives for your AI workforce"
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-brand hover:bg-brand-dim text-brand-foreground text-caption font-medium transition-colors duration-fast">
            <Plus className="w-3.5 h-3.5" /> Add Initiative
          </button>
        }
      />

      <PageContent className="flex flex-col gap-6">
        {/* ── Kanban board ───────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {HORIZONS.map((h) => (
              <div key={h.key} className="space-y-3">
                <div className="h-6 w-16 rounded-input bg-surface-overlay animate-pulse" />
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 rounded-card bg-surface-overlay animate-pulse"
                  />
                ))}
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Lightbulb className="w-10 h-10 text-brand/20 mb-3" />
            <p className="text-body font-medium text-text-secondary">
              No strategic initiatives yet
            </p>
            <p className="text-caption text-text-secondary mt-1">
              Plan your Now / Next / Later horizons
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {HORIZONS.map((horizon) => {
              const col = grouped[horizon.key] ?? [];
              return (
                <div key={horizon.key}>
                  {/* Column header */}
                  <div
                    className={cn(
                      "flex items-center gap-2 mb-3 pb-2 border-b-2",
                      horizon.border,
                    )}
                  >
                    <span
                      className={cn(
                        "text-caption font-semibold uppercase tracking-widest",
                        horizon.color,
                      )}
                    >
                      {horizon.label}
                    </span>
                    <span className="text-micro text-text-muted bg-surface-overlay px-1.5 py-0.5 rounded-pill">
                      {col.length}
                    </span>
                  </div>

                  {/* Cards */}
                  {col.length === 0 ? (
                    <p className="text-caption text-text-secondary italic px-1">
                      Nothing planned
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {col.map((item) => (
                        <div
                          key={item.id}
                          className="bg-surface-raised border border-surface-border rounded-card p-card hover:border-brand/30 transition-colors duration-fast cursor-pointer group"
                        >
                          <div className="flex items-start gap-2">
                            {/* Priority dot */}
                            {item.priority && (
                              <span
                                className={cn(
                                  "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                                  PRIORITY_DOT[item.priority] ??
                                    "bg-surface-muted",
                                )}
                                title={item.priority}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-body font-medium text-text-primary leading-snug">
                                {item.title}
                              </p>
                              {item.description && (
                                <p className="text-caption text-text-secondary mt-1 line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Scenario Simulator ───────────────────────────────────────────── */}
        <SectionCard title="What-If Scenario Simulator">
          <ScenarioSimulator />
        </SectionCard>
      </PageContent>
    </div>
  );
}
