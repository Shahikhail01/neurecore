'use client';
// ─── OrgTree ──────────────────────────────────────────────────────────────────
// S — Single Responsibility: renders hierarchical Dept → Agent sidebar tree only
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useInspectorStore } from '@/stores/inspectorStore';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';

interface AgentNode {
  id: string;
  name: string;
  status: string;
}

interface DeptNode {
  id: string;
  name: string;
  agents: AgentNode[];
}

const STATUS_DOT: Record<string, string> = {
  RUNNING: 'bg-status-ops',
  ACTIVE:  'bg-status-profit',
  IDLE:    'bg-zinc-600',
  FAILED:  'bg-status-risk',
  PAUSED:  'bg-status-warn',
};

export function OrgTree() {
  const [depts, setDepts] = useState<DeptNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { openInspector } = useInspectorStore();
  const pathname = usePathname();

  useEffect(() => {
    Promise.allSettled([
      api.get<{ data: { data: { id: string; name: string; parentId: string | null }[] } }>('/departments?limit=50'),
      api.get<{ data: { id: string; name: string; status: string; departmentId: string | null }[] }>('/agents?limit=100'),
    ]).then(([deptsRes, agentsRes]) => {
      const deptList = deptsRes.status === 'fulfilled' ? unwrapList(deptsRes.value).items ?? [] : [];
      const agentList = agentsRes.status === 'fulfilled' ? unwrapList(agentsRes.value).items ?? [] : [];

      const tree: DeptNode[] = deptList.map((d) => ({
        id: d.id,
        name: d.name,
        agents: agentList
          .filter((a) => a.departmentId === d.id)
          .map((a) => ({ id: a.id, name: a.name, status: a.status })),
      }));

      // Unassigned agents bucket
      const unassigned = agentList.filter((a) => !a.departmentId);
      if (unassigned.length > 0) {
        tree.push({
          id: '__unassigned',
          name: 'Unassigned',
          agents: unassigned.map((a) => ({ id: a.id, name: a.name, status: a.status })),
        });
      }

      setDepts(tree);
      // Auto-expand first dept
      if (tree[0]) setExpanded(new Set([tree[0].id]));
    });
  }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-0.5 px-2">
      {depts.map((dept) => (
        <div key={dept.id}>
          <button
            onClick={() => toggle(dept.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-surface-raised transition-colors"
          >
            <span className={`transition-transform text-[10px] ${expanded.has(dept.id) ? 'rotate-90' : ''}`}>▶</span>
            <span className="truncate flex-1 text-left">{dept.name}</span>
            <span className="text-[10px] text-zinc-600">{dept.agents.length}</span>
          </button>

          <AnimatePresence initial={false}>
            {expanded.has(dept.id) && dept.agents.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="ml-4 border-l border-surface-border pl-2 flex flex-col gap-0.5 py-0.5">
                  {dept.agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => openInspector('agent', agent.id)}
                      className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 hover:bg-surface-raised transition-colors text-left ${
                        pathname?.includes(agent.id) ? 'bg-surface-raised text-zinc-200' : ''
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[agent.status] ?? 'bg-zinc-600'}`} />
                      <span className="truncate">{agent.name}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
