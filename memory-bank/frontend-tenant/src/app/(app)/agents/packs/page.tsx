"use client";

/**
 * Agent Packs Marketplace — Phase 3.4
 * Browse curated agent packs and install them to the tenant in one click.
 */

import { useEffect, useState } from "react";
import { Package, Check, Loader2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/services/api";

interface AgentPackDef {
  role: string;
  description: string;
  type: string;
}

interface AgentPack {
  id: string;
  name: string;
  description: string;
  category: string;
  agents: AgentPackDef[];
  tags: string[];
}

const CATEGORY_COLOURS: Record<string, string> = {
  sales: "border-emerald-500/30 bg-emerald-500/5",
  support: "border-blue-500/30 bg-blue-500/5",
  finance: "border-amber-500/30 bg-amber-500/5",
};

const CATEGORY_BADGE: Record<string, string> = {
  sales: "text-emerald-400 bg-emerald-500/10",
  support: "text-blue-400 bg-blue-500/10",
  finance: "text-amber-400 bg-amber-500/10",
};

export default function AgentPacksPage() {
  const router = useRouter();
  const [packs, setPacks] = useState<AgentPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/agent-templates/packs")
      .then((res) => {
        const data = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setPacks(Array.isArray(data) ? data : []);
      })
      .catch(() => setPacks([]))
      .finally(() => setLoading(false));
  }, []);

  const handleInstall = async (packId: string) => {
    if (installing) return;
    setInstalling(packId);
    setError("");
    try {
      await api.post(`/agent-templates/packs/${packId}/install`);
      setInstalled((prev) => new Set([...prev, packId]));
    } catch {
      setError(`Failed to install pack. Please try again.`);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto hide-scrollbar">
      <div className="max-w-4xl mx-auto px-5 py-8">
        {/* Header */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Package className="w-5 h-5 text-violet-400" /> Agent Packs
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Install curated multi-agent teams ready for your use case
            </p>
          </div>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {/* Pack grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-[var(--surface-overlay)] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packs.map((pack) => {
              const isInstalled = installed.has(pack.id);
              const isInstalling = installing === pack.id;
              const cardClass =
                CATEGORY_COLOURS[pack.category] ??
                "border-[var(--surface-border)] bg-[var(--surface-overlay)]";
              const badgeClass =
                CATEGORY_BADGE[pack.category] ?? "text-zinc-400 bg-zinc-500/10";

              return (
                <div
                  key={pack.id}
                  className={`rounded-xl border p-5 flex flex-col gap-3 ${cardClass}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                        {pack.name}
                      </h2>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded capitalize mt-1 inline-block ${badgeClass}`}
                      >
                        {pack.category}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {pack.agents.length} agents
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {pack.description}
                  </p>

                  {/* Agent list */}
                  <ul className="space-y-1">
                    {pack.agents.map((a) => (
                      <li
                        key={a.role}
                        className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
                      >
                        <span className="w-1 h-1 rounded-full bg-violet-400 flex-shrink-0" />
                        <span className="font-medium text-[var(--text-primary)]">
                          {a.role}
                        </span>
                        — {a.description}
                      </li>
                    ))}
                  </ul>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {pack.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-secondary)]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Install button */}
                  <button
                    onClick={() => handleInstall(pack.id)}
                    disabled={isInstalled || isInstalling}
                    className={`w-full py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      isInstalled
                        ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 cursor-default"
                        : "bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                    }`}
                  >
                    {isInstalling ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                        Installing…
                      </>
                    ) : isInstalled ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Installed
                      </>
                    ) : (
                      <>Install Pack</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
