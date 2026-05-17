'use client';
// ─── Inspector Panel ──────────────────────────────────────────────────────────
// S — Single Responsibility: sliding right panel frame only; content delegated by type map
// D — Dependency Inversion: content components injected via type→component registry
import { motion, AnimatePresence } from 'framer-motion';
import { useInspectorStore } from '@/stores/inspectorStore';
import { AgentInspector } from '@/components/inspector/AgentInspector';
import { TaskInspector } from '@/components/inspector/TaskInspector';

// O — Open/Closed: add new inspector types here without modifying panel
const INSPECTOR_MAP = {
  agent:      AgentInspector,
  task:       TaskInspector,
  workflow:   () => <GenericInspector title="Workflow" />,
  department: () => <GenericInspector title="Department" />,
  tenant:     () => <GenericInspector title="Tenant" />,
} as const;

function GenericInspector({ title }: { title: string }) {
  return (
    <div className="p-6 text-zinc-400 text-sm">{title} details coming soon.</div>
  );
}

export function InspectorPanel() {
  const { open, type, id, closeInspector } = useInspectorStore();
  const ContentComponent = type ? (INSPECTOR_MAP[type] as React.ComponentType<{ id: string }>) : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-30"
            onClick={closeInspector}
          />
          {/* Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-[420px] bg-surface-overlay border-l border-surface-border z-40 flex flex-col shadow-2xl"
          >
            {/* Panel header */}
            <div className="h-12 border-b border-surface-border flex items-center justify-between px-5 flex-shrink-0">
              <span className="text-sm font-semibold text-zinc-200 capitalize">{type} Inspector</span>
              <button
                onClick={closeInspector}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-muted text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                ✕
              </button>
            </div>
            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">
              {ContentComponent && id ? <ContentComponent id={id} /> : null}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
