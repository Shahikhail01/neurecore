'use client';

/**
 * /departments — Departments roster (Phase 10)
 *
 * Creatio-style 3-tab page replacing the old flat /departments + /org-chart routes.
 *
 *   1. Departments  — KPI strip + grid of department cards + create CTA
 *   2. Org Chart    — hierarchical tree visualization (root → child depts)
 *   3. Templates    — 9 dept template packs (info-only, contact admin to deploy)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Users,
  GitBranch,
  Layers,
  ChevronRight,
  ChevronDown,
  Plus,
  RefreshCw,
  Briefcase,
  ArrowRight,
  Activity,
  Target,
  TrendingUp,
  Wallet,
  Headphones,
  Code,
  ShieldCheck,
  Megaphone,
  DollarSign,
  Sparkles,
  ExternalLink,
  ListTodo,
  Repeat,
} from 'lucide-react';

import { PageShell, PageHero } from '@neurecore/ui-visual';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { KpiCard } from '@/components/creatio/KpiCard';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { QuickAction } from '@/components/creatio/QuickAction';
import api from '@/services/api';
import { unwrapArrayOrEmpty } from '@/services/unwrap';
import { departmentTemplatesService, type DepartmentTemplate } from '@/services/department-templates.service';
import type { Department, Agent } from '@/shared/types/domain.types';
import { OrgChartPanel } from '@/features/org-chart/components/OrgChartPanel';

// ─── Types ────────────────────────────────────────────────────────────────
type RosterTab =
  | 'departments'
  | 'org-chart'
  | 'templates'
  | 'tasks'
  | 'workflows'
  | 'routines'
  | 'goals'
  | 'projects';

interface TemplatePack {
  slug: string;
  name: string;
  description: string;
  category: string;
  departmentCount: number;
  agentCount: number;
  icon: typeof Sparkles;
  accent: 'accent' | 'success' | 'warning' | 'info' | 'strategy' | 'danger';
}

const TABS: { id: RosterTab; label: string; icon: typeof Building2 }[] = [
  { id: 'departments', label: 'Departments', icon: Building2 },
  { id: 'org-chart',   label: 'Org Chart',   icon: GitBranch },
  { id: 'tasks',       label: 'Tasks',       icon: ListTodo },
  { id: 'workflows',   label: 'Workflows',   icon: GitBranch },
  { id: 'routines',    label: 'Routines',    icon: Repeat },
  { id: 'goals',       label: 'Goals',       icon: Target },
  { id: 'projects',    label: 'Projects',    icon: Briefcase },
  { id: 'templates',   label: 'Templates',   icon: Layers },
];

// Template pack icon/accent rotation
const PACK_ACCENTS: Array<TemplatePack['accent']> = ['accent', 'success', 'warning', 'info', 'strategy', 'danger'];
const PACK_ICONS: Array<typeof Sparkles> = [Sparkles, Briefcase, Wallet, Code, Building2, Activity, TrendingUp, ShieldCheck];

function packIcon(index: number): typeof Sparkles {
  return PACK_ICONS[index % PACK_ICONS.length];
}
function packAccent(index: number): TemplatePack['accent'] {
  return PACK_ACCENTS[index % PACK_ACCENTS.length];
}

function templateToPack(t: DepartmentTemplate, index: number): TemplatePack {
  return {
    slug: t.slug,
    name: t.name,
    description: t.description ?? 'Department template',
    category: t.category ?? 'General',
    departmentCount: t.structure?.length ?? 0,
    agentCount: t.structure?.filter((s) => s.headAgentType).length ?? 0,
    icon: packIcon(index),
    accent: packAccent(index),
  };
}

// Department accent rotation
const DEPT_ACCENTS = ['accent', 'success', 'warning', 'info', 'strategy'] as const;

// ─── Page ─────────────────────────────────────────────────────────────────
export default function DepartmentsRosterPage() {
  const user = useTenantAuth();
  const [activeTab, setActiveTab] = useState<RosterTab>('departments');

  // Read tab from URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = new URL(window.location.href).searchParams.get('tab') as RosterTab | null;
    if (t && TABS.find((tab) => tab.id === t)) setActiveTab(t);
  }, []);

  // Redirect projects tab to /projects pipeline
  useEffect(() => {
    if (activeTab === 'projects' && typeof window !== 'undefined') {
      window.location.href = '/projects';
    }
  }, [activeTab]);

  const setTab = (t: RosterTab) => {
    setActiveTab(t);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', t);
      window.history.replaceState(null, '', url.toString());
    }
  };

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <PageShell variant="default">
        <PageHero
          eyebrow="Organization"
          title="Departments"
          subtitle="Manage your organization structure, view the hierarchy, and deploy templates."
        />
      <div className="max-w-7xl mx-auto space-y-5">
        {/* ── Page Header ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="hidden"
        >
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-status-strategy/15 text-status-strategy flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            Departments
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage your organization structure, view the hierarchy, and deploy templates.
          </p>
        </motion.div>

        {/* ── Tab Navigation ──────────────────────────────────── */}
        <div className="border-b border-surface-border">
          <nav className="flex items-center gap-1 -mb-px">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                    active
                      ? 'border-accent-500 text-zinc-100'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-surface-border'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Tab Content ─────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'departments' && <DepartmentsTab />}
            {activeTab === 'org-chart' && <OrgChartTab />}
            {activeTab === 'templates' && <TemplatesTab />}
            {(activeTab === 'tasks' || activeTab === 'workflows' || activeTab === 'routines' || activeTab === 'goals') && <WorkItemsTab kind={activeTab} />}
          </motion.div>
        </AnimatePresence>
      </div>
      </PageShell>
    </TenantShell>
  );
}

// ─── Tab 1: Departments ───────────────────────────────────────────────────
function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, agentRes] = await Promise.all([
        api.get('/departments?limit=100'),
        api.get('/agents?limit=100'),
      ]);
      setDepartments(unwrapArrayOrEmpty(deptRes) as Department[]);
      setAgents(unwrapArrayOrEmpty(agentRes) as Agent[]);
    } catch {
      setDepartments([]);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const visible = departments.filter((d) =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const agentsByDept = (deptId: string) => agents.filter((a) => a.departmentId === deptId);
  const unassigned = agents.filter((a) => !a.departmentId);

  const totalAgents = agents.length;
  const runningAgents = agents.filter((a) => a.status === 'ACTIVE' || a.status === 'RUNNING').length;
  const rootDepts = departments.filter((d) => !d.parentId).length;
  const subDepts = departments.filter((d) => d.parentId).length;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Departments" value={departments.length} color="ops" icon={<Building2 className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Total Employees" value={totalAgents} color="strategy" icon={<Users className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Running" value={runningAgents} color="profit" icon={<Activity className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Root / Sub" value={`${rootDepts} / ${subDepts}`} color="neutral" icon={<GitBranch className="w-4 h-4" />} loading={loading} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <input
            aria-label="Search departments"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search departments…"
            className="w-full pl-3 pr-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent-500"
          />
        </div>
        <button
          onClick={() => void fetchAll()}
          className="w-8 h-8 rounded-md border border-surface-border text-zinc-500 hover:text-zinc-200 hover:bg-surface-overlay transition flex items-center justify-center"
          aria-label="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <Link
          href="?tab=templates"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-surface-border text-zinc-300 hover:bg-surface-overlay transition"
        >
          <Layers className="w-3.5 h-3.5" />
          Browse Templates
        </Link>
      </div>

      {/* Departments grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Building2 className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">
            {departments.length === 0 ? 'No departments yet' : 'No departments match your search'}
          </p>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
            {departments.length === 0
              ? 'Deploy a department template to bootstrap your organization structure.'
              : 'Try a different search term.'}
          </p>
          {departments.length === 0 && (
            <Link
              href="?tab=templates"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium transition"
            >
              <Layers className="w-3 h-3" />
              Browse Templates
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map((dept, idx) => {
            const accent = DEPT_ACCENTS[idx % DEPT_ACCENTS.length];
            const deptAgents = agentsByDept(dept.id);
            const runningCount = deptAgents.filter((a) => a.status === 'ACTIVE' || a.status === 'RUNNING').length;
            const isExpanded = expanded.has(dept.id);
            return (
              <motion.div
                key={dept.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="card-surface overflow-hidden"
              >
                <Link
                  href={`/departments/${encodeURIComponent(dept.id)}/workspace`}
                  className="block p-4 card-interactive"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      accent === 'accent'  ? 'bg-accent-500/15 text-accent-500' :
                      accent === 'success' ? 'bg-state-success/15 text-state-success' :
                      accent === 'warning' ? 'bg-state-warning/15 text-state-warning' :
                      accent === 'info'    ? 'bg-state-info/15 text-state-info' :
                                              'bg-status-strategy/15 text-status-strategy'
                    }`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-semibold text-zinc-100 truncate">{dept.name}</h2>
                        {dept.harmonyScore != null && (
                          <StatusBadge status={dept.harmonyScore >= 70 ? 'ACTIVE' : 'WARNING'} label={`Harmony ${dept.harmonyScore}%`} />
                        )}
                      </div>
                      {dept.description && (
                        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{dept.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-xs">
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Users className="w-3 h-3" />
                          {deptAgents.length} {deptAgents.length === 1 ? 'agent' : 'agents'}
                        </span>
                        {runningCount > 0 && (
                          <span className="text-state-profit flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-state-success" />
                            {runningCount} running
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-500 shrink-0" />
                  </div>
                </Link>

                <div className="px-4 pb-2 flex items-center gap-2">
                  <Link
                    href={`/departments/${encodeURIComponent(dept.id)}/control-room`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-accent-500/30 text-accent-500 hover:bg-accent-500/10 transition"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Control Room
                  </Link>
                  <Link
                    href={`/departments/${encodeURIComponent(dept.id)}/workspace`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-surface-border text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay transition"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    Workspace
                  </Link>
                </div>

                {/* Quick expand: see agent names */}
                <button
                  onClick={() => toggleExpand(dept.id)}
                  className="w-full px-4 py-2 border-t border-surface-border text-xs text-zinc-500 hover:text-zinc-300 hover:bg-surface-overlay transition flex items-center justify-center gap-1"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {deptAgents.length > 0
                    ? `View ${deptAgents.length} agent${deptAgents.length === 1 ? '' : 's'}`
                    : 'No employees yet'}
                </button>
                <AnimatePresence>
                  {isExpanded && deptAgents.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-surface-border"
                    >
                      <div className="p-3 space-y-1 bg-surface-overlay">
                        {deptAgents.map((agent) => (
                          <div key={agent.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              agent.status === 'ACTIVE' || agent.status === 'RUNNING' ? 'bg-state-success' :
                              agent.status === 'ERROR' ? 'bg-state-danger' :
                              agent.status === 'PAUSED' ? 'bg-state-warning' :
                              'bg-zinc-500/50'
                            }`} />
                            <span className="text-zinc-300 truncate flex-1">{agent.name}</span>
                            <span className="text-[10px] text-zinc-500">{agent.status}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Unassigned bucket */}
      {unassigned.length > 0 && !loading && (
        <div className="card-surface border-dashed">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-overlay text-zinc-400 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-300">Unassigned agents</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {unassigned.length} agents without a department. Open one and assign a department.
                </p>
              </div>
              <Link
                href="/marketplace?tab=agents"
                className="text-xs text-accent-500 hover:underline shrink-0"
              >
                Manage agents →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Org Chart ──────────────────────────────────────────────────────
function OrgChartTab() {
  return <OrgChartPanel />;
}

// ─── Tab 3: Templates ──────────────────────────────────────────────────────
function TemplatesTab() {
  const [templates, setTemplates] = useState<DepartmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const list = await departmentTemplatesService.list();
      setTemplates(Array.isArray(list) ? list : []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchTemplates(); }, [fetchTemplates]);

  const packs: TemplatePack[] = useMemo(
    () => templates.map((t, i) => templateToPack(t, i)),
    [templates],
  );

  return (
    <div className="space-y-4">
      {/* Hero banner */}
      <div className="card-surface p-5 bg-gradient-to-r from-accent-500/10 via-status-strategy/10 to-transparent border-accent-500/30">
        <div className="flex items-center gap-3">
          <Layers className="w-8 h-8 text-accent-500 shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Department template library</h2>
            <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl">
              {templates.length} pre-built org templates ready to deploy. Each pack includes a full department tree with head agents.
              Contact your platform admin to deploy — tenants can't deploy templates themselves yet.
            </p>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
          ))}
        </div>
      ) : packs.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Layers className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">No templates available</p>
          <p className="text-xs text-zinc-500 mt-1">Check back later or contact your platform admin.</p>
        </div>
      ) : (
        <>
          {/* Quick categories */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction
              label="Lean startups"
              description="For early-stage teams"
              icon={<Sparkles className="w-5 h-5" />}
              accent="accent"
              href="#startup-lean"
            />
            <QuickAction
              label="E-Commerce"
              description="Online retail"
              icon={<Wallet className="w-5 h-5" />}
              accent="warning"
              href="#ecommerce"
            />
            <QuickAction
              label="SaaS"
              description="Software companies"
              icon={<Code className="w-5 h-5" />}
              accent="info"
              href="#saas-company"
            />
            <QuickAction
              label="Enterprise"
              description="Full corporate structure"
              icon={<ShieldCheck className="w-5 h-5" />}
              accent="accent"
              href="#enterprise-corp"
            />
          </div>

          {/* Template grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {packs.map((pack) => {
              const Icon = pack.icon;
              return (
                <motion.div
                  key={pack.slug}
                  id={pack.slug}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="card-surface p-5 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      pack.accent === 'accent'  ? 'bg-accent-500/15 text-accent-500' :
                      pack.accent === 'success' ? 'bg-state-success/15 text-state-success' :
                      pack.accent === 'warning' ? 'bg-state-warning/15 text-state-warning' :
                      pack.accent === 'info'    ? 'bg-state-info/15 text-state-info' :
                      pack.accent === 'danger'  ? 'bg-state-danger/15 text-state-danger' :
                                                  'bg-status-strategy/15 text-status-strategy'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-overlay text-zinc-400 border border-surface-border">
                      {pack.category}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-zinc-100">{pack.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2 min-h-[32px]">
                    {pack.description}
                  </p>

                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-surface-border">
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {pack.departmentCount} depts
                    </span>
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {pack.agentCount} agents
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-surface-border">
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <Headphones className="w-3 h-3" />
                      Contact admin to deploy
                      <ExternalLink className="w-3 h-3 ml-auto" />
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Bottom note */}
      <div className="card-surface p-4 bg-state-info/5 border-state-info/30 text-center">
        <p className="text-xs text-zinc-400">
          <span className="text-state-info font-medium">Tip:</span> Each template pack is a complete org tree. After deployment, head agents
          spawn automatically and you can customize within each department's workspace.
        </p>
      </div>
    </div>
  );
}

// ─── Work items views: tasks / workflows / routines / goals / projects ─────
const WORK_ITEM_KIND: Record<'tasks' | 'workflows' | 'routines' | 'goals' | 'projects', { title: string; icon: typeof ListTodo; description: string; empty: string; accent: string }> = {
  tasks:      { title: 'Tasks',      icon: ListTodo, description: 'Open and recent tasks assigned across your departments.',           empty: 'No tasks yet. Tasks are created from department workspaces.',                    accent: 'text-accent-500' },
  workflows:  { title: 'Workflows',  icon: GitBranch, description: 'Multi-step automations owned by your departments.',                 empty: 'No workflows yet. Build them from any department workspace.',                   accent: 'text-status-info' },
  routines:   { title: 'Routines',   icon: Repeat,   description: 'Scheduled jobs running on cron or triggers.',                       empty: 'No routines yet. Routines are scheduled automations in a department workspace.', accent: 'text-status-warning' },
  goals:      { title: 'Goals',      icon: Target,   description: 'OKRs and outcomes tracked across the organisation.',                empty: 'No goals yet. Define outcomes in any department workspace.',                     accent: 'text-status-strategy' },
  projects:   { title: 'Projects',   icon: Briefcase, description: 'Cross-department initiatives and timelines.',                       empty: 'No projects yet. Projects span multiple departments.',                            accent: 'text-status-success' },
};

function WorkItemsTab({ kind }: { kind: 'tasks' | 'workflows' | 'routines' | 'goals' | 'projects' }) {
  const cfg = WORK_ITEM_KIND[kind];
  const Icon = cfg.icon;
  return (
    <div className="space-y-4">
      <div className="card-surface p-5 bg-gradient-to-r from-surface-overlay via-surface-raised to-transparent border-surface-border">
        <div className="flex items-center gap-3">
          <Icon className={`w-7 h-7 ${cfg.accent}`} />
          <div>
            <h2 className="text-base font-semibold text-zinc-100">{cfg.title}</h2>
            <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl">{cfg.description}</p>
          </div>
        </div>
      </div>
      <div className="card-surface p-12 flex flex-col items-center justify-center text-center gap-3 border-dashed">
        <Icon className={`w-12 h-12 ${cfg.accent} opacity-40`} />
        <p className="text-sm font-medium text-zinc-200">{cfg.empty}</p>
        <p className="text-xs text-zinc-500 max-w-md">
          Open any department from the <span className="text-zinc-300">Departments</span> tab and manage its{' '}
          {cfg.title.toLowerCase()} from its workspace.
        </p>
        <a
          href="/departments?tab=departments"
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-surface-overlay hover:bg-surface-border text-zinc-200 transition"
        >
          Go to Departments
          <ChevronRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
