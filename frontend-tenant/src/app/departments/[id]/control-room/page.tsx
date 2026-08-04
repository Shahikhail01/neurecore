'use client';

/**
 * /departments/[id]/control-room — Department Control Room
 *
 * Creatio-style operational cockpit for a single department.
 * Gives leaders a focused view of:
 * - live KPIs
 * - agents in the department
 * - recent tasks
 * - active workflows
 * - quick entry points into the full department workspace
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Activity, Users, ListTodo, GitBranch, Briefcase, Target, Wallet, RefreshCw } from 'lucide-react';

import { PageShell, PageHero, GlassPanel } from '@neurecore/ui-visual';
import TenantShell from '@/components/TenantShell';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { KpiCard } from '@/components/creatio/KpiCard';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { AreaChart } from '@/components/charts/AreaChart';
import api from '@/services/api';
import { unwrapArrayOrEmpty } from '@/services/unwrap';
import { hqEventBus } from '@/core/infrastructure/socket/EventBus';

interface Dept {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

interface Agent {
  id: string;
  name: string;
  status?: string;
  departmentId?: string;
  type?: string;
  model?: { name?: string };
  monthlyBudget?: number;
  budgetUsed?: number;
  _count?: { tasks: number };
}

interface Task {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  departmentId?: string;
  createdAt?: string;
}

interface Workflow {
  id: string;
  name: string;
  status?: string;
  stageLabel?: string;
  progressPercent?: number;
  detail?: string;
}

interface ApprovalItem {
  id: string;
  title: string;
  riskLevel: string;
  department?: string;
}

interface MissionFeedItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  priority?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
}

interface WorkflowEventPayload {
  workflowId?: string;
  workflowName?: string;
  status?: string;
  event?: string;
  stageLabel?: string;
  executionId?: string;
  progressPercent?: number;
  detail?: string;
  timestamp?: number;
  departmentId?: string;
}

interface ApprovalRequestedPayload {
  id?: string;
  approvalId?: string;
  title?: string;
  riskLevel?: string;
  department?: string;
}

interface TaskUpdatePayload {
  taskId: string;
  status: string;
}

interface ActivityPayloadEnvelope {
  type?: string;
  payload?: unknown;
}

interface MissionActivityPayload {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  departmentId?: string;
}

interface AgentStatusPayload {
  agentId: string;
  status: string;
}

interface NotificationPayload {
  id?: string;
  title?: string;
  message?: string;
  type?: string;
}

export default function DepartmentControlRoomPage() {
  const user = useTenantAuth();
  const params = useParams<{ id: string }>();
  const deptId = decodeURIComponent(params.id);

  const [dept, setDept] = useState<Dept | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [missionFeed, setMissionFeed] = useState<MissionFeedItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);
  const [alertFilter, setAlertFilter] = useState<'ALL' | 'ERROR' | 'WARNING' | 'INFO'>('ALL');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, agentsRes, tasksRes, workflowsRes, approvalsRes, missionRes] = await Promise.all([
        api.get(`/departments/${deptId}`),
        api.get('/agents?limit=200'),
        api.get('/tasks?limit=200'),
        api.get('/workflows?limit=200'),
        api.get('/approvals/stratified?status=PENDING'),
        api.get('/mission-feed?limit=50'),
      ]);
      const deptData = deptRes?.data?.data ?? deptRes?.data ?? deptRes;
      setDept(deptData ?? null);
      setAgents(
        unwrapArrayOrEmpty(agentsRes).filter((a: Agent) => a.departmentId === deptId) as Agent[],
      );
      setTasks(
        unwrapArrayOrEmpty(tasksRes).filter((t: Task) => t.departmentId === deptId) as Task[],
      );
      const workflowItems = workflowsRes?.data?.items ?? workflowsRes?.data?.data?.items ?? [];
      setWorkflows(Array.isArray(workflowItems) ? workflowItems : []);
      const approvalsData = approvalsRes?.data?.data ?? approvalsRes?.data ?? {};
      const allApprovals = [
        ...((approvalsData.critical ?? []) as ApprovalItem[]),
        ...((approvalsData.routine ?? []) as ApprovalItem[]),
      ];
      setApprovals(
        allApprovals.filter((item) => !item.department || item.department === deptData?.name),
      );
      const missionItems = missionRes?.data?.items ?? missionRes?.data?.data?.items ?? [];
      setMissionFeed(Array.isArray(missionItems) ? missionItems.slice(0, 8) : []);
      setNotifications([]);
    } catch {
      setDept(null);
      setAgents([]);
      setTasks([]);
      setWorkflows([]);
      setApprovals([]);
      setMissionFeed([]);
      setNotifications([]);
    } finally {
      setLoading(false);
      setLastRefreshAt(new Date().toISOString());
    }
  }, [deptId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(`nc.control-room.dismissed-alerts.${deptId}`);
      const parsed = raw ? JSON.parse(raw) : [];
      setDismissedNotificationIds(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
    } catch {
      setDismissedNotificationIds([]);
    }
  }, [deptId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        `nc.control-room.dismissed-alerts.${deptId}`,
        JSON.stringify(dismissedNotificationIds),
      );
    } catch {
      /* noop */
    }
  }, [deptId, dismissedNotificationIds]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void fetchAll();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, fetchAll]);

  useEffect(() => {
    const offAgent = hqEventBus.on('agent:status', (payload?: AgentStatusPayload) => {
      if (!payload?.agentId) return;
      setAgents((current) => {
        const matchIndex = current.findIndex((item) => item.id === payload.agentId);
        if (matchIndex === -1) {
          void fetchAll();
          return current;
        }
        const next = [...current];
        next[matchIndex] = {
          ...next[matchIndex],
          status: payload.status ?? next[matchIndex].status,
        };
        return next;
      });
      setLastRefreshAt(new Date().toISOString());
    });
    const offNotification = hqEventBus.on('notification:new', (payload?: NotificationPayload) => {
      if (!payload?.id || !payload?.title || !payload?.message) return;
      // Narrow into locals so TS treats them as non-null inside the closure
      // (setNotifications does not narrow the outer `payload` reference).
      const { id, title, message } = payload;
      if (dismissedNotificationIds.includes(id)) return;
      setNotifications((current) => {
        if (current.some((item) => item.id === id)) {
          return current;
        }
        return [
          {
            id,
            title,
            message,
            type: payload.type ?? 'info',
          },
          ...current,
        ].slice(0, 8);
      });
      setLastRefreshAt(new Date().toISOString());
    });
    const offActivity = hqEventBus.on('activity:new', (event?: ActivityPayloadEnvelope) => {
      const payload = (event?.payload ?? null) as MissionActivityPayload | null;
      const loweredType = (event?.type ?? '').toLowerCase();
      if (
        payload?.id &&
        payload?.title &&
        (loweredType.includes('mission') || payload.category || payload.priority)
      ) {
        if (payload.departmentId && payload.departmentId !== deptId) {
          return;
        }
        // Narrow into locals so TS treats them as non-null in the closure.
        const { id, title, description, category, priority } = payload;
        setMissionFeed((current) => {
          if (current.some((item) => item.id === id)) {
            return current;
          }
          return [
            {
              id,
              title,
              description,
              category,
              priority,
            },
            ...current,
          ].slice(0, 8);
        });
        setLastRefreshAt(new Date().toISOString());
        return;
      }
      void fetchAll();
    });
    const offTask = hqEventBus.on('task:update', (payload?: TaskUpdatePayload) => {
      if (!payload?.taskId) return;
      setTasks((current) => {
        const matchIndex = current.findIndex((item) => item.id === payload.taskId);
        if (matchIndex === -1) {
          void fetchAll();
          return current;
        }
        const next = [...current];
        next[matchIndex] = {
          ...next[matchIndex],
          status: payload.status ?? next[matchIndex].status,
        };
        return next;
      });
      setLastRefreshAt(new Date().toISOString());
    });
    const offWorkflow = hqEventBus.on('workflow:event', (payload?: WorkflowEventPayload) => {
      if (payload?.departmentId && payload.departmentId !== deptId) return;
      if (!payload?.workflowId && !payload?.workflowName) {
        void fetchAll();
        return;
      }
      const nextStatus =
        payload?.status ??
        (payload?.event === 'started'
          ? 'ACTIVE'
          : payload?.event === 'completed'
            ? 'ARCHIVED'
            : payload?.event === 'failed'
              ? 'ERROR'
              : payload?.event === 'paused'
                ? 'PAUSED'
                : undefined);
      setWorkflows((current) => {
        const workflowId = payload.workflowId;
        const workflowName = payload.workflowName;
        const matchIndex = current.findIndex(
          (item) => item.id === workflowId || (workflowName && item.name === workflowName),
        );
        if (matchIndex === -1) {
          if (!workflowId || !workflowName) {
            void fetchAll();
            return current;
          }
          return [
            {
              id: workflowId,
              name: workflowName,
              status: nextStatus ?? 'ACTIVE',
              stageLabel: payload?.stageLabel ?? payload?.event,
              progressPercent: payload?.progressPercent,
              detail: payload?.detail,
            },
            ...current,
          ];
        }
        const next = [...current];
        next[matchIndex] = {
          ...next[matchIndex],
          status: nextStatus ?? next[matchIndex].status,
          stageLabel:
            payload?.stageLabel ??
            payload?.event ??
            next[matchIndex].stageLabel,
          progressPercent: payload?.progressPercent ?? next[matchIndex].progressPercent,
          detail: payload?.detail ?? next[matchIndex].detail,
        };
        return next;
      });
      setLastRefreshAt(new Date().toISOString());
    });
    const offApproval = hqEventBus.on('approval:requested', (payload?: ApprovalRequestedPayload) => {
      if (payload?.department && dept?.name && payload.department !== dept.name) return;
      const approvalId = payload?.id ?? payload?.approvalId;
      if (!approvalId || !payload?.title) {
        void fetchAll();
        return;
      }
      const title = payload.title;
      setApprovals((current) => {
        if (current.some((item) => item.id === approvalId)) {
          return current;
        }
        return [
          {
            id: approvalId,
            title,
            riskLevel: payload.riskLevel ?? 'PENDING',
            department: payload.department ?? dept?.name,
          },
          ...current,
        ];
      });
      setLastRefreshAt(new Date().toISOString());
    });
    const offSocket = hqEventBus.on('socket:connected', () => {
      void fetchAll();
    });

    return () => {
      offAgent();
      offNotification();
      offActivity();
      offTask();
      offWorkflow();
      offApproval();
      offSocket();
    };
  }, [dept?.name, deptId, dismissedNotificationIds, fetchAll]);

  const runningAgents = useMemo(() => agents.filter((a) => a.status === 'RUNNING').length, [agents]);
  const activeAgents = useMemo(() => agents.filter((a) => a.status === 'ACTIVE' || a.status === 'RUNNING').length, [agents]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'COMPLETED').length, [tasks]);
  const failedTasks = useMemo(() => tasks.filter((t) => t.status === 'FAILED').length, [tasks]);
  const backlog = useMemo(() => tasks.filter((t) => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(t.status ?? '')).length, [tasks]);
  const activeWorkflows = useMemo(() => workflows.filter((workflow) => workflow.status === 'ACTIVE').length, [workflows]);
  const visibleNotifications = useMemo(
    () =>
      notifications.filter((item) =>
        alertFilter === 'ALL' ? true : item.type.toUpperCase() === alertFilter,
      ),
    [alertFilter, notifications],
  );

  const taskTrend = useMemo(
    () => {
      const bins = new Map<string, number>();
      for (const task of tasks) {
        if (!task.createdAt) continue;
        const day = new Date(task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        bins.set(day, (bins.get(day) ?? 0) + 1);
      }
      return Array.from(bins.entries()).slice(-7).map(([label, value]) => ({ ts: label, value }));
    },
    [tasks],
  );

  async function executeWorkflow(id: string) {
    setBusyKey(`workflow:${id}`);
    try {
      await api.post(`/workflows/${id}/execute`, { input: { departmentId: deptId } });
      await fetchAll();
    } finally {
      setBusyKey(null);
    }
  }

  async function approveRequest(id: string) {
    setBusyKey(`approval:${id}:approve`);
    try {
      await api.post(`/approvals/${id}/approve`);
      await fetchAll();
    } finally {
      setBusyKey(null);
    }
  }

  async function rejectRequest(id: string) {
    setBusyKey(`approval:${id}:reject`);
    try {
      await api.post(`/approvals/${id}/reject`);
      await fetchAll();
    } finally {
      setBusyKey(null);
    }
  }

  async function dismissMissionItem(id: string) {
    setBusyKey(`mission:${id}`);
    try {
      await api.post(`/mission-feed/${id}/dismiss`);
      setMissionFeed((items) => items.filter((item) => item.id !== id));
    } finally {
      setBusyKey(null);
    }
  }

  function dismissNotification(id: string) {
    setNotifications((current) => current.filter((item) => item.id !== id));
    setDismissedNotificationIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  function clearDismissedNotifications() {
    setDismissedNotificationIds([]);
  }

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <PageShell variant="default">
        <PageHero
          eyebrow="Operations"
          title={`${dept?.name ?? 'Department'} Control Room`}
          subtitle="Focused department cockpit with live status, work queues, and quick access into the full workspace."
        />

        <div className="max-w-7xl mx-auto space-y-5">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/departments/${deptId}/workspace`}
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to workspace
            </Link>
            <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchAll()}>
              Refresh
            </ActionButton>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-overlay/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-100">Live telemetry</p>
              <p className="text-xs text-zinc-500">
                Last refresh: {lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString() : '—'}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4"
              />
              Auto-refresh every 30s
            </label>
          </div>

          <GlassPanel padding="lg">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-zinc-100">{dept?.name ?? 'Department'}</h2>
                  {dept?.status && <StatusBadge status={dept.status} />}
                </div>
                <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
                  {dept?.description ?? 'This control room shows the department-level execution picture.'}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href={`/departments/${deptId}/workspace`} className="rounded-lg border border-surface-border px-3 py-2 text-sm text-zinc-300 hover:bg-surface-overlay">
                  Open workspace
                </Link>
              </div>
            </div>
          </GlassPanel>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Agents" value={agents.length} color="ops" icon={<Users className="w-4 h-4" />} loading={loading} />
            <KpiCard label="Active" value={activeAgents} color="profit" icon={<Activity className="w-4 h-4" />} loading={loading} />
            <KpiCard label="Backlog" value={backlog} color="warn" icon={<ListTodo className="w-4 h-4" />} loading={loading} />
            <KpiCard label="Failed" value={failedTasks} color="risk" icon={<Target className="w-4 h-4" />} loading={loading} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Workflows" value={workflows.length} color="ops" icon={<GitBranch className="w-4 h-4" />} loading={loading} />
            <KpiCard label="Active flows" value={activeWorkflows} color="profit" icon={<Briefcase className="w-4 h-4" />} loading={loading} />
            <KpiCard label="Approvals" value={approvals.length} color="warn" icon={<Target className="w-4 h-4" />} loading={loading} />
            <KpiCard label="Mission feed" value={missionFeed.length} color="ops" icon={<Activity className="w-4 h-4" />} loading={loading} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Alerts" value={notifications.length} color="risk" icon={<RefreshCw className="w-4 h-4" />} loading={loading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlassPanel padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-accent-500" />
                  Task trend
                </h3>
                <span className="text-xs text-zinc-500">{completedTasks} completed</span>
              </div>
              <AreaChart data={taskTrend} dataKey="value" xKey="label" color="var(--accent-500)" loading={loading} height={220} />
            </GlassPanel>

            <GlassPanel padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-state-warning" />
                  Budget signal
                </h3>
                <span className="text-xs text-zinc-500">Live from agent budgets</span>
              </div>
              <div className="space-y-3">
                {agents.slice(0, 6).map((agent) => (
                  <div key={agent.id} className="rounded-xl border border-surface-border bg-surface-overlay/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{agent.name}</p>
                        <p className="text-xs text-zinc-500">{agent.model?.name ?? agent.type ?? 'Agent'}</p>
                      </div>
                      <StatusBadge status={agent.status ?? 'UNKNOWN'} />
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      Budget used: {agent.budgetUsed != null ? `$${agent.budgetUsed.toFixed(2)}` : '—'}
                    </div>
                  </div>
                ))}
                {agents.length === 0 && (
                  <div className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-zinc-500">
                    No agents assigned to this department yet.
                  </div>
                )}
              </div>
            </GlassPanel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlassPanel padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-100">Department agents</h3>
                <span className="text-xs text-zinc-500">{runningAgents} running</span>
              </div>
              <div className="space-y-3">
                {agents.slice(0, 8).map((agent) => (
                  <div key={agent.id} className="rounded-xl border border-surface-border bg-surface-overlay/50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{agent.name}</p>
                        <p className="text-xs text-zinc-500">{agent.model?.name ?? agent.type ?? 'Agent'}</p>
                      </div>
                      <StatusBadge status={agent.status ?? 'UNKNOWN'} />
                    </div>
                    <div className="mt-3 text-xs text-zinc-500 flex items-center gap-4">
                      <span>Tasks: {agent._count?.tasks ?? 0}</span>
                      <span>Budget: {agent.monthlyBudget != null ? `$${agent.monthlyBudget.toFixed(2)}` : '—'}</span>
                    </div>
                  </div>
                ))}
                {agents.length === 0 && (
                  <div className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-zinc-500">
                    No agents in this department.
                  </div>
                )}
              </div>
            </GlassPanel>

            <GlassPanel padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-100">Recent tasks</h3>
                <span className="text-xs text-zinc-500">{completedTasks} completed</span>
              </div>
              <div className="space-y-2">
                {tasks.slice(0, 10).map((task) => (
                  <div key={task.id} className="rounded-xl border border-surface-border bg-surface-overlay/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-100">{task.title}</p>
                      <StatusBadge status={task.status ?? 'UNKNOWN'} />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{task.priority ?? 'NORMAL'}</p>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-zinc-500">
                    No tasks assigned to this department.
                  </div>
                )}
              </div>
            </GlassPanel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GlassPanel padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-100">Workflows</h3>
                <span className="text-xs text-zinc-500">{activeWorkflows} active</span>
              </div>
              <div className="space-y-2">
                {workflows.slice(0, 8).map((workflow) => (
                  <div key={workflow.id} className="rounded-xl border border-surface-border bg-surface-overlay/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-100">{workflow.name}</p>
                      <StatusBadge status={workflow.status ?? 'UNKNOWN'} />
                    </div>
                    {workflow.stageLabel && (
                      <p className="mt-1 text-xs text-zinc-500">Stage: {workflow.stageLabel}</p>
                    )}
                    {workflow.progressPercent != null && (
                      <div className="mt-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-border">
                          <div
                            className="h-full bg-[color:var(--accent-500)] transition-all"
                            style={{ width: `${Math.max(0, Math.min(100, workflow.progressPercent))}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          Progress: {workflow.progressPercent}%
                        </p>
                      </div>
                    )}
                    {workflow.detail && (
                      <p className="mt-1 text-xs text-zinc-500">{workflow.detail}</p>
                    )}
                    <div className="mt-3">
                      <button
                        onClick={() => void executeWorkflow(workflow.id)}
                        disabled={busyKey === `workflow:${workflow.id}`}
                        className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-overlay disabled:opacity-50"
                      >
                        {busyKey === `workflow:${workflow.id}` ? 'Executing…' : 'Execute'}
                      </button>
                    </div>
                  </div>
                ))}
                {workflows.length === 0 && (
                  <div className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-zinc-500">
                    No workflows available.
                  </div>
                )}
              </div>
            </GlassPanel>

            <GlassPanel padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-100">Pending approvals</h3>
                <span className="text-xs text-zinc-500">{approvals.length} pending</span>
              </div>
              <div className="space-y-2">
                {approvals.slice(0, 8).map((approval) => (
                  <div key={approval.id} className="rounded-xl border border-surface-border bg-surface-overlay/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-100">{approval.title}</p>
                      <StatusBadge status={approval.riskLevel} />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{approval.department ?? 'Cross-department'}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => void approveRequest(approval.id)}
                        disabled={busyKey === `approval:${approval.id}:approve`}
                        className="rounded-lg border border-emerald-700/50 px-3 py-1.5 text-xs text-emerald-200 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => void rejectRequest(approval.id)}
                        disabled={busyKey === `approval:${approval.id}:reject`}
                        className="rounded-lg border border-red-700/50 px-3 py-1.5 text-xs text-red-200 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
                {approvals.length === 0 && (
                  <div className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-zinc-500">
                    No pending approvals for this department.
                  </div>
                )}
              </div>
            </GlassPanel>

            <GlassPanel padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-100">Mission feed</h3>
                <span className="text-xs text-zinc-500">Latest signals</span>
              </div>
              <div className="space-y-2">
                {missionFeed.map((item) => (
                  <div key={item.id} className="rounded-xl border border-surface-border bg-surface-overlay/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                      <StatusBadge status={item.priority ?? item.category ?? 'INFO'} />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{item.description ?? item.category ?? 'Signal'}</p>
                    <div className="mt-3">
                      <button
                        onClick={() => void dismissMissionItem(item.id)}
                        disabled={busyKey === `mission:${item.id}`}
                        className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-overlay disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
                {missionFeed.length === 0 && (
                  <div className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-zinc-500">
                    No mission feed items right now.
                  </div>
                )}
              </div>
            </GlassPanel>

            <GlassPanel padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-100">Live alerts</h3>
                <span className="text-xs text-zinc-500">Socket notifications</span>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {(['ALL', 'ERROR', 'WARNING', 'INFO'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setAlertFilter(filter)}
                    className={`rounded-full border px-2 py-1 text-[10px] ${
                      alertFilter === filter
                        ? 'border-[color:var(--accent-500)] text-zinc-100'
                        : 'border-surface-border text-zinc-500'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearDismissedNotifications}
                  className="rounded-full border border-surface-border px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-200"
                >
                  Clear dismissed
                </button>
              </div>
              <div className="space-y-2">
                {visibleNotifications.map((item) => (
                  <div key={item.id} className="rounded-xl border border-surface-border bg-surface-overlay/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={item.type.toUpperCase()} />
                        <button
                          type="button"
                          onClick={() => dismissNotification(item.id)}
                          className="rounded-lg border border-surface-border px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{item.message}</p>
                  </div>
                ))}
                {visibleNotifications.length === 0 && (
                  <div className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-zinc-500">
                    No live alerts for this filter.
                  </div>
                )}
              </div>
            </GlassPanel>
          </div>
        </div>
      </PageShell>
    </TenantShell>
  );
}
