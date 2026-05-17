'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import api from '@/services/api';
import { unwrapArrayOrEmpty } from '@/services/unwrap';

// ReactFlow must be loaded client-side only (uses browser APIs)
const ReactFlowBuilder = dynamic(() => import('@/components/workflow/ReactFlowBuilder'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised flex items-center justify-center text-zinc-500 text-sm">
      Loading visual builder…
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface Workflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  steps?: unknown[];
  createdAt: string;
  updatedAt: string;
  _count?: { executions: number };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WorkflowsPage() {
  const user = useTenantAuth();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/workflows?limit=100');
      setWorkflows(unwrapArrayOrEmpty(res));
    } catch {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchWorkflows(); }, [fetchWorkflows]);

  async function toggleActive(wf: Workflow) {
    try {
      await api.patch(`/workflows/${wf.id}`, { isActive: !wf.isActive });
      setWorkflows((prev) =>
        prev.map((w) => (w.id === wf.id ? { ...w, isActive: !w.isActive } : w)),
      );
    } catch { /* silent */ }
  }

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-[1400px] mx-auto h-full flex flex-col space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Workflows</h1>
            <p className="text-sm text-zinc-500 mt-0.5">{workflows.length} workflows</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setSelected(null); setShowBuilder(true); }}
              className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition font-medium"
            >
              + New Workflow
            </button>
            <button
              onClick={() => void fetchWorkflows()}
              className="px-3 py-2 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* ── Content: list + builder panel ── */}
        {showBuilder ? (
          /* Visual builder mode */
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Builder canvas */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-200">
                  {selected ? `Editing: ${selected.name}` : 'New Workflow'}
                </span>
                <button
                  onClick={() => setShowBuilder(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition"
                >
                  ← Back to list
                </button>
              </div>
              <div className="flex-1 rounded-xl border border-surface-border overflow-hidden">
                <ReactFlowBuilder workflow={selected} onSave={() => { setShowBuilder(false); void fetchWorkflows(); }} />
              </div>
            </div>
          </div>
        ) : (
          /* Workflow cards grid */
          loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-36 rounded-xl border border-surface-border bg-surface-raised animate-pulse" />
              ))}
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <p className="text-zinc-500 text-sm mb-4">No workflows yet.</p>
              <button
                onClick={() => setShowBuilder(true)}
                className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition"
              >
                Create your first workflow
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence>
                {workflows.map((wf) => (
                  <motion.div
                    key={wf.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col gap-3"
                  >
                    {/* Title + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-zinc-200 leading-snug">{wf.name}</p>
                        {wf.description && (
                          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{wf.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => void toggleActive(wf)}
                        className={`shrink-0 mt-0.5 w-10 h-5.5 rounded-full transition-colors relative ${
                          wf.isActive ? 'bg-violet-600' : 'bg-zinc-700'
                        }`}
                        title={wf.isActive ? 'Deactivate' : 'Activate'}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            wf.isActive ? 'translate-x-4' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>{wf._count?.executions ?? 0} executions</span>
                      <span>{new Date(wf.updatedAt).toLocaleDateString()}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1 border-t border-surface-border">
                      <button
                        onClick={() => { setSelected(wf); setShowBuilder(true); }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 hover:border-violet-600/60 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          try { await api.post(`/workflows/${wf.id}/execute`, {}); }
                          catch { /* silent */ }
                        }}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          wf.isActive
                            ? 'bg-violet-600 text-white hover:bg-violet-700'
                            : 'border border-surface-border text-zinc-600 cursor-not-allowed'
                        }`}
                        disabled={!wf.isActive}
                      >
                        Run Now
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )
        )}
      </div>
    </TenantShell>
  );
}
