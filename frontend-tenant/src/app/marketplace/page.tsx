'use client';

/**
 * /marketplace — Agent Marketplace (Phase 6)
 *
 * Creatio-style marketplace with 3 tabs:
 *   1. My Agents      — tenant's spawned agents, with status filter + view toggle + actions
 *   2. Agent Templates — 104 platform templates browsable (uses Phase 1 Gap 2 fix)
 *   3. Connectors      — CRM connector config
 *
 * Spawn modal uses Phase 1 Gap 3 endpoint:
 *   POST /deploy/agents/from-template/:templateId (loosened to OWNER/ADMIN)
 *
 * Layout:
 *   ┌─ Header ─────────────────────────────────────────────┐
 *   │  [Store icon] Marketplace    [search]               │
 *   ├─ Tabs ───────────────────────────────────────────────┤
 *   │  My Agents │ Agent Templates │ Connectors          │
 *   ├─ Tab content ───────────────────────────────────────┤
 *   │  (active tab)                                      │
 *   └────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Store,
  Users,
  Sparkles,
  Plug,
  Search,
  Plus,
  X,
  PlayCircle,
  PauseCircle,
  Archive,
  RefreshCw,
  Eye,
  LayoutGrid,
  List as ListIcon,
  CheckCircle2,
  Building2,
  Briefcase,
  Package,
  Loader2,
} from 'lucide-react';

import { PageShell, PageHero } from '@neurecore/ui-visual';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { AgentCard } from '@/components/agent-card/AgentCard';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton, ActionToolbar } from '@/components/creatio/ActionToolbar';
import { KpiCard } from '@/components/creatio/KpiCard';
import { QuickAction } from '@/components/creatio/QuickAction';
import { useInspectorStore } from '@/stores/inspectorStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import { unwrapArrayOrEmpty, unwrapList } from '@/services/unwrap';
import { connectorsService, type Connector } from '@/services/connectors.service';
import { packagesService, type TenantPackage, type DeployPackagePreview } from '@/services/packages.service';

// ─── Types ────────────────────────────────────────────────────────────────
interface AgentRaw {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  isActive: boolean;
  monthlyBudget?: number;
  budgetUsed?: number;
  createdAt: string;
  updatedAt: string;
  department?: { id?: string; name?: string };
  model?: { name?: string };
  templateId?: string | null;
  metadata?: Record<string, unknown> | null;
  _count?: { tasks: number };
}

interface AgentTemplateRaw {
  id: string;
  name: string;
  description?: string;
  type: string;
  model?: string;
  version: string;
  isPublic: boolean;
  permissions?: string[];
  createdAt: string;
}

type MarketplaceTab = 'agents' | 'templates' | 'connectors' | 'packages';
type ViewMode = 'grid' | 'list';
type FilterStatus = 'ALL' | 'ACTIVE' | 'RUNNING' | 'PAUSED' | 'IDLE' | 'ERROR' | 'ARCHIVED' | 'DEPRECATED';

const TABS: { id: MarketplaceTab; label: string; icon: typeof Users }[] = [
  { id: 'agents',     label: 'My Employees',      icon: Users },
  { id: 'templates',  label: 'Agent Templates', icon: Sparkles },
  { id: 'packages',   label: 'Packages',       icon: Briefcase },
  { id: 'connectors', label: 'Connectors',     icon: Plug },
];

const STATUS_FILTERS: FilterStatus[] = [
  'ALL', 'ACTIVE', 'RUNNING', 'PAUSED', 'IDLE', 'ERROR', 'ARCHIVED', 'DEPRECATED',
];

const DEPARTMENT_FILTERS = [
  'ALL', 'EXECUTIVE', 'OPERATIONS', 'FINANCE', 'SALES', 'MARKETING',
  'CUSTOMER_SUPPORT', 'HUMAN_RESOURCES', 'LEGAL', 'IT_ENGINEERING',
  'PRODUCT', 'PROCUREMENT', 'ANALYTICS_DATA', 'STRATEGY_GROWTH',
  'RISK_COMPLIANCE', 'ADMINISTRATION', 'RESEARCH_INNOVATION',
];

// ─── Page ─────────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const params = (typeof window !== 'undefined' ? new URL(window.location.href).searchParams : null);
  const initialTab = (params?.get('tab') as MarketplaceTab) ?? 'agents';

  const user = useTenantAuth();
  const router = useRouter();
  const openInspector = useInspectorStore((s) => s.openInspector);

  const [activeTab, setActiveTab] = useState<MarketplaceTab>(initialTab);

  // Sync tab from URL changes (back/forward nav)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const t = url.searchParams.get('tab') as MarketplaceTab | null;
      if (t && TABS.find((tab) => tab.id === t)) setActiveTab(t);
    }
  }, []);

  const setTab = (t: MarketplaceTab) => {
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
          eyebrow="Operations"
          title="Marketplace"
          subtitle="Browse the AI agent library, manage your fleet, and connect external systems."
        />
      <div className="max-w-7xl mx-auto space-y-5">
        {/* ── Page Header ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between gap-4 hidden"
        >
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent-500/15 text-accent-500 flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
              Marketplace
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Browse the AI agent library, manage your fleet, and connect external systems.
            </p>
          </div>
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
            {activeTab === 'agents' && (
              <MyAgentsTab
                onInspect={(id) => openInspector('agent', id)}
                onSpawnClick={() => setTab('templates')}
              />
            )}
            {activeTab === 'templates' && (
              <AgentTemplatesTab router={router} />
            )}
            {activeTab === 'packages' && (
              <PackagesTab user={user} />
            )}
            {activeTab === 'connectors' && (
              <ConnectorsTab />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      </PageShell>
    </TenantShell>
  );
}

// ─── Tab 1: My Agents ────────────────────────────────────────────────────
function MyAgentsTab({
  onInspect,
  onSpawnClick,
}: {
  onInspect: (id: string) => void;
  onSpawnClick: () => void;
}) {
  const [agents, setAgents] = useState<AgentRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/agents?limit=100');
      const data = unwrapList(res);
      setAgents(Array.isArray(data?.items) ? (data.items as AgentRaw[]) : []);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAgents(); }, [fetchAgents]);

  const handleAction = async (action: string, agentId: string) => {
    if (action === 'inspect') { onInspect(agentId); return; }
    if (action === 'audit') { onInspect(agentId); return; }
    if (action === 'pause') {
      try {
        await api.post(`/agents/${agentId}/pause`);
        setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status: 'PAUSED', isActive: false } : a)));
      } catch { /* silent */ }
    } else if (action === 'resume') {
      try {
        await api.post(`/agents/${agentId}/resume`);
        setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status: 'ACTIVE', isActive: true } : a)));
      } catch { /* silent */ }
    } else if (action === 'archive') {
      if (!confirm('Archive this agent? It can be restored later.')) return;
      try {
        await api.patch(`/agents/${agentId}/archive`);
        setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status: 'ARCHIVED', isActive: false } : a)));
      } catch { /* silent */ }
    } else if (action === 'restore') {
      try {
        await api.patch(`/agents/${agentId}/restore`);
        setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status: 'ACTIVE', isActive: true } : a)));
      } catch { /* silent */ }
    }
  };

  const visible = agents.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts: Record<string, number> = {};
  for (const a of agents) counts[a.status] = (counts[a.status] ?? 0) + 1;
  const runningCount = agents.filter((a) => a.status === 'ACTIVE' || a.status === 'RUNNING').length;
  const archivedCount = agents.filter((a) => a.status === 'ARCHIVED' || a.status === 'DEPRECATED').length;

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total" value={agents.length} color="ops" icon={<Users className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Running" value={runningCount} color="profit" icon={<PlayCircle className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Paused" value={counts.PAUSED ?? 0} color="warn" icon={<PauseCircle className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Archived" value={archivedCount} color="neutral" icon={<Archive className="w-4 h-4" />} loading={loading} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents by name or description…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent-500 transition"
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                statusFilter === s
                  ? 'bg-accent-500 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay border border-surface-border'
              }`}
            >
              {s}
              {s !== 'ALL' && counts[s] ? (
                <span className="ml-1 opacity-80">{counts[s]}</span>
              ) : null}
            </button>
          ))}
        </div>

        <button
          onClick={() => void fetchAgents()}
          className="w-8 h-8 rounded-md border border-surface-border text-zinc-500 hover:text-zinc-200 hover:bg-surface-overlay transition flex items-center justify-center"
          aria-label="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <div className="flex rounded-lg border border-surface-border overflow-hidden">
          {(['grid', 'list'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2.5 py-1.5 text-xs transition ${
                viewMode === mode
                  ? 'bg-accent-500 text-white'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-surface-overlay'
              }`}
              aria-label={mode}
            >
              {mode === 'grid' ? <LayoutGrid className="w-3.5 h-3.5" /> : <ListIcon className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">
            {agents.length === 0 ? 'No employees yet' : 'No employees match your filters'}
          </p>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
            {agents.length === 0
              ? 'Spawn your first employee from the Agent Templates tab to get started.'
              : 'Try a different search term or status filter.'}
          </p>
          {agents.length === 0 && (
            <ActionButton
              variant="primary"
              size="md"
              icon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={onSpawnClick}
              className="mt-4"
            >
              Browse Agent Templates
            </ActionButton>
          )}
        </div>
      ) : (
        <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 max-w-3xl'}`}>
          {visible.map((agent) => {
            const meta = (agent.metadata as Record<string, unknown> | null) ?? null;
            const profile =
              (meta?.profile as Record<string, unknown> | undefined) ?? {};
            return (
              <AgentCard
                key={agent.id}
                agent={{
                  id: agent.id,
                  name: agent.name,
                  type: agent.type as never,
                  status: agent.status as never,
                  department: agent.department?.name,
                  model: agent.model?.name ?? 'gpt-4o',
                  workload: Math.min(100, Math.round(((agent._count?.tasks ?? 0) / 10) * 100)),
                  taskCount: agent._count?.tasks ?? 0,
                  successRate: agent.status === 'ACTIVE' || agent.status === 'RUNNING' ? Math.min(100, Math.round(((agent._count?.tasks ?? 0) / Math.max((agent._count?.tasks ?? 0) + 1, 1)) * 100)) : 0,
                  budgetUsed: agent.budgetUsed ?? 0,
                  budgetTotal: agent.monthlyBudget ?? 100,
                  lastActiveAt: agent.updatedAt,
                  avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl : null,
                  designation: typeof profile.designation === 'string' ? profile.designation : null,
                  bio: typeof profile.bio === 'string' ? profile.bio : null,
                  color: typeof profile.color === 'string' ? profile.color : null,
                  emoji: typeof profile.emoji === 'string' ? profile.emoji : null,
                }}
                variant={viewMode === 'grid' ? 'full' : 'compact'}
                onAction={handleAction}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Agent Templates (browse 104 platform templates) ─────────────
function AgentTemplatesTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const [templates, setTemplates] = useState<AgentTemplateRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [spawnTemplate, setSpawnTemplate] = useState<AgentTemplateRaw | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/agent-templates/platform?limit=200');
      const data = unwrapList(res);
      setTemplates(Array.isArray(data?.items) ? (data.items as AgentTemplateRaw[]) : []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchTemplates(); }, [fetchTemplates]);

  const visible = useMemo(() => templates.filter((t) => {
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'ALL' || inferDepartment(t.name, t.description) === deptFilter;
    const matchType = typeFilter === 'ALL' || t.type === typeFilter;
    return matchSearch && matchDept && matchType;
  }), [templates, search, deptFilter, typeFilter]);

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of templates) c[t.type] = (c[t.type] ?? 0) + 1;
    return c;
  }, [templates]);

  return (
    <div className="space-y-4">
      {/* Hero strip */}
      <div className="card-surface p-4 bg-gradient-to-r from-accent-500/5 to-transparent border-accent-500/20">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-accent-500" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">{templates.length} prebuilt AI agent templates</h3>
              <p className="text-xs text-zinc-500">Each template is a complete agent definition ready to deploy into your tenant.</p>
            </div>
          </div>
          <ActionButton
            variant="secondary"
            size="md"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => void fetchTemplates()}
          >
            Refresh
          </ActionButton>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by name or description…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent-500 transition"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-xs text-zinc-200 focus:outline-none focus:border-accent-500"
        >
          {DEPARTMENT_FILTERS.map((d) => (
            <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-xs text-zinc-200 focus:outline-none focus:border-accent-500"
        >
          <option value="ALL">All types</option>
          <option value="EXECUTIVE">Executive ({typeCounts.EXECUTIVE ?? 0})</option>
          <option value="CORE">Core ({typeCounts.CORE ?? 0})</option>
          <option value="FUNCTIONAL">Functional ({typeCounts.FUNCTIONAL ?? 0})</option>
          <option value="META">Meta ({typeCounts.META ?? 0})</option>
        </select>
      </div>

      {/* Quick action: top categories */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickAction
          label="Executive"
          description="CEO, CFO, COO and C-suite agents"
          icon={<Sparkles className="w-5 h-5" />}
          accent="accent"
          onClick={() => setDeptFilter('EXECUTIVE')}
        />
        <QuickAction
          label="Sales & Marketing"
          description="Lead gen, campaigns, CRM"
          icon={<Users className="w-5 h-5" />}
          accent="success"
          onClick={() => { setDeptFilter('SALES'); }}
        />
        <QuickAction
          label="Engineering"
          description="DevOps, infra, security"
          icon={<Building2 className="w-5 h-5" />}
          accent="info"
          onClick={() => setDeptFilter('IT_ENGINEERING')}
        />
        <QuickAction
          label="HR & Admin"
          description="Recruiting, payroll, scheduling"
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="warning"
          onClick={() => setDeptFilter('HUMAN_RESOURCES')}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Sparkles className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">No templates match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onSpawn={() => setSpawnTemplate(template)}
              onView={() => router.push(`/marketplace?template=${template.id}`)}
            />
          ))}
        </div>
      )}

      {/* Spawn modal */}
      <AnimatePresence>
        {spawnTemplate && (
          <SpawnAgentModal
            template={spawnTemplate}
            onClose={() => setSpawnTemplate(null)}
            onSuccess={() => {
              setSpawnTemplate(null);
              void fetchTemplates();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────
function TemplateCard({
  template,
  onSpawn,
  onView,
}: {
  template: AgentTemplateRaw;
  onSpawn: () => void;
  onView: () => void;
}) {
  const accent = inferAccentForType(template.type);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      className="card-surface card-interactive p-4 flex flex-col"
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent.bg} ${accent.text}`}>
          <Sparkles className="w-4 h-4" />
        </div>
        <span className="text-[10px] font-mono text-zinc-500">v{template.version}</span>
      </div>

      <h4 className="text-sm font-semibold text-zinc-100 line-clamp-1">{template.name}</h4>
      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2 min-h-[32px]">
        {template.description ?? 'AI agent template'}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        <StatusBadge status={template.type} />
        {template.model && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-overlay text-zinc-400 border border-surface-border font-mono">
            {template.model}
          </span>
        )}
      </div>

      <ActionToolbar
        className="mt-3 pt-3 border-t border-surface-border"
        right={
          <>
            <ActionButton variant="ghost" size="sm" icon={<Eye className="w-3 h-3" />} onClick={onView}>
              View
            </ActionButton>
            <ActionButton variant="primary" size="sm" icon={<Plus className="w-3 h-3" />} onClick={onSpawn}>
              Spawn
            </ActionButton>
          </>
        }
      />
    </motion.div>
  );
}

// ─── Spawn Agent Modal (uses Phase 1 Gap 3 endpoint) ────────────────────
function SpawnAgentModal({
  template,
  onClose,
  onSuccess,
}: {
  template: AgentTemplateRaw;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [agentName, setAgentName] = useState(`${template.name} (Copy)`);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [budget, setBudget] = useState('50');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authUser = useAuthStore((s) => s.user);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.get('/departments?limit=100')
      .then((res) => {
        const data = unwrapList(res);
        const list = Array.isArray(data?.items) ? (data.items as { id: string; name: string }[]) : [];
        setDepartments(list);
      })
      .catch(() => setDepartments([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const tenantId = authUser?.tenantId;
      if (!tenantId) throw new Error('Could not resolve tenant');
      const body = {
        name: agentName,
        tenantId,
        departmentId: departmentId || null,
        budgetPerDay: parseFloat(budget) || 50,
      };
      await api.post(`/deploy/agents/from-template/${template.id}`, body);
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Spawn failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md card-surface p-6 shadow-creatio-lg"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">Spawn Agent</h3>
            <p className="text-xs text-zinc-500 mt-0.5">From template: <span className="text-zinc-300">{template.name}</span></p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-400">Agent name</label>
            <input
              type="text"
              required
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-200 focus:outline-none focus:border-accent-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400">Department (optional)</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-200 focus:outline-none focus:border-accent-500"
            >
              <option value="">— No department —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400">Daily budget ($)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-200 focus:outline-none focus:border-accent-500"
            />
          </div>

          {error && (
            <div className="text-xs text-state-danger bg-state-danger/10 border border-state-danger/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <ActionToolbar
            className="pt-3 border-t border-surface-border"
            right={
              <>
                <ActionButton variant="ghost" size="md" onClick={onClose} type="button">
                  Cancel
                </ActionButton>
                <ActionButton variant="primary" size="md" loading={submitting} icon={<Plus className="w-3.5 h-3.5" />} type="submit">
                  Spawn Agent
                </ActionButton>
              </>
            }
          />
        </form>
      </motion.div>
    </>
  );
}

// ─── Tab 3: Packages (browse + deploy) ──────────────────────────────────
function PackagesTab({ user }: { user: NonNullable<ReturnType<typeof useTenantAuth>> }) {
  const router = useRouter();
  const [packages, setPackages] = useState<TenantPackage[]>([]);
  const [features, setFeatures] = useState<Awaited<ReturnType<typeof packagesService.listFeatures>>>([]);
  const [loading, setLoading] = useState(true);
  const [deployPkg, setDeployPkg] = useState<TenantPackage | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgList, featList] = await Promise.all([
        packagesService.list({ status: 'PUBLISHED', limit: 50 }),
        packagesService.listFeatures(),
      ]);
      setPackages(pkgList);
      setFeatures(featList);
    } catch {
      setPackages([]);
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const deployedCount = packages.filter((p) => p.status === 'PUBLISHED').length;

  if (loading) {
    return (
      <div className="card-surface p-12 text-center">
        <Loader2 className="w-8 h-8 text-accent-500 mx-auto mb-3 animate-spin" />
        <p className="text-sm text-zinc-400">Loading packages…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="card-surface p-4 bg-gradient-to-r from-accent-500/5 to-transparent border-accent-500/20">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-accent-500" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Available Packages ({packages.length})</h3>
              <p className="text-xs text-zinc-500">
                Browse pre-composed packages for your industry and tier. Deploy departments, agents, and features in one click.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <ActionButton
              variant="ghost"
              size="sm"
              icon={<Package className="w-3 h-3" />}
              onClick={() => setShowFeatures(!showFeatures)}
            >
              {showFeatures ? 'Hide Features' : `Features (${features.length})`}
            </ActionButton>
            <ActionButton
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-3 h-3" />}
              onClick={() => void fetchAll()}
            >
              Refresh
            </ActionButton>
          </div>
        </div>
      </div>

      {/* Features panel (collapsible) */}
      {showFeatures && (
        <div className="card-surface p-4">
          <h4 className="text-xs font-semibold text-zinc-300 uppercase mb-3">Platform Features ({features.length})</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {features.map((f) => (
              <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-overlay border border-surface-border">
                <span className={`w-1.5 h-1.5 rounded-full ${f.isEnabled ? 'bg-state-success' : 'bg-zinc-500/50'}`} />
                <span className="text-xs text-zinc-300 truncate">{f.name}</span>
                <span className="text-[10px] text-zinc-500 ml-auto">{f.category}</span>
              </div>
            ))}
            {features.length === 0 && (
              <p className="text-xs text-zinc-500 col-span-full text-center py-4">No features configured for your account.</p>
            )}
          </div>
        </div>
      )}

      {/* Package grid */}
      {packages.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Briefcase className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">No packages available</p>
          <p className="text-xs text-zinc-500 mt-1">Packages will appear here when your platform admin publishes them.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {packages.map((pkg) => (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              className="card-surface card-interactive p-4 flex flex-col"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-accent-500/15 text-accent-500 flex items-center justify-center shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono text-zinc-500">v{pkg.version}</span>
              </div>

              <h4 className="text-sm font-semibold text-zinc-100 line-clamp-1">{pkg.name}</h4>
              <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2 min-h-[32px]">
                {pkg.description ?? 'Pre-composed package'}
              </p>

              <div className="flex flex-wrap gap-1.5 mt-3">
                <StatusBadge status={pkg.scope ?? 'FUNCTIONAL'} />
                {pkg.industry && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-overlay text-zinc-400 border border-surface-border">
                    {pkg.industry.name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-3 text-xs text-zinc-400">
                <span>{pkg.suggestedDepartmentCount ?? pkg.departments?.length ?? 0} depts</span>
                <span>{pkg.suggestedAgentCount ?? pkg.agents?.length ?? 0} agents</span>
                <span>{pkg.features?.length ?? 0} features</span>
              </div>

              <ActionToolbar
                className="mt-3 pt-3 border-t border-surface-border"
                right={
                  <>
                    <ActionButton variant="ghost" size="sm" icon={<Eye className="w-3 h-3" />} onClick={() => router.push(`/marketplace?package=${pkg.id}`)}>
                      View
                    </ActionButton>
                    <ActionButton variant="primary" size="sm" icon={<Plus className="w-3 h-3" />} onClick={() => setDeployPkg(pkg)}>
                      Deploy
                    </ActionButton>
                  </>
                }
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Deploy modal */}
      <AnimatePresence>
        {deployPkg && user && (
          <DeployPackageModal
            pkg={deployPkg}
            user={user}
            onClose={() => setDeployPkg(null)}
            onSuccess={() => {
              setDeployPkg(null);
              void fetchAll();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Deploy Package Modal ──────────────────────────────────────────────────
function DeployPackageModal({
  pkg,
  user,
  onClose,
  onSuccess,
}: {
  pkg: TenantPackage;
  user: NonNullable<ReturnType<typeof useTenantAuth>>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [preview, setPreview] = useState<DeployPackagePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withAgents, setWithAgents] = useState(true);
  const [authorityLevel, setAuthorityLevel] = useState<'AUTO' | 'RECOMMEND' | 'APPROVAL'>('AUTO');

  const authUser = useAuthStore((s) => s.user);
  const tenantId = authUser?.tenantId ?? '';

  useEffect(() => {
    if (!tenantId) return;
    setPreviewLoading(true);
    packagesService.deployPreview(pkg.id, tenantId, withAgents)
      .then((p) => setPreview(p))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [pkg.id, tenantId, withAgents]);

  const handleDeploy = async () => {
    if (!tenantId) return;
    setError(null);
    setSubmitting(true);
    try {
      await packagesService.deploy(pkg.id, tenantId, { withAgents, authorityLevel, idempotent: true });
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Deploy failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg card-surface p-6 shadow-creatio-lg"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">Deploy Package</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{pkg.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {previewLoading ? (
          <div className="py-8 text-center text-zinc-500 text-sm">
            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
            Checking capacity…
          </div>
        ) : preview ? (
          <div className="space-y-4">
            {/* Feasibility */}
            {!preview.feasible && (
              <div className="text-xs text-state-danger bg-state-danger/10 border border-state-danger/30 rounded-lg px-3 py-2">
                Cannot deploy: {preview.blockers.join(', ')}
              </div>
            )}

            {preview.feasible && (
              <>
                {/* Capacity */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="card-surface p-3 text-center border border-surface-border">
                    <p className="text-xs text-zinc-500">Departments</p>
                    <p className="text-lg font-bold text-zinc-100">{preview.capacity.departmentsUsed}/{preview.capacity.departmentsLimit}</p>
                    <p className="text-[10px] text-zinc-500">{preview.capacity.departmentsRemaining} remaining</p>
                  </div>
                  <div className="card-surface p-3 text-center border border-surface-border">
                    <p className="text-xs text-zinc-500">Agents</p>
                    <p className="text-lg font-bold text-zinc-100">{preview.capacity.agentsUsed}/{preview.capacity.agentsLimit}</p>
                    <p className="text-[10px] text-zinc-500">{preview.capacity.agentsRemaining} remaining</p>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex items-center gap-4 text-xs text-zinc-400 bg-surface-overlay rounded-lg px-3 py-2">
                  <span>{preview.totals.departments} departments</span>
                  <span>{preview.totals.agents} agents</span>
                  <span>{preview.totals.features} features</span>
                </div>

                {/* Options */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-300">
                    <input type="checkbox" checked={withAgents} onChange={(e) => setWithAgents(e.target.checked)} className="rounded" />
                    Deploy head agents
                  </label>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Authority level</label>
                    <select
                      value={authorityLevel}
                      onChange={(e) => setAuthorityLevel(e.target.value as typeof authorityLevel)}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-200 focus:outline-none focus:border-accent-500"
                    >
                      <option value="AUTO">Auto (spawn all)</option>
                      <option value="RECOMMEND">Recommend (admin validates)</option>
                      <option value="APPROVAL">Requires approval</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="text-xs text-state-danger bg-state-danger/10 border border-state-danger/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <ActionToolbar
              className="pt-3 border-t border-surface-border"
              right={
                <>
                  <ActionButton variant="ghost" size="md" onClick={onClose} type="button">
                    Cancel
                  </ActionButton>
                  <ActionButton
                    variant="primary"
                    size="md"
                    loading={submitting}
                    disabled={!preview.feasible || submitting}
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={handleDeploy}
                  >
                    Deploy Package
                  </ActionButton>
                </>
              }
            />
          </div>
        ) : (
          <div className="py-8 text-center text-zinc-500 text-sm">
            Could not load deployment preview. Capacity check unavailable.
          </div>
        )}
      </motion.div>
    </>
  );
}

// ─── Tab 4: Connectors ───────────────────────────────────────────────────
function ConnectorsTab() {
  const [providers, setProviders] = useState<string[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [industryPresets, setIndustryPresets] = useState<Array<{ slug: string; name: string; type: string; description?: string; tier: string; category?: string }>>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [tenantIndustry, setTenantIndustry] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        connectorsService.listProviders(),
        connectorsService.listConnectors(),
      ]);
      setProviders(p);
      setConnectors(c);
      setProvider((prev) => prev || p[0] || '');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIndustryPresets = useCallback(async () => {
    setPresetsLoading(true);
    try {
      const tenantRes = await api.get('/tenants/me/current');
      const tenant = (tenantRes.data as { data?: { industry?: string | null } })?.data ?? (tenantRes.data as { industry?: string | null } | null);
      const industry = tenant?.industry;
      if (industry) {
        setTenantIndustry(industry);
        const presetsRes = await api.get(`/industries/${encodeURIComponent(industry)}/integration-presets`);
        const data = (presetsRes.data as { data?: { presets?: Array<{ slug: string; name: string; type: string; description?: string; tier: string; category?: string }> } })?.data;
        setIndustryPresets(data?.presets ?? []);
      }
    } catch {
      setIndustryPresets([]);
    } finally {
      setPresetsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);
  useEffect(() => { void fetchIndustryPresets(); }, [fetchIndustryPresets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !provider.trim()) return;
    setSubmitting(true);
    try {
      await connectorsService.registerConnector({ name, provider });
      setName('');
      await fetchAll();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {industryPresets.length > 0 && (
        <div className="card-surface p-5">
          <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-accent-500" />
            Recommended for {tenantIndustry}
          </h3>
          <p className="text-xs text-zinc-500 mb-3">
            Industry-specific integrations commonly used by {tenantIndustry}. Sorted by tier relevance.
          </p>
          {presetsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 rounded-lg bg-surface-overlay border border-surface-border animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {industryPresets.map((preset) => (
                <div
                  key={preset.slug}
                  className="p-3 rounded-lg border border-surface-border bg-surface-overlay hover:border-accent-500/30 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-zinc-200 truncate">{preset.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-zinc-400 shrink-0">
                      {preset.tier}
                    </span>
                  </div>
                  {preset.category && (
                    <p className="text-[10px] text-zinc-500">{preset.category}</p>
                  )}
                  {preset.description && (
                    <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{preset.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Existing connectors */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Plug className="w-4 h-4 text-status-ops" />
            Configured connectors ({connectors.length})
          </h3>
          {loading ? (
            <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading…</div>
          ) : connectors.length === 0 ? (
            <div className="card-surface p-12 text-center">
              <Plug className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-300 font-medium">No connectors configured</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                Register a connector to enable agent integration with external systems (CRM, calendars, etc.).
              </p>
            </div>
          ) : (
            <div className="card-surface divide-y divide-surface-border">
              {connectors.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-lg bg-status-ops/15 text-status-ops flex items-center justify-center">
                    <Plug className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{c.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{c.provider}</p>
                  </div>
                  <StatusBadge status={c.isActive ? 'ACTIVE' : 'PAUSED'} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Register form */}
        <div className="card-surface p-5 h-fit">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-accent-500" />
            Register new connector
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-400">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Salesforce Production"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400">Provider</label>
              <select
                required
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-200 focus:outline-none focus:border-accent-500"
              >
                <option value="">Select provider…</option>
                {providers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <ActionButton
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
              icon={<Plus className="w-3.5 h-3.5" />}
              className="w-full"
            >
              Register Connector
            </ActionButton>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function inferDepartment(name: string, description?: string): string {
  const text = `${name} ${description ?? ''}`.toLowerCase();
  if (/ceo|cto|cfo|coo|cmo|chro|chief|executive/.test(text)) return 'EXECUTIVE';
  if (/sales|crm|lead|deal|pipeline|proposal/.test(text)) return 'SALES';
  if (/marketing|seo|content|campaign|brand|social/.test(text)) return 'MARKETING';
  if (/finance|bookkeep|accounting|invoice|tax|ap |ar |payroll/.test(text)) return 'FINANCE';
  if (/support|ticket|csat|complaint/.test(text)) return 'CUSTOMER_SUPPORT';
  if (/recruit|hire|resume|hr |payroll|training/.test(text)) return 'HUMAN_RESOURCES';
  if (/legal|contract|compliance|policy|risk/.test(text)) return 'RISK_COMPLIANCE';
  if (/devops|engineer|infrastructure|security|bug|deploy/.test(text)) return 'IT_ENGINEERING';
  if (/product|feature|roadmap|pm /.test(text)) return 'PRODUCT';
  if (/procurement|supplier|purchase|po /.test(text)) return 'PROCUREMENT';
  if (/data|bi |analyst|forecast|insight/.test(text)) return 'ANALYTICS_DATA';
  if (/strategy|growth|market intel|competitive|expansion/.test(text)) return 'STRATEGY_GROWTH';
  if (/operations|process|supply|logistic|vendor|quality/.test(text)) return 'OPERATIONS';
  if (/admin|schedul|document|meeting|email|workspace/.test(text)) return 'ADMINISTRATION';
  if (/research|innovation|discovery/.test(text)) return 'RESEARCH_INNOVATION';
  return 'OTHER';
}

function inferAccentForType(type: string): { bg: string; text: string } {
  switch (type) {
    case 'EXECUTIVE': return { bg: 'bg-accent-500/15',     text: 'text-accent-500' };
    case 'CORE':      return { bg: 'bg-status-ops/15',     text: 'text-status-ops' };
    case 'META':      return { bg: 'bg-status-strategy/15', text: 'text-status-strategy' };
    default:          return { bg: 'bg-state-success/15',  text: 'text-state-success' };
  }
}