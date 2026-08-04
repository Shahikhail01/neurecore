'use client';

/**
 * /departments/[id]/workspace — Department Workspace (Phase 5 + Phase 2 R2)
 *
 * The single page where all of a department's work lives.
 *
 * Phase 2 R2 additions:
 *   - Per-tab "+ New" buttons open modal forms (Task/Workflow/Routine/Project/Goal)
 *   - Row clicks open the right-side Inspector (workflow/routine/project/goal/member)
 *   - Members tab now uses /users/department/:id (Phase 2 backend)
 *   - Costs tab now uses /costs/department/:id (Phase 2 backend)
 *   - Dead QuickAction CTAs in Overview tab replaced with in-tab modal openers
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  ListTodo,
  GitBranch,
  Repeat,
  Briefcase,
  Target,
  Wallet,
  UserCog,
  Plus,
  ArrowLeft,
  Activity,
  Edit3,
  ChevronRight,
  UserPlus,
} from 'lucide-react';

import { PageShell, PageHero, GlassPanel } from '@neurecore/ui-visual';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { KpiCard } from '@/components/creatio/KpiCard';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton, ActionToolbar } from '@/components/creatio/ActionToolbar';
import { QuickAction } from '@/components/creatio/QuickAction';
import { Modal } from '@/components/creatio/Modal';
import { AgentCard } from '@/components/agent-card/AgentCard';
import { AreaChart } from '@/components/charts/AreaChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { CreateTaskForm } from '@/components/forms/CreateTaskForm';
import { CreateWorkflowForm } from '@/components/forms/CreateWorkflowForm';
import { CreateRoutineForm } from '@/components/forms/CreateRoutineForm';
import { CreateProjectForm } from '@/components/forms/CreateProjectForm';
import { CreateGoalForm } from '@/components/forms/CreateGoalForm';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useDepartmentStore } from '@/stores/departmentStore';
import { useInspectorStore } from '@/stores/inspectorStore';
import api from '@/services/api';
import { unwrapArrayOrEmpty, unwrapList } from '@/services/unwrap';

// ─── Types ────────────────────────────────────────────────────────────────
type WorkspaceTabId =
  | 'overview'
  | 'agents'
  | 'tasks'
  | 'workflows'
  | 'routines'
  | 'projects'
  | 'goals'
  | 'costs'
  | 'members';

interface TabDef {
  id: WorkspaceTabId;
  label: string;
  icon: typeof Users;
}

const TABS: TabDef[] = [
  { id: 'overview',   label: 'Overview',   icon: Activity },
  { id: 'agents',     label: 'Employees',     icon: Users },
  { id: 'tasks',      label: 'Tasks',      icon: ListTodo },
  { id: 'workflows',  label: 'Workflows',  icon: GitBranch },
  { id: 'routines',   label: 'Routines',   icon: Repeat },
  { id: 'projects',   label: 'Projects',   icon: Briefcase },
  { id: 'goals',      label: 'Goals',      icon: Target },
  { id: 'costs',      label: 'Costs',      icon: Wallet },
  { id: 'members',    label: 'Members',    icon: UserCog },
];

interface Member {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  isActive?: boolean;
}

interface DeptCostRow {
  agentId: string;
  agentName?: string;
  totalCostCents: number;
  recordCount: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function DepartmentWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useTenantAuth();
  const openInspector = useInspectorStore((s) => s.openInspector);

  const deptId = decodeURIComponent(params.id);

  const { departments: departmentsRaw, fetchDepartments, fetchDepartment } = useDepartmentStore();
  const { agents: agentsRaw, fetchAgents } = useAgentStore();
  const { tasks: tasksRaw, fetchTasks } = useTaskStore();
  const departments = Array.isArray(departmentsRaw) ? departmentsRaw : [];
  const agents = Array.isArray(agentsRaw) ? agentsRaw : [];
  const tasks = Array.isArray(tasksRaw) ? tasksRaw : [];
  const { workflows: workflowsRaw, fetchWorkflows } = useWorkflowStore();
  const workflows = Array.isArray(workflowsRaw) ? workflowsRaw : [];

  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('overview');
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [monthCostCents, setMonthCostCents] = useState(0);
  const [costLoading, setCostLoading] = useState(true);
  const [costRows, setCostRows] = useState<DeptCostRow[]>([]);

  // Modal state
  const [modal, setModal] = useState<null | 'task' | 'workflow' | 'routine' | 'project' | 'goal' | 'assign'>(null);

  const dept = departments.find((d) => d.id === deptId);

  // ── Data fetchers ────────────────────────────────────────────────────
  useEffect(() => {
    void fetchDepartment(deptId);
    void fetchDepartments();
  }, [deptId, fetchDepartment, fetchDepartments]);

  useEffect(() => {
    void fetchAgents(1, 200);
    void fetchTasks(1, 200);
    void fetchWorkflows(1, 200);
  }, [fetchAgents, fetchTasks, fetchWorkflows]);

  const deptAgents = useMemo(
    () => agents.filter((a) => (a as { departmentId?: string }).departmentId === deptId),
    [agents, deptId],
  );
  const deptTasks = useMemo(
    () => tasks.filter((t) => (t as { departmentId?: string }).departmentId === deptId),
    [tasks, deptId],
  );
  const deptWorkflows = useMemo(
    () => workflows.filter((w) => (w as { departmentId?: string }).departmentId === deptId),
    [workflows, deptId],
  );

  const runningAgents = useMemo(
    () => deptAgents.filter((a) => (a as { status?: string }).status === 'RUNNING').length,
    [deptAgents],
  );
  const completedTasks = useMemo(
    () => deptTasks.filter((t) => (t as { status?: string }).status === 'COMPLETED').length,
    [deptTasks],
  );
  const failedTasks = useMemo(
    () => deptTasks.filter((t) => (t as { status?: string }).status === 'FAILED').length,
    [deptTasks],
  );
  const activeWorkflows = useMemo(
    () => deptWorkflows.filter((w) => (w as { status?: string }).status === 'ACTIVE').length,
    [deptWorkflows],
  );
  const taskStatusDonut = useMemo(
    () => {
      const groups = new Map<string, number>();
      for (const t of deptTasks) {
        const status = ((t as { status?: string }).status ?? 'UNKNOWN') as string;
        groups.set(status, (groups.get(status) ?? 0) + 1);
      }
      const palette = [
        'var(--visual-glow-violet)',
        'var(--visual-glow-cyan)',
        'var(--visual-glow-amber)',
        'var(--visual-glow-emerald)',
        'var(--visual-glow-rose)',
        'var(--visual-glow-blue)',
      ];
      return Array.from(groups.entries()).map(([name, value], i) => ({
        name,
        value,
        color: palette[i % palette.length],
      }));
    },
    [deptTasks],
  );

  const tabButton = (
    kind: 'task' | 'workflow' | 'routine' | 'project' | 'goal',
    label: string,
  ) => (
    <ActionButton
      variant="primary"
      size="sm"
      icon={<Plus className="w-3.5 h-3.5" />}
      onClick={() => setModal(kind)}
    >
      {label}
    </ActionButton>
  );

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await api.get(`/users/department/${deptId}?limit=50`);
      setMembers(unwrapArrayOrEmpty(res));
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [deptId]);

  const fetchCosts = useCallback(async () => {
    setCostLoading(true);
    try {
      const [summary, breakdown] = await Promise.all([
        api
          .get(`/costs/department/${deptId}`)
          .then((r) => r?.data?.data ?? r?.data ?? r)
          .catch(() => null),
        api
          .get(`/costs/breakdown/by-agent?departmentId=${deptId}`)
          .then((r) => r?.data?.data ?? r?.data ?? r)
          .catch(() => []),
      ]);
      setMonthCostCents(Number(summary?.totalCostCents ?? 0));
      setCostRows(Array.isArray(breakdown) ? breakdown : []);
    } catch {
      setMonthCostCents(0);
      setCostRows([]);
    } finally {
      setCostLoading(false);
    }
  }, [deptId]);

  useEffect(() => {
    if (activeTab === 'members') void fetchMembers();
    if (activeTab === 'overview' || activeTab === 'costs') void fetchCosts();
  }, [activeTab, fetchMembers, fetchCosts]);

  const refreshAll = useCallback(() => {
    void fetchTasks(1, 200);
    void fetchWorkflows(1, 200);
    void fetchAgents(1, 200);
    if (activeTab === 'members') void fetchMembers();
    if (activeTab === 'costs' || activeTab === 'overview') void fetchCosts();
  }, [fetchTasks, fetchWorkflows, fetchAgents, fetchMembers, fetchCosts, activeTab]);

  if (!user) return null;

  if (!dept) {
    return (
      <TenantShell user={user}>
        <PageShell variant="default">
          <GlassPanel variant="panel" padding="lg" className="max-w-2xl mx-auto text-center">
            <Building2 className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
            <p className="text-sm text-zinc-300 font-medium">Department not found</p>
            <p className="text-xs text-zinc-500 mt-1 mb-4">
              The department ID {deptId} does not exist or you don't have access.
            </p>
            <Link href="/departments" className="nv-btn-accent inline-flex items-center gap-2">
              <ArrowLeft className="w-3 h-3" />
              Back to Departments
            </Link>
          </GlassPanel>
        </PageShell>
      </TenantShell>
    );
  }

  return (
    <TenantShell user={user}>
      <PageShell variant="default">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Breadcrumb ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Link href="/departments" className="hover:text-zinc-300 transition">
            Departments
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-zinc-300">{dept.name}</span>
          <ChevronRight className="w-3 h-3" />
          <span>Workspace</span>
        </div>

        {/* ── Workspace Header ───────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.3 }}
          className="card-surface p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="w-14 h-14 rounded-xl bg-accent-500/15 text-accent-500 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-zinc-100 truncate">{dept.name}</h1>
                  <StatusBadge status="ACTIVE" label="Active" />
                  {dept.harmonyScore !== undefined && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-state-success/15 text-state-success border border-state-success/30 font-medium">
                      Harmony {dept.harmonyScore}%
                    </span>
                  )}
                </div>
                {dept.description && (
                  <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{dept.description}</p>
                )}
                <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {deptAgents.length} agents
                  </span>
                  <span className="flex items-center gap-1">
                    <ListTodo className="w-3 h-3" />
                    {deptTasks.length} tasks
                  </span>
                  <span className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    {deptWorkflows.length} workflows
                  </span>
                </div>
              </div>
            </div>

            <ActionToolbar
              right={
                <>
                  <Link
                    href={`/departments/${encodeURIComponent(deptId)}/control-room`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-accent-500/30 px-3 py-2 text-xs font-medium text-accent-500 hover:bg-accent-500/10 transition"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Control Room
                  </Link>
                  <ActionButton
                    variant="secondary"
                    size="md"
                    icon={<Edit3 className="w-3.5 h-3.5" />}
                  >
                    Edit
                  </ActionButton>
                  <ActionButton
                    variant="primary"
                    size="md"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => router.push('/marketplace?tab=spawn')}
                  >
                    Add Agent
                  </ActionButton>
                </>
              }
            />
          </div>

          {/* Budget bar */}
          <div className="mt-5 pt-5 border-t border-surface-border">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" />
                Budget this month
              </span>
              <span className="text-zinc-300 font-mono">
                ${(monthCostCents / 100).toFixed(2)} / $1,000.00
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-overlay overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (monthCostCents / 100000) * 100)}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-accent-500"
              />
            </div>
          </div>
        </motion.section>

        {/* ── Tab Navigation ─────────────────────────────────────── */}
        <div className="border-b border-surface-border overflow-x-auto">
          <nav className="flex items-center gap-1 -mb-px min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    active
                      ? 'border-accent-500 text-zinc-100'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-surface-border'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === 'agents' && deptAgents.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-overlay text-zinc-400">
                      {deptAgents.length}
                    </span>
                  )}
                  {tab.id === 'tasks' && deptTasks.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-overlay text-zinc-400">
                      {deptTasks.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Per-tab header with + button ────────────────────────── */}
        {(activeTab === 'tasks' || activeTab === 'workflows' || activeTab === 'routines' ||
          activeTab === 'projects' || activeTab === 'goals' || activeTab === 'members') && (
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-200 capitalize">{activeTab}</h2>
            <div className="flex items-center gap-2">
              {activeTab === 'tasks' && tabButton('task', 'New Task')}
              {activeTab === 'workflows' && tabButton('workflow', 'New Workflow')}
              {activeTab === 'routines' && tabButton('routine', 'New Routine')}
              {activeTab === 'projects' && tabButton('project', 'New Project')}
              {activeTab === 'goals' && tabButton('goal', 'New Goal')}
              {activeTab === 'members' && (
                <ActionButton
                  variant="primary"
                  size="sm"
                  icon={<UserPlus className="w-3.5 h-3.5" />}
                  onClick={() => setModal('assign')}
                >
                  Assign User
                </ActionButton>
              )}
            </div>
          </div>
        )}

        {/* ── Tab Content ────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && (
              <OverviewTab
                deptId={deptId}
                deptName={dept.name}
                agentCount={deptAgents.length}
                runningAgents={runningAgents}
                completedTasks={completedTasks}
                failedTasks={failedTasks}
                activeWorkflows={activeWorkflows}
                monthCostCents={monthCostCents}
                costLoading={costLoading}
                taskStatusDonut={taskStatusDonut}
                onOpenModal={(m) => setModal(m)}
              />
            )}
            {activeTab === 'agents' && (
              <AgentsTab deptAgents={deptAgents} onInspect={(id) => openInspector('agent', id)} />
            )}
            {activeTab === 'tasks' && (
              <TasksTab deptTasks={deptTasks} onInspect={(id) => openInspector('task', id)} />
            )}
            {activeTab === 'workflows' && (
              <WorkflowsTab deptWorkflows={deptWorkflows} onInspect={(id) => openInspector('workflow', id)} />
            )}
            {activeTab === 'routines' && (
              <RoutinesTab
                agentIds={deptAgents.map((a) => a.id)}
                onInspect={(id) => openInspector('routine', id)}
              />
            )}
            {activeTab === 'projects' && (
              <ProjectsTab deptId={deptId} onInspect={(id) => openInspector('project', id)} />
            )}
            {activeTab === 'goals' && (
              <GoalsTab deptId={deptId} onInspect={(id) => openInspector('goal', id)} />
            )}
            {activeTab === 'costs' && (
              <CostsTab
                deptId={deptId}
                monthCostCents={monthCostCents}
                costRows={costRows}
                loading={costLoading}
              />
            )}
            {activeTab === 'members' && (
              <MembersTab
                members={members}
                loading={membersLoading}
                onInspect={(id) => openInspector('member', id)}
                onUnassign={async (id) => {
                  await api.post(`/users/${id}/unassign-department`);
                  void fetchMembers();
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      <Modal open={modal === 'task'} onClose={() => setModal(null)} title="New Task" description="Assign work to a department agent">
        <CreateTaskForm
          agents={deptAgents.map((a) => ({ id: a.id, name: a.name }))}
          onClose={() => setModal(null)}
          onCreated={() => refreshAll()}
        />
      </Modal>
      <Modal open={modal === 'workflow'} onClose={() => setModal(null)} title="New Workflow" description="Create an automation pipeline">
        <CreateWorkflowForm onClose={() => setModal(null)} onCreated={() => refreshAll()} />
      </Modal>
      <Modal open={modal === 'routine'} onClose={() => setModal(null)} title="New Routine" description="Schedule a recurring agent task">
        <CreateRoutineForm
          agents={deptAgents.map((a) => ({ id: a.id, name: a.name }))}
          onClose={() => setModal(null)}
          onCreated={() => refreshAll()}
        />
      </Modal>
      <Modal open={modal === 'project'} onClose={() => setModal(null)} title="New Project" description={`Project in ${dept.name}`}>
        <CreateProjectForm
          departmentId={deptId}
          onClose={() => setModal(null)}
          onCreated={() => refreshAll()}
        />
      </Modal>
      <Modal open={modal === 'goal'} onClose={() => setModal(null)} title="New Goal" description={`Goal for ${dept.name}`}>
        <CreateGoalForm
          departmentId={deptId}
          agents={deptAgents.map((a) => ({ id: a.id, name: a.name }))}
          onClose={() => setModal(null)}
          onCreated={() => refreshAll()}
        />
      </Modal>
      <Modal open={modal === 'assign'} onClose={() => setModal(null)} title="Assign User to Department" description="Add an existing tenant user to this department">
        <AssignUserForm
          departmentId={deptId}
          onClose={() => setModal(null)}
          onAssigned={() => {
            void fetchMembers();
          }}
        />
      </Modal>
      </PageShell>
    </TenantShell>
  );
}

// ─── AssignUserForm (inline; lives here to keep file count low) ───────────
function AssignUserForm({
  departmentId,
  onClose,
  onAssigned,
}: {
  departmentId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; email: string; firstName?: string; lastName?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/users?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`)
      .then((r) => {
        const list = unwrapArrayOrEmpty(r);
        setUsers(list);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [search]);

  const submit = async () => {
    if (!userId) {
      setError('Select a user');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post(`/users/${userId}/assign-department`, { departmentId });
      onAssigned();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to assign user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface-overlay border border-surface-border rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
      />
      <div className="max-h-64 overflow-y-auto divide-y divide-surface-border border border-surface-border rounded-md">
        {users.length === 0 && !loading && (
          <p className="p-4 text-xs text-zinc-500 text-center">No users found.</p>
        )}
        {users.map((u) => {
          const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setUserId(u.id)}
              className={`w-full text-left px-3 py-2 transition flex items-center gap-3 ${
                userId === u.id ? 'bg-accent-500/15' : 'hover:bg-surface-overlay'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-surface-overlay text-zinc-400 flex items-center justify-center text-xs font-semibold shrink-0">
                {(u.firstName?.[0] ?? u.email[0]).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-200 truncate">{fullName}</p>
                <p className="text-xs text-zinc-500 truncate">{u.email}</p>
              </div>
              {userId === u.id && <StatusBadge status="ACTIVE" />}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-state-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
        <ActionButton variant="ghost" size="md" onClick={onClose} disabled={loading}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" size="md" onClick={submit} disabled={loading || !userId}>
          {loading ? 'Assigning…' : 'Assign'}
        </ActionButton>
      </div>
    </div>
  );
}

// ─── Tab Components ───────────────────────────────────────────────────────

// Overview tab
function OverviewTab(props: {
  deptId: string;
  deptName: string;
  agentCount: number;
  runningAgents: number;
  completedTasks: number;
  failedTasks: number;
  activeWorkflows: number;
  monthCostCents: number;
  costLoading: boolean;
  taskStatusDonut: { name: string; value: number; color: string }[];
  onOpenModal: (m: 'task' | 'workflow' | 'routine' | 'project' | 'goal' | 'assign') => void;
}) {
  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Employees"
          value={props.agentCount}
          delta={props.runningAgents}
          deltaLabel="running"
          color="ops"
          icon={<Users className="w-4 h-4" />}
        />
        <KpiCard
          label="Completed Tasks"
          value={props.completedTasks}
          color="profit"
          icon={<ListTodo className="w-4 h-4" />}
        />
        <KpiCard
          label="Active Workflows"
          value={props.activeWorkflows}
          color="strategy"
          icon={<GitBranch className="w-4 h-4" />}
        />
        <KpiCard
          label="Cost MTD"
          value={props.costLoading ? '—' : `$${(props.monthCostCents / 100).toFixed(2)}`}
          color="warn"
          icon={<Wallet className="w-4 h-4" />}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card-surface p-4">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">Task volume</h3>
          <AreaChart
            data={[]}
            dataKey="value"
            xKey="timestamp"
            color="var(--visual-glow-violet)"
            loading={false}
            height={180}
          />
          <p className="text-xs text-zinc-500 text-center mt-2">
            Per-department task chart coming soon.
          </p>
        </div>
        <div className="card-surface p-4">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">Task status</h3>
          <DonutChart
            data={
              props.taskStatusDonut.length > 0
                ? props.taskStatusDonut
                : [{ name: 'No data', value: 1, color: 'var(--visual-glow-cyan)' }]
            }
            nameKey="name"
            valueKey="value"
            loading={false}
            height={180}
          />
        </div>
      </div>

      {/* Quick actions — now open in-tab modals */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Quick actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction
            label="New Task"
            description="Assign work"
            icon={<ListTodo className="w-5 h-5" />}
            accent="info"
            onClick={() => props.onOpenModal('task')}
          />
          <QuickAction
            label="New Workflow"
            description="Automate steps"
            icon={<GitBranch className="w-5 h-5" />}
            accent="accent"
            onClick={() => props.onOpenModal('workflow')}
          />
          <QuickAction
            label="New Routine"
            description="Schedule recurring"
            icon={<Repeat className="w-5 h-5" />}
            accent="warning"
            onClick={() => props.onOpenModal('routine')}
          />
          <QuickAction
            label="New Goal"
            description="Define objective"
            icon={<Target className="w-5 h-5" />}
            accent="success"
            onClick={() => props.onOpenModal('goal')}
          />
        </div>
      </div>
    </div>
  );
}

// Agents tab
function AgentsTab({ deptAgents, onInspect }: { deptAgents: unknown[]; onInspect: (id: string) => void }) {
  if (deptAgents.length === 0) {
    return (
      <EmptyTab
        icon={<Users className="w-10 h-10" />}
        title="No employees in this department yet"
        description="Spawn your first employee from the marketplace."
      />
    );
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {deptAgents.map((agent) => {
          const a = agent as {
            id: string; name: string; status: string; type?: string;
            updatedAt?: string; model?: { name?: string };
            department?: { name?: string }; monthlyBudget?: number;
          };
          return (
            <AgentCard
              key={a.id}
              agent={{
                id: a.id,
                name: a.name,
                type: a.type ?? 'FUNCTIONAL',
                status: a.status as never,
                department: a.department?.name,
                model: a.model?.name ?? 'gpt-4o',
                workload: 0,
                taskCount: 0,
                successRate: 0,
                budgetUsed: 0,
                budgetTotal: a.monthlyBudget ?? 100,
                lastActiveAt: a.updatedAt,
              }}
              variant="compact"
              onAction={(action, id) => action === 'inspect' && onInspect(id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// Tasks tab — board-style summary
function TasksTab({ deptTasks, onInspect }: { deptTasks: unknown[]; onInspect: (id: string) => void }) {
  if (deptTasks.length === 0) {
    return (
      <EmptyTab
        icon={<ListTodo className="w-10 h-10" />}
        title="No tasks in this department"
        description="Tasks assigned to agents in this department will appear here."
      />
    );
  }

  const columns = [
    { id: 'PENDING', label: 'Pending', color: 'border-zinc-700' },
    { id: 'RUNNING', label: 'Running', color: 'border-[color:var(--state-info)]' },
    { id: 'COMPLETED', label: 'Completed', color: 'border-[color:var(--state-success)]' },
    { id: 'FAILED', label: 'Failed', color: 'border-[color:var(--state-danger)]' },
  ] as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {columns.map((col) => {
        const items = deptTasks.filter((t) => {
          const task = t as { status: string };
          if (col.id === 'RUNNING') return task.status === 'RUNNING' || task.status === 'IN_PROGRESS';
          return task.status === col.id;
        });
        return (
          <div key={col.id} className={`card-surface p-3 border-t-2 ${col.color}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">{col.label}</h3>
              <span className="text-xs text-zinc-500">{items.length}</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-xs text-zinc-600 py-4 text-center">Empty</p>
              ) : (
                items.slice(0, 8).map((task) => {
                  const t = task as {
                    id: string; title: string; priority: string;
                    agent?: { name: string }; evaluationScore?: number;
                  };
                  return (
                    <button
                      key={t.id}
                      onClick={() => onInspect(t.id)}
                      className="w-full text-left p-2 rounded-md bg-surface-overlay hover:bg-surface-border transition"
                    >
                      <p className="text-xs font-medium text-zinc-200 line-clamp-2">{t.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={t.priority} />
                        {t.evaluationScore != null && (
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {(t.evaluationScore * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
              {items.length > 8 && (
                <p className="text-xs text-zinc-500 text-center pt-1">
                  +{items.length - 8} more
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Workflows tab
function WorkflowsTab({
  deptWorkflows,
  onInspect,
}: {
  deptWorkflows: unknown[];
  onInspect: (id: string) => void;
}) {
  if (deptWorkflows.length === 0) {
    return (
      <EmptyTab
        icon={<GitBranch className="w-10 h-10" />}
        title="No workflows in this department"
        description="Create workflows to automate recurring agent tasks."
      />
    );
  }
  return (
    <div className="card-surface divide-y divide-surface-border">
      {deptWorkflows.map((wf) => {
        const w = wf as { id: string; name: string; isActive: boolean; agent?: { name: string } };
        return (
          <button
            key={w.id}
            onClick={() => onInspect(w.id)}
            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-surface-overlay transition"
          >
            <GitBranch className="w-4 h-4 text-zinc-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{w.name}</p>
              {w.agent && (
                <p className="text-xs text-zinc-500 truncate">{w.agent.name}</p>
              )}
            </div>
            <StatusBadge status={w.isActive ? 'ACTIVE' : 'PAUSED'} />
          </button>
        );
      })}
    </div>
  );
}

// Routines tab
function RoutinesTab({
  agentIds,
  onInspect,
}: {
  agentIds: string[];
  onInspect: (id: string) => void;
}) {
  const [routines, setRoutines] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoutines = useCallback(() => {
    if (agentIds.length === 0) {
      setRoutines([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ids = agentIds.join(',');
    api
      .get(`/routines?ownerAgentIds=${ids}&limit=50`)
      .then((res) => {
        const data = unwrapList(res);
        setRoutines(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => setRoutines([]))
      .finally(() => setLoading(false));
  }, [agentIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchRoutines();
  }, [fetchRoutines]);

  if (loading) return <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading…</div>;
  if (routines.length === 0) {
    return (
      <EmptyTab
        icon={<Repeat className="w-10 h-10" />}
        title="No routines in this department"
        description="Routines owned by agents in this department will appear here."
      />
    );
  }
  return (
    <div className="card-surface divide-y divide-surface-border">
      {routines.map((routine) => {
        const r = routine as { id: string; name: string; status: string; description?: string };
        return (
          <button
            key={r.id}
            onClick={() => onInspect(r.id)}
            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-surface-overlay transition"
          >
            <Repeat className="w-4 h-4 text-zinc-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{r.name}</p>
              {r.description && (
                <p className="text-xs text-zinc-500 truncate">{r.description}</p>
              )}
            </div>
            <StatusBadge status={r.status} />
          </button>
        );
      })}
    </div>
  );
}

// Projects tab
function ProjectsTab({
  deptId,
  onInspect,
}: {
  deptId: string;
  onInspect: (id: string) => void;
}) {
  const [projects, setProjects] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/projects?departmentId=${deptId}&limit=50`)
      .then((res) => {
        const data = unwrapList(res);
        setProjects(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [deptId]);

  if (loading) return <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading…</div>;
  if (projects.length === 0) {
    return (
      <EmptyTab
        icon={<Briefcase className="w-10 h-10" />}
        title="No projects in this department"
        description="Create projects to track deliverables and timelines."
      />
    );
  }
  return (
    <div className="card-surface divide-y divide-surface-border">
      {projects.map((proj) => {
        const p = proj as { id: string; name: string; status: string; description?: string; targetDate?: string };
        return (
          <button
            key={p.id}
            onClick={() => onInspect(p.id)}
            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-surface-overlay transition"
          >
            <Briefcase className="w-4 h-4 text-zinc-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{p.name}</p>
              {p.description && (
                <p className="text-xs text-zinc-500 truncate">{p.description}</p>
              )}
            </div>
            {p.targetDate && (
              <span className="text-xs text-zinc-500">
                {new Date(p.targetDate).toLocaleDateString()}
              </span>
            )}
            <StatusBadge status={p.status} />
          </button>
        );
      })}
    </div>
  );
}

// Goals tab
function GoalsTab({
  deptId,
  onInspect,
}: {
  deptId: string;
  onInspect: (id: string) => void;
}) {
  const [goals, setGoals] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/goals?departmentId=${deptId}&limit=50`)
      .then((res) => {
        const data = unwrapList(res);
        setGoals(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => setGoals([]))
      .finally(() => setLoading(false));
  }, [deptId]);

  if (loading) return <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading…</div>;
  if (goals.length === 0) {
    return (
      <EmptyTab
        icon={<Target className="w-10 h-10" />}
        title="No goals in this department"
        description="Define objectives and track progress at the department level."
      />
    );
  }
  return (
    <div className="space-y-2">
      {goals.map((goal) => {
        const g = goal as {
          id: string; title: string; status: string; progress: number;
          level?: string; ownerAgent?: { name?: string };
        };
        return (
          <button
            key={g.id}
            onClick={() => onInspect(g.id)}
            className="w-full text-left card-surface p-4 hover:bg-surface-overlay transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-200">{g.title}</p>
                {g.ownerAgent?.name && (
                  <p className="text-xs text-zinc-500 mt-0.5">Owner: {g.ownerAgent.name}</p>
                )}
              </div>
              <StatusBadge status={g.status} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                <div
                  className="h-full bg-accent-500 transition-all"
                  style={{ width: `${Math.min(100, g.progress ?? 0)}%` }}
                />
              </div>
              <span className="text-xs font-mono text-zinc-400 w-10 text-right">
                {g.progress ?? 0}%
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Costs tab
function CostsTab({
  deptId,
  monthCostCents,
  costRows,
  loading,
}: {
  deptId: string;
  monthCostCents: number;
  costRows: DeptCostRow[];
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="MTD Cost"
          value={loading ? '—' : `$${(monthCostCents / 100).toFixed(2)}`}
          color="warn"
          icon={<Wallet className="w-4 h-4" />}
        />
        <KpiCard
          label="Top Agent"
          value={loading ? '—' : costRows[0]?.agentName ?? '—'}
          color="ops"
        />
        <KpiCard
          label="Active Employees"
          value={loading ? '—' : costRows.length}
          color="strategy"
        />
      </div>

      <div className="card-surface divide-y divide-surface-border">
        {loading ? (
          <p className="p-8 text-center text-sm text-zinc-500">Loading…</p>
        ) : costRows.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            No cost records yet for department <code className="text-zinc-400">{deptId.slice(0, 8)}…</code>
          </p>
        ) : (
          costRows.map((row) => (
            <div key={row.agentId} className="px-4 py-3 flex items-center gap-3">
              <Wallet className="w-4 h-4 text-zinc-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">
                  {row.agentName ?? row.agentId.slice(0, 8) + '…'}
                </p>
                <p className="text-xs text-zinc-500">{row.recordCount} records</p>
              </div>
              <span className="text-sm font-mono text-zinc-300">
                ${(row.totalCostCents / 100).toFixed(4)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Members tab
function MembersTab({
  members,
  loading,
  onInspect,
  onUnassign,
}: {
  members: Member[];
  loading: boolean;
  onInspect: (id: string) => void;
  onUnassign: (id: string) => void;
}) {
  if (loading) return <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading…</div>;
  if (members.length === 0) {
    return (
      <EmptyTab
        icon={<UserCog className="w-10 h-10" />}
        title="No members assigned"
        description="Use the 'Assign User' button above to add a tenant member to this department."
      />
    );
  }
  return (
    <div className="card-surface divide-y divide-surface-border">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => onInspect(m.id)}
            className="w-9 h-9 rounded-full bg-accent-500/15 text-accent-500 flex items-center justify-center text-sm font-semibold shrink-0 hover:bg-accent-500/25 transition"
            title="View member"
          >
            {(m.firstName?.[0] ?? m.email[0]).toUpperCase()}
          </button>
          <button
            onClick={() => onInspect(m.id)}
            className="flex-1 min-w-0 text-left"
          >
            <p className="text-sm font-medium text-zinc-200 truncate">
              {m.firstName} {m.lastName}
            </p>
            <p className="text-xs text-zinc-500 truncate">{m.email}</p>
          </button>
          <StatusBadge status={m.role} />
          {m.isActive !== undefined && (
            <StatusBadge status={m.isActive ? 'ACTIVE' : 'INACTIVE'} />
          )}
          <button
            onClick={() => onUnassign(m.id)}
            className="text-xs text-zinc-500 hover:text-state-danger transition px-2 py-1"
            title="Remove from department"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State Helper ───────────────────────────────────────────────────
function EmptyTab({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="card-surface p-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-surface-overlay text-zinc-500 flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">{description}</p>
    </div>
  );
}
