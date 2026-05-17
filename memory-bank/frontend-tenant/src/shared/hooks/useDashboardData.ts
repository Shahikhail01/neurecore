// ─── useDashboardData.ts ─────────────────────────────────────────────────────
// SRP: Dashboard data fetching and composition only.
// DIP: Uses dashboardService abstraction.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { dashboardService } from '@/core/services/DashboardService';
import type { CompanyMetrics, ActivityEvent, Agent, Task, Workflow } from '@/shared/types/domain.types';
import type { DailyBriefing } from '@/core/services/interfaces/IDashboardService';

interface DashboardData {
  metrics: CompanyMetrics | null;
  timeline: ActivityEvent[];
  briefing: DailyBriefing | null;
  topAgents: Agent[];
  pendingTasks: Task[];
  pendingWorkflows: Workflow[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDashboardData(): DashboardData {
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);
  const [timeline, setTimeline] = useState<ActivityEvent[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [topAgents, setTopAgents] = useState<Agent[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [pendingWorkflows, setPendingWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, tl, brief, top, pending] = await Promise.all([
        dashboardService.getCompanyMetrics(),
        dashboardService.getActivityTimeline(),
        dashboardService.getDailyBriefing(),
        dashboardService.getTopAgents(5),
        dashboardService.getPendingWorkItems(),
      ]);
      setMetrics(m);
      setTimeline(tl);
      setBriefing(brief);
      setTopAgents(top);
      setPendingTasks(pending.tasks);
      setPendingWorkflows(pending.workflows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { metrics, timeline, briefing, topAgents, pendingTasks, pendingWorkflows, loading, error, refresh: load };
}
