// src/app/projects/[id]/page.tsx
//
// Phase 7 — Project workspace. Surfaces:
//   - Project header + status
//   - Automation status (Phase 5 progress)
//   - Task board (Phase 7 §9.1 Kanban)
//   - Agent picker for unassigned tasks
//   - Unified timeline (Phase 7 §9.2 chronological stream)
//
// The page is responsive (md+) and keyboard navigable (tab order
// follows the visual hierarchy).

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import TenantShell from '@/components/TenantShell';
import { GlassPanel } from '@/components/home/GlassPanel';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { projectsService, type Project } from '@/services/projects.service';
import { AutomationStatusView } from '@/components/projects/AutomationStatusView';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { UnifiedTimeline } from '@/components/timeline';
import { AgentAssignmentPanel } from '@/components/assignments/AgentAssignmentPanel';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { Loader2 } from 'lucide-react';

export default function ProjectDetailPage() {
  const user = useTenantAuth()!;
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskMeta, setSelectedTaskMeta] = useState<{
    requiredRole?: string;
    requiredCapabilities?: string[];
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await projectsService.get(id);
      setProject(p);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const headerSummary = useMemo(() => {
    if (!project) return null;
    return {
      name: project.name,
      customer: project.customer?.name,
      status: project.status,
    };
  }, [project]);

  if (loading && !project) {
    return (
      <TenantShell user={user}>
        <div className="p-12 text-center text-sm text-zinc-500">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
          Loading project…
        </div>
      </TenantShell>
    );
  }

  if (!project) {
    return (
      <TenantShell user={user}>
        <div className="p-12 text-center text-sm text-zinc-500">
          Project not found.{' '}
          <Link href="/projects" className="text-primary hover:underline">
            Back to pipeline
          </Link>
        </div>
      </TenantShell>
    );
  }

  return (
    <TenantShell user={user}>
      <div className="px-4 py-6 sm:px-6 flex flex-col gap-6 max-w-6xl mx-auto w-full">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/projects"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              ← Pipeline
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-zinc-100">
              {headerSummary?.name}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
              {headerSummary?.customer ? (
                <span>{headerSummary.customer}</span>
              ) : null}
              <StatusBadge status={headerSummary?.status ?? 'ACTIVE'} />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <GlassPanel className="lg:col-span-1">
            <AutomationStatusView projectId={id} />
          </GlassPanel>
          <GlassPanel className="lg:col-span-2">
            <TaskBoard
              projectId={id}
              onTaskSelect={(task) => {
                setSelectedTaskId(task.id);
                setSelectedTaskMeta({
                  requiredRole: task.requiredRole ?? undefined,
                  requiredCapabilities: task.requiredCapabilities,
                });
              }}
            />
          </GlassPanel>
        </div>

        {selectedTaskId ? (
          <GlassPanel>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-zinc-100">
                Assign AI employee
              </h2>
              <p className="text-xs text-zinc-400">
                Pick from eligible candidates or override if you are an owner / manager.
              </p>
            </div>
            <AgentAssignmentPanel
              taskId={selectedTaskId}
              requiredRole={selectedTaskMeta?.requiredRole}
              requiredCapabilities={selectedTaskMeta?.requiredCapabilities}
              onAssigned={() => setSelectedTaskId(null)}
            />
          </GlassPanel>
        ) : null}

        <GlassPanel>
          <div className="mb-3">
            <h2 className="text-base font-semibold text-zinc-100">Timeline</h2>
            <p className="text-xs text-zinc-400">
              All events for this project, in order.
            </p>
          </div>
          <UnifiedTimeline
            entityType="Project"
            entityId={id}
            ariaLabel={`Project ${project.name} timeline`}
          />
        </GlassPanel>
      </div>
    </TenantShell>
  );
}
