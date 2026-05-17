'use client';
// ─── Agent Inspector ──────────────────────────────────────────────────────────
// S — Single Responsibility: renders full agent profile in inspector panel only
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { STATUS_BADGE_CLASS, STATUS_COLOR_MAP } from '@/types/ui.types';
import api from '@/services/api';
import { unwrapItem } from '@/services/unwrap';

interface AgentDetail {
  id: string;
  name: string;
  type: string;
  status: string;
  systemPrompt?: string;
  maxBudget?: number;
  spentBudget?: number;
  maxExecutionTime?: number;
  successRate?: number;
  model?: { name: string; provider: string };
  department?: { name: string };
  tools?: { name: string }[];
  createdAt: string;
}

export function AgentInspector({ id }: { id: string }) {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/agents/${id}`)
      .then((r) => setAgent(unwrapItem(r)))
      .catch(() => setAgent(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-4 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 bg-surface-muted rounded" style={{ width: `${60 + i * 6}%` }} />
        ))}
      </div>
    );
  }

  if (!agent) {
    return <div className="p-6 text-zinc-500 text-sm">Agent not found.</div>;
  }

  const statusColor = STATUS_COLOR_MAP[agent.status] ?? 'neutral';
  const budgetPct = agent.maxBudget && agent.spentBudget
    ? Math.min(100, Math.round((agent.spentBudget / agent.maxBudget) * 100))
    : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 flex flex-col gap-5">
      {/* Identity */}
      <div>
        <h2 className="text-lg font-bold text-zinc-100">{agent.name}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-zinc-500">{agent.type}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_CLASS[statusColor]}`}>
            {agent.status}
          </span>
        </div>
        {agent.department && (
          <p className="text-xs text-zinc-600 mt-1">📁 {agent.department.name}</p>
        )}
      </div>

      {/* Model */}
      {agent.model && (
        <Row label="Model" value={`${agent.model.provider} / ${agent.model.name}`} />
      )}

      {/* Budget */}
      {agent.maxBudget !== undefined && (
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Budget Used</span>
            <span>${(agent.spentBudget ?? 0).toFixed(4)} / ${agent.maxBudget}</span>
          </div>
          {budgetPct !== null && (
            <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${budgetPct > 80 ? 'bg-status-risk' : budgetPct > 50 ? 'bg-status-warn' : 'bg-status-profit'}`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Performance */}
      {agent.successRate !== undefined && (
        <Row label="Success Rate" value={`${agent.successRate}%`} />
      )}

      {/* System prompt */}
      {agent.systemPrompt && (
        <div>
          <p className="text-xs text-zinc-500 mb-1">System Prompt</p>
          <p className="text-xs text-zinc-400 font-mono bg-surface p-3 rounded-lg border border-surface-border leading-relaxed line-clamp-4">
            {agent.systemPrompt}
          </p>
        </div>
      )}

      {/* Tools */}
      {agent.tools && agent.tools.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">Connected Tools</p>
          <div className="flex flex-wrap gap-1.5">
            {agent.tools.map((t) => (
              <span key={t.name} className="text-xs px-2 py-1 rounded bg-surface-muted text-zinc-300 border border-surface-border">
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <Row label="Created" value={new Date(agent.createdAt).toLocaleDateString()} />

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-surface-border">
        <button className="w-full py-2 text-sm rounded-xl bg-status-ops/10 hover:bg-status-ops/20 text-status-ops border border-status-ops/20 transition-colors font-medium">
          View Execution Logs
        </button>
        <button className="w-full py-2 text-sm rounded-xl bg-surface-muted hover:bg-surface-overlay text-zinc-300 border border-surface-border transition-colors">
          Edit Agent
        </button>
      </div>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-300 font-medium">{value}</span>
    </div>
  );
}
