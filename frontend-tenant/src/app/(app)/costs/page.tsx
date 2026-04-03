"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingDown, Calendar, Filter } from "lucide-react";
import api from "@/services/api";

interface CostEntry {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  agent?: string;
}

export default function CostsPage() {
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/costs")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setCosts(res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const total = costs.reduce((sum, c) => sum + (c.amount ?? 0), 0);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" /> Cost Tracker
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            AI token usage, subscriptions, and operational costs
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--text-secondary)]">
            Total this month
          </p>
          <p className="text-lg font-bold text-green-400">
            ${total.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 mx-4 my-2 rounded-md bg-[var(--surface-overlay)] animate-pulse"
            />
          ))
        ) : costs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <TrendingDown className="w-10 h-10 text-green-500/20 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              No costs tracked yet
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Costs accrue as your agents work
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-[var(--surface)] border-b border-[var(--surface-border)]">
              <tr>
                {["Description", "Category", "Agent", "Date", "Amount"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[var(--surface-border)] hover:bg-[var(--surface-raised)] transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)]">
                    {c.description}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)] capitalize">
                    {c.category}
                  </td>
                  <td className="px-4 py-3 text-xs text-violet-400">
                    {c.agent ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)] flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {c.date ? new Date(c.date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-green-400">
                    ${(c.amount ?? 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
