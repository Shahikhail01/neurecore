"use client";

import { useEffect, useState } from "react";
import { Compass, Plus, Lightbulb } from "lucide-react";
import api from "@/services/api";

interface StrategyItem {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  horizon: string;
}
const HORIZONS = ["Now", "Next", "Later"];

export default function StrategyPage() {
  const [items, setItems] = useState<StrategyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/strategy")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setItems(res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const grouped = HORIZONS.reduce<Record<string, StrategyItem[]>>((acc, h) => {
    acc[h] = items.filter((i) => i.horizon === h.toLowerCase());
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Compass className="w-4 h-4 text-violet-400" /> Strategy
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Direction and key initiatives for your AI workforce
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Initiative
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-5">
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {HORIZONS.map((h) => (
              <div
                key={h}
                className="h-48 rounded-xl bg-[var(--surface-overlay)] animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Lightbulb className="w-10 h-10 text-violet-500/20 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              No strategic initiatives yet
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Plan your Now / Next / Later horizons
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {HORIZONS.map((horizon, idx) => (
              <div
                key={horizon}
                className="bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-xl p-4"
              >
                <h3
                  className={`text-xs font-semibold uppercase tracking-widest mb-3 ${["text-green-400", "text-blue-400", "text-zinc-400"][idx]}`}
                >
                  {horizon}
                </h3>
                {grouped[horizon].length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    Nothing planned
                  </p>
                ) : (
                  <div className="space-y-2">
                    {grouped[horizon].map((item) => (
                      <div
                        key={item.id}
                        className="bg-[var(--surface-overlay)] rounded-lg p-2.5 hover:border-violet-500/20 border border-transparent transition-colors"
                      >
                        <p className="text-xs font-medium text-[var(--text-primary)]">
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-[10px] text-[var(--text-secondary)] mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
