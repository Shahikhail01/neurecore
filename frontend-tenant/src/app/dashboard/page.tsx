'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { KpiTile } from '@/components/kpi/KpiTile';
import { AgentCard } from '@/components/agent-card/AgentCard';
import { AreaChart } from '@/components/charts/AreaChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { useDashboardKpis } from '@/hooks/useDashboardKpis';
import { useChartData } from '@/hooks/useChartData';
import { useTimeRange } from '@/hooks/useTimeRange';
import { useInspectorStore } from '@/stores/inspectorStore';
import { connectSocket, disconnectSocket, getSocket } from '@/services/socket';
import api from '@/services/api';
import { unwrapArrayOrEmpty } from '@/services/unwrap';
import { DailyBriefingButton, DailyBriefingModal } from '@/features/dashboard/components/DailyBriefing';
import { AIChatButton, AIChatPanel } from '@/features/ai-chat/components/AIChatPanel';
import { OrgChartSidebar } from '@/features/org-chart/components/OrgChartSidebar';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ExecutionLog {
  id: string;
  agentId: string;
  taskId?: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  evaluationScore?: number;
  agent?: { name: string };
}

interface DonutSlice { name: string; value: number; color: string }

const STATUS_LOG_COLOR: Record<string, string> = {
  RUNNING: 'text-status-ops',
  COMPLETED: 'text-status-profit',
  FAILED: 'text-status-risk',
  CANCELLED: 'text-status-neutral',
};

const RANGE_OPTIONS = [
  { label: '24 h', value: '24h' as const },
  { label: '7 d', value: '7d' as const },
  { label: '30 d', value: '30d' as const },
];

const RISK_COLOR: Record<string, string> = {
  error: 'border-l-4 border-l-red-500 bg-red-950/30 text-red-300',
  warn: 'border-l-4 border-l-amber-500 bg-amber-950/30 text-amber-300',
  info: 'border-l-4 border-l-blue-500 bg-blue-950/30 text-blue-300',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const user = useTenantAuth();
  const openInspector = useInspectorStore((s) => s.openInspector);

  const { agents, fetchAgents, updateAgentStatus } = useAgentStore();
  const { tasks, fetchTasks, updateTaskStatus } = useTaskStore();
  const { workflows, fetchWorkflows } = useWorkflowStore();

  const { kpis, loading: kpisLoading } = useDashboardKpis();
  const { range, setRange } = useTimeRange();
  const { data: taskTimeSeries, loading: chartLoading } = useChartData('tasks', range);

  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [orgChartOpen, setOrgChartOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await api.get('/observability/logs?limit=8');

      setLogs(unwrapArrayOrEmpty(res));
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAgents(1, 100);
    void fetchTasks(1, 100);
    void fetchWorkflows(1, 100);
    void fetchLogs();
  }, [fetchAgents, fetchTasks, fetchWorkflows, fetchLogs]);

  // Socket live updates
  useEffect(() => {
    const socket = getSocket();
    connectSocket();
    socket.on('agent:status_updated', (p: { agentId: string; status: string }) =>
      updateAgentStatus(p.agentId, p.status as import('@/shared/types/domain.types').AgentStatus));
    socket.on('task:completed', (p: { taskId: string; success: boolean }) => {
      updateTaskStatus(p.taskId, p.success ? 'COMPLETED' : 'FAILED');
      void fetchLogs();
    });
    socket.on('task:failed', (p: { taskId: string }) => {
      updateTaskStatus(p.taskId, 'FAILED');
      void fetchLogs();
    });
    return () => {
      socket.off('agent:status_updated');
      socket.off('task:completed');
      socket.off('task:failed');
      disconnectSocket();
    };
  }, [updateAgentStatus, updateTaskStatus, fetchLogs]);

  // Derived data
  const runningAgents = agents.filter((a) => a.status === 'ACTIVE').length;
  const completedToday = tasks.filter(
    (t) =>
      t.status === 'COMPLETED' &&
      t.completedAt &&
      new Date(t.completedAt).toDateString() === new Date().toDateString(),
  ).length;
  const failedTasks = tasks.filter((t) => t.status === 'FAILED').length;

  const taskStatusDonut: DonutSlice[] = [
    { name: 'Completed', value: completedToday, color: '#22c55e' },
    { name: 'Running', value: tasks.filter((t) => t.status === 'IN_PROGRESS').length, color: '#3b82f6' },
    { name: 'Pending', value: tasks.filter((t) => t.status === 'PENDING').length, color: '#a855f7' },
    { name: 'Failed', value: failedTasks, color: '#ef4444' },
  ].filter((s) => s.value > 0);

  const riskItems = [
    failedTasks > 0 && { level: 'error', text: `${failedTasks} failed task${failedTasks > 1 ? 's' : ''} require attention` },
    runningAgents === 0 && agents.length > 0 && { level: 'warn', text: 'No agents currently active — check agent health' },
    agents.length === 0 && { level: 'info', text: 'No agents deployed yet — create your first agent' },
  ].filter(Boolean) as { level: string; text: string }[];

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Welcome header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">
              Welcome back, {user.firstName}
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOrgChartOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-300 transition"
              title="View Org Chart"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Org Chart
            </button>
            <DailyBriefingButton />
          </div>
        </div>

        {/* ── Risk Panel ── */}
        {riskItems.length > 0 && (
          <div className="space-y-2">
            {riskItems.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-lg px-4 py-2.5 text-sm ${RISK_COLOR[item.level]}`}
              >
                {item.text}
              </motion.div>
            ))}
          </div>
        )}

        {/* ── KPI tiles ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile
            label="Total Agents"
            value={agents.length}
            delta={runningAgents}
            deltaLabel="running"
            color="ops"
            loading={kpisLoading}
          />
          <KpiTile
            label="Running Tasks"
            value={tasks.filter((t) => t.status === 'IN_PROGRESS').length}
            delta={tasks.length}
            deltaLabel="total"
            color="strategy"
            loading={kpisLoading}
          />
          <KpiTile
            label="Completed Today"
            value={completedToday}
            delta={kpis ? kpis.successRate : undefined}
            deltaLabel="% success"
            color="profit"
            loading={kpisLoading}
          />
          <KpiTile
            label="Active Workflows"
            value={workflows.filter((w) => w.isActive).length}
            delta={workflows.length}
            deltaLabel="total"
            color="neutral"
            loading={kpisLoading}
          />
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Task volume area chart (spans 2 cols) */}
          <div className="lg:col-span-2 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-200">Task Volume</h2>
              <div className="flex gap-1">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRange(opt.value)}
                    className={`px-2.5 py-1 rounded-md text-xs transition ${
                      range === opt.value
                        ? 'bg-violet-600 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <AreaChart
              data={taskTimeSeries}
              dataKey="value"
              xKey="timestamp"
              color="#8b5cf6"
              loading={chartLoading}
              height={180}
            />
          </div>

          {/* Task status donut */}
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h2 className="text-sm font-semibold text-zinc-200 mb-4">Task Status</h2>
            <DonutChart
              data={
                taskStatusDonut.length > 0
                  ? taskStatusDonut
                  : [{ name: 'No data', value: 1, color: '#3f3f46' }]
              }
              nameKey="name"
              valueKey="value"
              loading={false}
              height={180}
            />
          </div>
        </div>

        {/* ── Agent cards + recent activity ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top agents */}
          <div className="rounded-xl border border-surface-border bg-surface-raised">
            <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">Active Agents</h2>
              <span className="text-xs text-zinc-500">{runningAgents} running</span>
            </div>
            <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
              {agents.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">No agents yet</p>
              ) : (
                agents.slice(0, 5).map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={{
                      id: agent.id,
                      name: agent.name,
                      type: (agent as any).type ?? 'CONVERSATIONAL',
                      status: agent.status as any,
                      department: (agent as any).department?.name,
                      model: (agent as any).model?.name ?? 'GPT-4o',
                      workload: Math.round(Math.random() * 80),
                      taskCount: 0,
                      successRate: 0,
                      budgetUsed: 0,
                      budgetTotal: (agent as any).monthlyBudget ?? 100,
                      lastActiveAt: (agent as any).updatedAt,
                    }}
                    variant="compact"
                    onAction={(action, id) => {
                      if (action === 'inspect') openInspector('agent', id);
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Recent execution logs */}
          <div className="rounded-xl border border-surface-border bg-surface-raised">
            <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">Recent Activity</h2>
              <button
                onClick={() => void fetchLogs()}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition"
              >
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              {logsLoading ? (
                <div className="py-8 text-center text-zinc-500 text-xs">Loading…</div>
              ) : logs.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">No activity yet</div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-surface-raised">
                    <tr className="text-xs text-zinc-500 uppercase">
                      <th className="px-4 py-2 text-left font-medium">Agent</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-left font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-t border-surface-border hover:bg-surface-overlay transition cursor-pointer"
                        onClick={() => log.taskId && openInspector('task', log.taskId)}
                      >
                        <td className="px-4 py-2 text-xs text-zinc-300">
                          {log.agent?.name ?? log.agentId.slice(0, 8)}
                        </td>
                        <td className={`px-4 py-2 text-xs font-medium ${STATUS_LOG_COLOR[log.status] ?? 'text-zinc-400'}`}>
                          {log.status}
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-400">
                          {log.evaluationScore != null ? (
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                log.evaluationScore >= 0.8
                                  ? 'bg-emerald-900 text-emerald-300'
                                  : log.evaluationScore >= 0.5
                                  ? 'bg-amber-900 text-amber-300'
                                  : 'bg-red-900 text-red-300'
                              }`}
                            >
                              {(log.evaluationScore * 100).toFixed(0)}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating AI Chat button ── */}
      <div className="fixed bottom-6 right-6 z-40">
        <AIChatButton onClick={() => setAiChatOpen(true)} />
      </div>

      {/* ── Overlay panels ── */}
      <DailyBriefingModal />
      <AIChatPanel isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)} />
      <OrgChartSidebar isOpen={orgChartOpen} onClose={() => setOrgChartOpen(false)} />
    </TenantShell>
  );
}


