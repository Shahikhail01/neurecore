'use client';
// ─── /projects — Pipeline/Kanban board across all projects ───────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, Search, DollarSign, Calendar } from 'lucide-react';
import TenantShell from '@/components/TenantShell';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { GlassPanel } from '@/components/home/GlassPanel';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { projectsService, type Project, type ProjectStatus } from '@/services/projects.service';
import { useTenantAuth } from '@/hooks/useTenantAuth';

const PIPELINE_COLUMNS: { status: ProjectStatus; label: string }[] = [
  { status: 'LEAD', label: 'Leads' },
  { status: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { status: 'WON', label: 'Won' },
  { status: 'ACTIVE', label: 'Active' },
  { status: 'ON_HOLD', label: 'On Hold' },
  { status: 'REVIEW', label: 'Review' },
  { status: 'COMPLETED', label: 'Completed' },
];

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-zinc-400',
  MEDIUM: 'text-[color:var(--state-info)]',
  HIGH: 'text-[color:var(--state-warning)]',
  URGENT: 'text-[color:var(--state-danger)]',
};

function priorityLabel(p: string): string {
  const map: Record<string, string> = { LOW: 'Low', MEDIUM: 'Med', HIGH: 'High', URGENT: 'Urgent' };
  return map[p] ?? p;
}

export default function ProjectsPage() {
  const user = useTenantAuth()!;
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await projectsService.list({ limit: 200, search: search || undefined });
      setProjects(items);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<ProjectStatus, Project[]>();
    for (const col of PIPELINE_COLUMNS) map.set(col.status, []);
    for (const p of projects) {
      const bucket = map.get(p.status);
      if (bucket) bucket.push(p);
    }
    return map;
  }, [projects]);

  return (
    <TenantShell user={user}>
      <div className="px-6 py-6 flex flex-col gap-6 h-full">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Projects Pipeline</h1>
            <p className="text-sm text-zinc-500 mt-1">
              All projects across customers, organized by status.
            </p>
          </div>
          <Link href="/projects/new">
            <ActionButton variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
              New Project
            </ActionButton>
          </Link>
        </header>

        <GlassPanel className="p-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              className="w-full pl-9 pr-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
              placeholder="Search projects by name or customer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </GlassPanel>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-zinc-500">Loading projects…</p>
          </div>
        )}

        {!loading && (
          <div className="flex-1 min-h-0 overflow-x-auto">
            <div className="flex gap-4 h-full min-w-[1120px]">
              {PIPELINE_COLUMNS.map((col) => (
                <div key={col.status} className="flex-1 min-w-[140px] flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">
                      {col.label}
                    </span>
                    <span className="text-xs text-zinc-600 font-mono">
                      {grouped.get(col.status)?.length ?? 0}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                    {(grouped.get(col.status) ?? []).map((p) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Link
                          href={`/projects/${p.id}`}
                          className="block p-3 rounded-lg bg-surface border border-surface-border hover:border-primary/50 hover:bg-surface-overlay transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="text-sm font-medium text-zinc-100 leading-snug line-clamp-2">
                              {p.name}
                            </span>
                            <StatusBadge status={p.status} />
                          </div>
                          {p.customer && (
                            <p className="text-xs text-zinc-500 mb-1.5">{p.customer.name}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-zinc-500">
                            {p.priority && (
                              <span className={PRIORITY_COLORS[p.priority] ?? 'text-zinc-500'}>
                                {priorityLabel(p.priority)}
                              </span>
                            )}
                            {p.budgetType && p.budgetAmount != null && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                {p.budgetAmount.toLocaleString()} {p.budgetCurrency ?? ''}
                              </span>
                            )}
                            {p.targetDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(p.targetDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </TenantShell>
  );
}
