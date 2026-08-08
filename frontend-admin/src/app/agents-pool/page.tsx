"use client";

/**
 * /agents-pool — Phase 10 AI Employees Pool page.
 * Reuses AgentTemplate data + adds pool-level enabled toggle + duplicate.
 * Now includes "Deploy to Tenant" quick action per agent template.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePoolList } from '@/hooks/usePoolList';
import { PoolToolbar } from '@/components/pool/PoolToolbar';
import { PoolPagination } from '@/components/pool/PoolPagination';
import { PoolStatusBadge } from '@/components/pool/PoolStatusBadge';
import { PoolEmptyState } from '@/components/pool/PoolEmptyState';
import { PoolConfirmDeleteDialog } from '@/components/pool/PoolConfirmDeleteDialog';
import {
  DeployToTenantModal,
  type TenantOption,
  type AgentDeployConfig,
} from '@/components/pool/DeployToTenantModal';
import {
  agentsPoolService,
  type AgentsPoolEntry,
  type CreateAgentsPoolPayload,
  type PersistedSandboxRun,
  type SandboxAgentTemplateResult,
  type SandboxRunComparison,
} from '@/services/agentsPool.service';
import { agentTemplatesService, type AgentTemplate } from '@/services/agentTemplates.service';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';

const FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Enabled', value: 'ENABLED' },
  { label: 'Disabled', value: 'DISABLED' },
];

const TYPE_FILTERS = [
  { label: 'Any type', value: 'ALL' },
  { label: 'EXECUTIVE', value: 'EXECUTIVE' },
  { label: 'CORE', value: 'CORE' },
  { label: 'FUNCTIONAL', value: 'FUNCTIONAL' },
  { label: 'META', value: 'META' },
];

const TYPE_COLOR: Record<string, string> = {
  EXECUTIVE: 'bg-purple-900 text-purple-300',
  CORE: 'bg-[color:var(--state-info)] text-blue-300',
  FUNCTIONAL: 'bg-[color:var(--accent-500)] text-indigo-300',
  META: 'bg-[color:var(--state-warning)] text-amber-300',
};

const DESIGNER_TABS = [
  { id: 'identity', label: 'Identity' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'governance', label: 'Governance' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'advanced', label: 'Advanced' },
] as const;

type DesignerTabId = (typeof DESIGNER_TABS)[number]['id'];

type AuthorityLevel = 'AUTO' | 'RECOMMEND' | 'APPROVAL';
type MemoryPolicy = 'NONE' | 'SESSION' | 'TASK' | 'TENANT';
type EscalationMode = 'NONE' | 'MANAGER' | 'HUMAN_REVIEW';

interface AgentStructuredConfig {
  allowTenantEditing: boolean;
  authorityLevel: AuthorityLevel;
  memoryPolicy: MemoryPolicy;
  escalationMode: EscalationMode;
  handoffTargets: string[];
  knowledgeSources: string[];
  allowedTools: string[];
  blockedTools: string[];
  channels: string[];
  tags: string[];
  maxActionsPerRun: number;
  requiresCitations: boolean;
  humanReviewRequired: boolean;
  auditMode: boolean;
  custom: Record<string, unknown>;
}

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinLines(value: string[] | undefined): string {
  return (value ?? []).join('\n');
}

function coerceStructuredConfig(input: Record<string, unknown> | undefined): AgentStructuredConfig {
  const source = input ?? {};
  const knownKeys = new Set([
    'allowTenantEditing',
    'authorityLevel',
    'memoryPolicy',
    'escalationMode',
    'handoffTargets',
    'knowledgeSources',
    'allowedTools',
    'blockedTools',
    'channels',
    'tags',
    'maxActionsPerRun',
    'requiresCitations',
    'humanReviewRequired',
    'auditMode',
  ]);

  const custom = Object.fromEntries(
    Object.entries(source).filter(([key]) => !knownKeys.has(key)),
  );

  return {
    allowTenantEditing: source.allowTenantEditing !== false,
    authorityLevel:
      source.authorityLevel === 'AUTO' ||
      source.authorityLevel === 'RECOMMEND' ||
      source.authorityLevel === 'APPROVAL'
        ? source.authorityLevel
        : 'RECOMMEND',
    memoryPolicy:
      source.memoryPolicy === 'NONE' ||
      source.memoryPolicy === 'SESSION' ||
      source.memoryPolicy === 'TASK' ||
      source.memoryPolicy === 'TENANT'
        ? source.memoryPolicy
        : 'TASK',
    escalationMode:
      source.escalationMode === 'NONE' ||
      source.escalationMode === 'MANAGER' ||
      source.escalationMode === 'HUMAN_REVIEW'
        ? source.escalationMode
        : 'MANAGER',
    handoffTargets: Array.isArray(source.handoffTargets)
      ? source.handoffTargets.filter((item): item is string => typeof item === 'string')
      : [],
    knowledgeSources: Array.isArray(source.knowledgeSources)
      ? source.knowledgeSources.filter((item): item is string => typeof item === 'string')
      : [],
    allowedTools: Array.isArray(source.allowedTools)
      ? source.allowedTools.filter((item): item is string => typeof item === 'string')
      : [],
    blockedTools: Array.isArray(source.blockedTools)
      ? source.blockedTools.filter((item): item is string => typeof item === 'string')
      : [],
    channels: Array.isArray(source.channels)
      ? source.channels.filter((item): item is string => typeof item === 'string')
      : [],
    tags: Array.isArray(source.tags)
      ? source.tags.filter((item): item is string => typeof item === 'string')
      : [],
    maxActionsPerRun:
      typeof source.maxActionsPerRun === 'number' && Number.isFinite(source.maxActionsPerRun)
        ? source.maxActionsPerRun
        : 8,
    requiresCitations: source.requiresCitations === true,
    humanReviewRequired: source.humanReviewRequired === true,
    auditMode: source.auditMode === true,
    custom,
  };
}

function buildConfigFromStructuredConfig(config: AgentStructuredConfig): Record<string, unknown> {
  return {
    allowTenantEditing: config.allowTenantEditing,
    authorityLevel: config.authorityLevel,
    memoryPolicy: config.memoryPolicy,
    escalationMode: config.escalationMode,
    handoffTargets: config.handoffTargets,
    knowledgeSources: config.knowledgeSources,
    allowedTools: config.allowedTools,
    blockedTools: config.blockedTools,
    channels: config.channels,
    tags: config.tags,
    maxActionsPerRun: config.maxActionsPerRun,
    requiresCitations: config.requiresCitations,
    humanReviewRequired: config.humanReviewRequired,
    auditMode: config.auditMode,
    ...config.custom,
  };
}

function summarizeAgentConfig(config: Record<string, unknown> | undefined): string[] {
  const structured = coerceStructuredConfig(config);
  const summary = [
    structured.authorityLevel,
    structured.memoryPolicy,
    structured.humanReviewRequired ? 'HITL' : null,
    structured.requiresCitations ? 'Citations' : null,
  ];

  return summary.filter((item): item is string => Boolean(item));
}

function tokenizeDiff(value: string): string[] {
  return value.split(/(\s+)/).filter((part) => part.length > 0);
}

function buildWordDiff(baseText: string, compareText: string): {
  base: Array<{ value: string; changed: boolean }>;
  compare: Array<{ value: string; changed: boolean }>;
} {
  const left = tokenizeDiff(baseText);
  const right = tokenizeDiff(compareText);
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  return {
    base: left.map((value) => ({ value, changed: !rightSet.has(value) })),
    compare: right.map((value) => ({ value, changed: !leftSet.has(value) })),
  };
}

function buildListDiff(
  baseItems: string[],
  compareItems: string[],
): {
  base: Array<{ value: string; changed: boolean }>;
  compare: Array<{ value: string; changed: boolean }>;
} {
  const baseSet = new Set(baseItems);
  const compareSet = new Set(compareItems);

  return {
    base: baseItems.map((value) => ({ value, changed: !compareSet.has(value) })),
    compare: compareItems.map((value) => ({ value, changed: !baseSet.has(value) })),
  };
}

export default function AgentsPoolPage() {
  const user = useAdminAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const { items, total, page: currentPage, totalPages, loading, refresh, setOpts } = usePoolList<
    AgentsPoolEntry,
    unknown
  >(agentsPoolService as unknown as Parameters<typeof usePoolList<AgentsPoolEntry, unknown>>[0]);

  useEffect(() => {
    setOpts({ search, status: status === 'ALL' ? undefined : status, page: 1, limit: 20 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const [editing, setEditing] = useState<AgentsPoolEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AgentsPoolEntry | null>(null);

  // Deploy modal
  const [deployTarget, setDeployTarget] = useState<AgentsPoolEntry | null>(null);
  const [deployTenants, setDeployTenants] = useState<TenantOption[]>([]);
  const [deployBusy, setDeployBusy] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<{ label: string } | null>(null);
  const [sandboxTarget, setSandboxTarget] = useState<AgentsPoolEntry | null>(null);

  const canEdit = user?.role === 'SUPER_ADMIN';

  // Pre-fetch tenant list when deploy modal opens
  async function openDeployModal(item: AgentsPoolEntry) {
    setDeployTarget(item);
    setDeployError(null);
    setDeployResult(null);
    try {
      const res = await api.get('/tenants', { params: { limit: 200 } });
      const list = unwrapList(res);
      setDeployTenants((list.items ?? []) as TenantOption[]);
    } catch {
      setDeployTenants([]);
    }
  }

  async function handleDeployAgent(tenantId: string, config: AgentDeployConfig) {
    if (!deployTarget) return;
    setDeployBusy(true);
    setDeployError(null);
    try {
      const payload = {
        name: config.name,
        tenantId,
        budgetPerDay: config.budgetPerDay,
        authorityLevel: config.authorityLevel,
      };
      const res = await api.post(`/deploy/agents/from-template/${deployTarget.id}`, payload);
      const data = res.data?.data ?? res.data;
      setDeployResult({ label: `Deployed "${config.name}" to tenant.` });
    } catch (err: unknown) {
      setDeployError(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setDeployBusy(false);
    }
  }

  const filtered = useMemo(
    () =>
      items.filter((a) => {
        const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
          (a.description ?? '').toLowerCase().includes(search.toLowerCase());
        const matchesStatus =
          status === 'ALL' ||
          (status === 'ENABLED' && a.enabled) ||
          (status === 'DISABLED' && !a.enabled);
        const matchesType = typeFilter === 'ALL' || a.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      }),
    [items, search, status, typeFilter],
  );

  async function toggleEnabled(item: AgentsPoolEntry) {
    try {
      await agentsPoolService.setEnabled(item.id, !item.enabled);
    } catch {
      /* noop */
    }
    refresh();
  }

  async function duplicate(item: AgentsPoolEntry) {
    try {
      await agentsPoolService.duplicate(item.id);
    } catch {
      /* noop */
    }
    refresh();
  }

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">AI Employees</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Master library of platform agent templates. Hermés owns runtime
              (prompts, memory, tools); admin only curates identity & permissions.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition"
            >
              + New Agent Template
            </button>
          )}
        </div>

        <PoolToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search agent templates…"
          filters={FILTERS}
          activeFilter={status}
          onFilterChange={setStatus}
          count={total}
          countLabel="templates"
        />

        <div className="flex gap-1 flex-wrap">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                typeFilter === t.value
                  ? 'bg-[color:var(--accent-500)] text-white'
                  : 'border border-surface-border text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PoolEmptyState title="No agent templates match your filters" />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence>
                {filtered.map((tpl) => (
                  <motion.div
                    key={tpl.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`rounded-xl border bg-surface-raised p-4 flex flex-col gap-3 transition ${
                      tpl.enabled
                        ? 'border-surface-border hover:border-[color:var(--accent-500)]/50'
                        : 'border-zinc-800/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-100 truncate">{tpl.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                          {tpl.description ?? 'No description'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[tpl.type] ?? 'bg-zinc-800 text-zinc-300'}`}
                        >
                          {tpl.type}
                        </span>
                        <PoolStatusBadge status={tpl.enabled ? 'ENABLED' : 'DISABLED'} />
                      </div>
                    </div>

                    <div className="flex gap-3 text-xs text-zinc-500">
                      <span>⬡ {tpl.model}</span>
                      <span>v{tpl.version}</span>
                      <span>{tpl.permissions?.length ?? 0} perms</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {summarizeAgentConfig(tpl.config).map((item) => (
                        <span
                          key={`${tpl.id}-${item}`}
                          className="rounded-full border border-surface-border bg-surface-overlay px-2 py-0.5 text-[11px] text-zinc-300"
                        >
                          {item}
                        </span>
                      ))}
                    </div>

                    {canEdit && (
                      <div className="flex gap-2 mt-auto pt-2 border-t border-surface-border/50">
                        <button
                          onClick={() => openDeployModal(tpl)}
                          className="flex-1 py-1.5 rounded-lg text-xs border border-[color:var(--accent-500)]/40 text-indigo-300 hover:text-indigo-100 hover:border-indigo-400 transition"
                        >
                          Deploy
                        </button>
                        <button
                          onClick={() => setSandboxTarget(tpl)}
                          className="flex-1 py-1.5 rounded-lg text-xs border border-surface-border text-emerald-300 hover:text-emerald-100 hover:border-emerald-400 transition"
                        >
                          Sandbox
                        </button>
                        <button
                          onClick={() => toggleEnabled(tpl)}
                          className="flex-1 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)] transition"
                        >
                          {tpl.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => duplicate(tpl)}
                          className="flex-1 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)] transition"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => setEditing(tpl)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)] transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleting(tpl)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-600 hover:text-[color:var(--state-danger)] hover:border-[color:var(--state-danger)] transition"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <PoolPagination
              page={currentPage}
              totalPages={totalPages}
              total={total}
              limit={20}
              onPageChange={(p) => setOpts((o) => ({ ...o, page: p }))}
            />
          </>
        )}
      </div>

      {(creating || editing) && (
        <AgentPoolFormModal
          target={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            refresh();
          }}
        />
      )}

      <PoolConfirmDeleteDialog
        open={Boolean(deleting)}
        title="Delete agent template?"
        description={
          deleting ? (
            <>
              "<span className="text-zinc-200 font-medium">{deleting.name}</span>" will be permanently removed.
              Already-deployed tenant instances are unaffected.
            </>
          ) : ''
        }
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await agentsPoolService.remove(deleting.id);
          } catch {
            /* noop */
          }
          setDeleting(null);
          refresh();
        }}
      />

      <DeployToTenantModal
        open={Boolean(deployTarget)}
        onClose={() => setDeployTarget(null)}
        deployType="agent"
        itemName={deployTarget?.name ?? ''}
        itemDescription={deployTarget?.description}
        tenants={deployTenants}
        busy={deployBusy}
        error={deployError}
        result={deployResult}
        onDeploy={(tenantId, config) => handleDeployAgent(tenantId, config as AgentDeployConfig)}
        agentPrefill={{
          type: deployTarget?.type,
          defaultName: deployTarget?.name ?? '',
        }}
      />

      <AgentSandboxModal target={sandboxTarget} onClose={() => setSandboxTarget(null)} />
    </AdminShell>
  );
}

function AgentSandboxModal({
  target,
  onClose,
}: {
  target: AgentsPoolEntry | null;
  onClose: () => void;
}) {
  const SANDBOX_PRESETS = [
    'Draft a response to a new inbound customer asking for pricing, timing, and next steps.',
    'Triage an urgent support complaint from an enterprise customer and propose the next two actions.',
    'Review a finance approval request and explain whether it should be approved, rejected, or escalated.',
  ];
  const [prompt, setPrompt] = useState(
    SANDBOX_PRESETS[0],
  );
  const [knowledgeText, setKnowledgeText] = useState('');
  const [modelOverride, setModelOverride] = useState('');
  const [includeTools, setIncludeTools] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SandboxAgentTemplateResult | null>(null);
  const [history, setHistory] = useState<PersistedSandboxRun[]>([]);
  const [compareLeftId, setCompareLeftId] = useState('');
  const [compareRightId, setCompareRightId] = useState('');
  const [comparison, setComparison] = useState<SandboxRunComparison | null>(null);

  useEffect(() => {
    if (!target) return;
    void agentsPoolService
      .listSandboxRuns(target.id)
      .then((runs) => setHistory(runs))
      .catch(() => setHistory([]));
  }, [target]);

  async function runSandbox() {
    if (!target) return;
    setRunning(true);
    setError(null);
    try {
      const response = await agentsPoolService.sandboxRun(target.id, {
        prompt,
        includeTools,
        modelOverride: modelOverride.trim() || undefined,
        knowledgeSources: parseLines(knowledgeText),
      });
      setResult(response);
      const runs = await agentsPoolService.listSandboxRuns(target.id);
      setHistory(runs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sandbox run failed');
    } finally {
      setRunning(false);
    }
  }

  async function loadComparison() {
    if (!target || !compareLeftId || !compareRightId) return;
    try {
      const diff = await agentsPoolService.compareSandboxRuns(
        target.id,
        compareLeftId,
        compareRightId,
      );
      setComparison(diff);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    }
  }

  if (!target) return null;

  const responseDiff = comparison
    ? buildWordDiff(comparison.left.result.response, comparison.right.result.response)
    : null;
  const toolPlanDiff = comparison
    ? buildListDiff(comparison.left.result.toolPlan, comparison.right.result.toolPlan)
    : null;

  return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="button"
        tabIndex={0}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Sandbox Run: {target.name}</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Real bounded template exercise without tenant deployment or external side effects.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5">
          <div className="space-y-4">
            <div className="rounded-xl border border-surface-border bg-surface-overlay/40 p-4 space-y-3">
              <div>
                <label htmlFor="sandbox-prompt-preset" className="text-xs text-zinc-400 mb-1 block">Prompt preset</label>
                <select
                  id="sandbox-prompt-preset"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)] mb-3"
                >
                  {SANDBOX_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset.slice(0, 80)}
                    </option>
                  ))}
                </select>
                <label htmlFor="sandbox-prompt" className="text-xs text-zinc-400 mb-1 block">Prompt</label>
                <textarea
                  id="sandbox-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                />
              </div>
              <div>
                <label htmlFor="sandbox-model-override" className="text-xs text-zinc-400 mb-1 block">Model override</label>
                <input
                  id="sandbox-model-override"
                  value={modelOverride}
                  onChange={(e) => setModelOverride(e.target.value)}
                  placeholder={target.model}
                  className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                />
              </div>
              <div>
                <label htmlFor="sandbox-knowledge" className="text-xs text-zinc-400 mb-1 block">Extra knowledge sources</label>
                <textarea
                  id="sandbox-knowledge"
                  value={knowledgeText}
                  onChange={(e) => setKnowledgeText(e.target.value)}
                  rows={4}
                  placeholder={'kb:pricing-policy\ncollection:sales-playbooks'}
                  className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
                />
              </div>
              <label className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-overlay/60 px-3 py-2">
                <span>
                  <span className="block text-sm text-zinc-200">Include tool intent</span>
                  <span className="block text-xs text-zinc-500">Return intended tool plan without executing tools.</span>
                </span>
                <input
                  type="checkbox"
                  checked={includeTools}
                  onChange={(e) => setIncludeTools(e.target.checked)}
                  className="h-4 w-4"
                />
              </label>
              <button
                onClick={runSandbox}
                disabled={running || !prompt.trim()}
                className="w-full rounded-lg bg-[color:var(--accent-500)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {running ? 'Running…' : 'Run Sandbox'}
              </button>
              <button
                onClick={() => {
                  setPrompt(SANDBOX_PRESETS[0]);
                  setKnowledgeText('');
                  setModelOverride('');
                  setResult(null);
                  setError(null);
                }}
                className="w-full rounded-lg border border-surface-border px-4 py-2 text-sm text-zinc-300"
              >
                Reset Sandbox
              </button>
              {error && (
                <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ['Authority', result?.authorityLevel ?? '—'],
                ['Memory', result?.memoryPolicy ?? '—'],
                ['Input', result ? String(result.tokenUsage.input) : '—'],
                ['Total', result ? String(result.tokenUsage.total) : '—'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-surface-border bg-surface-overlay/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
                  <div className="mt-1 text-sm font-medium text-zinc-100">{value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-surface-border bg-surface-overlay/40 p-4">
              <h3 className="text-sm font-semibold text-zinc-100 mb-2">Sandbox response</h3>
              <div className="min-h-[180px] whitespace-pre-wrap text-sm text-zinc-300">
                {result?.response ?? 'Run the sandbox to inspect template output.'}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-surface-border bg-surface-overlay/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-zinc-100">Tool plan</h3>
                  <button
                    onClick={() => {
                      if (!result) return;
                      void navigator.clipboard.writeText(result.toolPlan.join('\n'));
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Copy
                  </button>
                </div>
                <div className="space-y-2">
                  {(result?.toolPlan ?? []).map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-lg border border-surface-border px-3 py-2 text-sm text-zinc-300">
                      {item}
                    </div>
                  ))}
                  {(result?.toolPlan?.length ?? 0) === 0 && (
                    <div className="text-sm text-zinc-500">No tool plan emitted yet.</div>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-surface-border bg-surface-overlay/40 p-4">
                <h3 className="text-sm font-semibold text-zinc-100 mb-2">Warnings</h3>
                <div className="space-y-2">
                  {(result?.warnings ?? []).map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-lg border border-amber-800/50 bg-yellow-950/30 px-3 py-2 text-sm text-amber-200">
                      {item}
                    </div>
                  ))}
                  {(result?.warnings?.length ?? 0) === 0 && (
                    <div className="text-sm text-zinc-500">No warnings.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface-overlay/40 p-4">
              <h3 className="text-sm font-semibold text-zinc-100 mb-2">Recent sandbox runs</h3>
              <div className="space-y-2">
                {history.map((entry, index) => (
                  <button
                    key={`${entry.createdAt}-${index}`}
                    onClick={() => {
                      setPrompt(entry.prompt);
                      setResult(entry.result);
                      setCompareLeftId((current) => current || entry.id);
                      setCompareRightId((current) => (current && current !== entry.id ? current : entry.id));
                    }}
                    className="w-full rounded-lg border border-surface-border px-3 py-2 text-left hover:bg-surface-overlay"
                  >
                    <div className="text-xs text-zinc-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                    <div className="text-sm text-zinc-200 truncate">{entry.prompt}</div>
                  </button>
                ))}
                {history.length === 0 && (
                  <div className="text-sm text-zinc-500">No sandbox history yet.</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface-overlay/40 p-4">
              <h3 className="text-sm font-semibold text-zinc-100 mb-3">Compare runs</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  aria-label="Select baseline run"
                  value={compareLeftId}
                  onChange={(e) => setCompareLeftId(e.target.value)}
                  className="rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm"
                >
                  <option value="">Select baseline</option>
                  {history.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Select comparison run"
                  value={compareRightId}
                  onChange={(e) => setCompareRightId(e.target.value)}
                  className="rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm"
                >
                  <option value="">Select comparison</option>
                  {history.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => void loadComparison()}
                disabled={!compareLeftId || !compareRightId}
                className="mt-3 rounded-lg border border-surface-border px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-50"
              >
                Compare
              </button>
              {comparison && (
                <div className="mt-3 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-surface-border px-3 py-2 text-sm text-zinc-300">
                      Response changed: {comparison.summary.responseChanged ? 'Yes' : 'No'}
                    </div>
                    <div className="rounded-lg border border-surface-border px-3 py-2 text-sm text-zinc-300">
                      Tool plan changed: {comparison.summary.toolPlanChanged ? 'Yes' : 'No'}
                    </div>
                    <div className="rounded-lg border border-surface-border px-3 py-2 text-sm text-zinc-300">
                      Token delta: {comparison.summary.tokenDelta}
                    </div>
                    <div className="rounded-lg border border-surface-border px-3 py-2 text-sm text-zinc-300">
                      Warning delta: {comparison.summary.warningDelta}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-surface-border bg-surface-overlay/40 p-4">
                      <div className="mb-2">
                        <div className="text-xs text-zinc-500">
                          Baseline · {new Date(comparison.left.createdAt).toLocaleString()}
                        </div>
                        <div className="text-sm font-medium text-zinc-100">{comparison.left.prompt}</div>
                      </div>
                      <div className="whitespace-pre-wrap rounded-lg border border-surface-border px-3 py-2 text-sm text-zinc-300">
                        {(responseDiff?.base ?? []).map((part, index) => (
                          <span
                            key={`${part.value}-${index}`}
                            className={part.changed ? 'bg-red-950/50 text-red-200' : undefined}
                          >
                            {part.value}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 space-y-1">
                        {(toolPlanDiff?.base ?? []).map((item, index) => (
                          <div
                            key={`${item.value}-${index}`}
                            className={`rounded-lg border px-3 py-2 text-xs ${
                              item.changed
                                ? 'border-amber-700/60 bg-amber-950/20 text-amber-200'
                                : 'border-surface-border text-zinc-400'
                            }`}
                          >
                            {item.value}
                          </div>
                        ))}
                        {(toolPlanDiff?.base.length ?? 0) === 0 && (
                          <div className="rounded-lg border border-surface-border px-3 py-2 text-xs text-zinc-500">
                            No tool plan.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-surface-border bg-surface-overlay/40 p-4">
                      <div className="mb-2">
                        <div className="text-xs text-zinc-500">
                          Comparison · {new Date(comparison.right.createdAt).toLocaleString()}
                        </div>
                        <div className="text-sm font-medium text-zinc-100">{comparison.right.prompt}</div>
                      </div>
                      <div className="whitespace-pre-wrap rounded-lg border border-surface-border px-3 py-2 text-sm text-zinc-300">
                        {(responseDiff?.compare ?? []).map((part, index) => (
                          <span
                            key={`${part.value}-${index}`}
                            className={part.changed ? 'bg-emerald-950/50 text-emerald-200' : undefined}
                          >
                            {part.value}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 space-y-1">
                        {(toolPlanDiff?.compare ?? []).map((item, index) => (
                          <div
                            key={`${item.value}-${index}`}
                            className={`rounded-lg border px-3 py-2 text-xs ${
                              item.changed
                                ? 'border-emerald-700/60 bg-emerald-950/20 text-emerald-200'
                                : 'border-surface-border text-zinc-400'
                            }`}
                          >
                            {item.value}
                          </div>
                        ))}
                        {(toolPlanDiff?.compare.length ?? 0) === 0 && (
                          <div className="rounded-lg border border-surface-border px-3 py-2 text-xs text-zinc-500">
                            No tool plan.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Keep the legacy edit form around for now, while we wire the new pool
// endpoints. We reuse the existing agentTemplatesService payload shape for
// editing, so the two services stay compatible.

function AgentPoolFormModal({
  target,
  onClose,
  onSaved,
}: {
  target: AgentsPoolEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AgentTemplate | CreateAgentsPoolInitial>(
    target ?? EMPTY,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DesignerTabId>('identity');
  const [permissionsText, setPermissionsText] = useState(
    ((target?.permissions ?? []) as string[]).join('\n'),
  );
  const initialStructuredConfig = coerceStructuredConfig(target?.config);
  const [structuredConfig, setStructuredConfig] = useState<AgentStructuredConfig>(
    initialStructuredConfig,
  );
  const [configText, setConfigText] = useState(
    JSON.stringify(buildConfigFromStructuredConfig(initialStructuredConfig), null, 2),
  );
  const [handoffTargetsText, setHandoffTargetsText] = useState(joinLines(initialStructuredConfig.handoffTargets));
  const [knowledgeSourcesText, setKnowledgeSourcesText] = useState(joinLines(initialStructuredConfig.knowledgeSources));
  const [allowedToolsText, setAllowedToolsText] = useState(joinLines(initialStructuredConfig.allowedTools));
  const [blockedToolsText, setBlockedToolsText] = useState(joinLines(initialStructuredConfig.blockedTools));
  const [channelsText, setChannelsText] = useState(joinLines(initialStructuredConfig.channels));
  const [tagsText, setTagsText] = useState(joinLines(initialStructuredConfig.tags));

  function syncConfig(next: AgentStructuredConfig) {
    setStructuredConfig(next);
    setConfigText(JSON.stringify(buildConfigFromStructuredConfig(next), null, 2));
  }

  function updateStructuredConfig<K extends keyof AgentStructuredConfig>(
    key: K,
    value: AgentStructuredConfig[K],
  ) {
    syncConfig({ ...structuredConfig, [key]: value });
  }

  async function save() {
    if (!(form as AgentTemplate).name.trim()) {
      setError('Name is required');
      return;
    }
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = configText.trim()
        ? (JSON.parse(configText) as Record<string, unknown>)
        : {};
    } catch {
      setError('Config must be valid JSON');
      return;
    }
    const permissions = parseLines(permissionsText);
    const normalizedConfig = coerceStructuredConfig(parsedConfig);
    normalizedConfig.handoffTargets = parseLines(handoffTargetsText);
    normalizedConfig.knowledgeSources = parseLines(knowledgeSourcesText);
    normalizedConfig.allowedTools = parseLines(allowedToolsText);
    normalizedConfig.blockedTools = parseLines(blockedToolsText);
    normalizedConfig.channels = parseLines(channelsText);
    normalizedConfig.tags = parseLines(tagsText);
    parsedConfig = buildConfigFromStructuredConfig(normalizedConfig);

    setBusy(true);
    setError(null);
    try {
      const payload: CreateAgentsPoolPayload = {
        ...(form as CreateAgentsPoolInitial),
        permissions,
        config: parsedConfig,
      };
      if (target) {
        await agentsPoolService.update(target.id, payload);
      } else {
        await agentsPoolService.create(payload);
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="button"
        tabIndex={0}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
      >
        <h2 className="text-base font-semibold text-zinc-100 mb-5">
          {target ? `Edit: ${target.name}` : 'Create Agent Template'}
        </h2>
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {DESIGNER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-[color:var(--accent-500)] text-white'
                    : 'border border-surface-border text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'identity' && (
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-zinc-500">Identity</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="agent-name" className="text-xs text-zinc-400 mb-1 block">Name *</label>
                  <input
                    id="agent-name"
                    value={(form as AgentTemplate).name}
                    onChange={(e) => setForm((f) => ({ ...(f as object), name: e.target.value } as AgentTemplate))}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                  />
                </div>
                <div>
                  <label htmlFor="agent-type" className="text-xs text-zinc-400 mb-1 block">Type</label>
                  <select
                    id="agent-type"
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as object), type: e.target.value } as AgentTemplate))
                    }
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                  >
                    {['CORE', 'FUNCTIONAL', 'EXECUTIVE', 'META'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="agent-model" className="text-xs text-zinc-400 mb-1 block">Model</label>
                  <input
                    id="agent-model"
                    value={(form as AgentTemplate).model ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as object), model: e.target.value } as AgentTemplate))
                    }
                    placeholder="gpt-4o-mini"
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                  />
                </div>
                <div>
                  <label htmlFor="agent-version" className="text-xs text-zinc-400 mb-1 block">Version</label>
                  <input
                    id="agent-version"
                    value={(form as AgentTemplate).version ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...(f as object), version: e.target.value } as AgentTemplate))
                    }
                    placeholder="1.0.0"
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="agent-description" className="text-xs text-zinc-400 mb-1 block">Description</label>
                <textarea
                  id="agent-description"
                  value={(form as AgentTemplate).description ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...(f as object), description: e.target.value } as AgentTemplate))
                  }
                  rows={3}
                  className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm resize-none focus:outline-none focus:border-[color:var(--accent-500)]"
                />
              </div>
              <div>
                <label htmlFor="agent-tags" className="text-xs text-zinc-400 mb-1 block">Tags (one per line)</label>
                <textarea
                  id="agent-tags"
                  value={tagsText}
                  onChange={(e) => {
                    setTagsText(e.target.value);
                    updateStructuredConfig('tags', parseLines(e.target.value));
                  }}
                  rows={3}
                  placeholder={'sales\nfinance\nfront-office'}
                  className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
                />
              </div>
            </section>
          )}

          {activeTab === 'behavior' && (
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-zinc-500">Behavior</h3>
              <div>
                <label htmlFor="agent-system-prompt" className="text-xs text-zinc-400 mb-1 block">System Prompt</label>
                <textarea
                  id="agent-system-prompt"
                  value={(form as AgentTemplate).systemPrompt ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...(f as object), systemPrompt: e.target.value } as AgentTemplate))
                  }
                  rows={8}
                  className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
                />
              </div>
              <div>
                <label htmlFor="agent-instructions" className="text-xs text-zinc-400 mb-1 block">Instructions (optional)</label>
                <textarea
                  id="agent-instructions"
                  value={(form as AgentTemplate).instructions ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...(f as object), instructions: e.target.value } as AgentTemplate))
                  }
                  rows={4}
                  className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm resize-none focus:outline-none focus:border-[color:var(--accent-500)]"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="agent-memory-policy" className="text-xs text-zinc-400 mb-1 block">Memory policy</label>
                  <select
                    id="agent-memory-policy"
                    value={structuredConfig.memoryPolicy}
                    onChange={(e) => updateStructuredConfig('memoryPolicy', e.target.value as MemoryPolicy)}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                  >
                    {['NONE', 'SESSION', 'TASK', 'TENANT'].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="agent-escalation-mode" className="text-xs text-zinc-400 mb-1 block">Escalation mode</label>
                  <select
                    id="agent-escalation-mode"
                    value={structuredConfig.escalationMode}
                    onChange={(e) => updateStructuredConfig('escalationMode', e.target.value as EscalationMode)}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                  >
                    {['NONE', 'MANAGER', 'HUMAN_REVIEW'].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="agent-max-actions" className="text-xs text-zinc-400 mb-1 block">Max actions / run</label>
                  <input
                    id="agent-max-actions"
                    type="number"
                    min={1}
                    max={100}
                    value={structuredConfig.maxActionsPerRun}
                    onChange={(e) =>
                      updateStructuredConfig(
                        'maxActionsPerRun',
                        Math.max(1, Number.parseInt(e.target.value || '1', 10)),
                      )
                    }
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="agent-channels" className="text-xs text-zinc-400 mb-1 block">Channels (one per line)</label>
                  <textarea
                    id="agent-channels"
                    value={channelsText}
                    onChange={(e) => {
                      setChannelsText(e.target.value);
                      updateStructuredConfig('channels', parseLines(e.target.value));
                    }}
                    rows={4}
                    placeholder={'web\nemail\nvoice'}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
                  />
                </div>
                <div>
                  <label htmlFor="agent-handoff-targets" className="text-xs text-zinc-400 mb-1 block">Handoff targets (one per line)</label>
                  <textarea
                    id="agent-handoff-targets"
                    value={handoffTargetsText}
                    onChange={(e) => {
                      setHandoffTargetsText(e.target.value);
                      updateStructuredConfig('handoffTargets', parseLines(e.target.value));
                    }}
                    rows={4}
                    placeholder={'account-executive\nfinance-manager'}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
                  />
                </div>
              </div>
            </section>
          )}

          {activeTab === 'governance' && (
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-zinc-500">Governance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="agent-authority-level" className="text-xs text-zinc-400 mb-1 block">Authority level</label>
                  <select
                    id="agent-authority-level"
                    value={structuredConfig.authorityLevel}
                    onChange={(e) => updateStructuredConfig('authorityLevel', e.target.value as AuthorityLevel)}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                  >
                    {['AUTO', 'RECOMMEND', 'APPROVAL'].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="agent-permissions" className="text-xs text-zinc-400 mb-1 block">Permissions (one per line)</label>
                  <textarea
                    id="agent-permissions"
                    value={permissionsText}
                    onChange={(e) => setPermissionsText(e.target.value)}
                    rows={4}
                    placeholder={'tasks:read\nworkflows:execute'}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="agent-allowed-tools" className="text-xs text-zinc-400 mb-1 block">Allowed tools (one per line)</label>
                  <textarea
                    id="agent-allowed-tools"
                    value={allowedToolsText}
                    onChange={(e) => {
                      setAllowedToolsText(e.target.value);
                      updateStructuredConfig('allowedTools', parseLines(e.target.value));
                    }}
                    rows={5}
                    placeholder={'createProject\ncreateInvoice'}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
                  />
                </div>
                <div>
                  <label htmlFor="agent-blocked-tools" className="text-xs text-zinc-400 mb-1 block">Blocked tools (one per line)</label>
                  <textarea
                    id="agent-blocked-tools"
                    value={blockedToolsText}
                    onChange={(e) => {
                      setBlockedToolsText(e.target.value);
                      updateStructuredConfig('blockedTools', parseLines(e.target.value));
                    }}
                    rows={5}
                    placeholder={'deleteTenant\nexportAllData'}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-overlay/60 px-3 py-2">
                  <span>
                    <span className="block text-sm text-zinc-200">Human review required</span>
                    <span className="block text-xs text-zinc-500">Route high-impact actions through review.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={structuredConfig.humanReviewRequired}
                    onChange={(e) => updateStructuredConfig('humanReviewRequired', e.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-overlay/60 px-3 py-2">
                  <span>
                    <span className="block text-sm text-zinc-200">Audit mode</span>
                    <span className="block text-xs text-zinc-500">Preserve evidence-first behavior and stricter traces.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={structuredConfig.auditMode}
                    onChange={(e) => updateStructuredConfig('auditMode', e.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
              </div>
            </section>
          )}

          {activeTab === 'knowledge' && (
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-zinc-500">Knowledge</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="agent-knowledge-sources" className="text-xs text-zinc-400 mb-1 block">Knowledge sources (one per line)</label>
                  <textarea
                    id="agent-knowledge-sources"
                    value={knowledgeSourcesText}
                    onChange={(e) => {
                      setKnowledgeSourcesText(e.target.value);
                      updateStructuredConfig('knowledgeSources', parseLines(e.target.value));
                    }}
                    rows={6}
                    placeholder={'kb:sales-playbook\ncollection:onboarding'}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
                  />
                </div>
                <div className="space-y-3">
                  <label className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-overlay/60 px-3 py-2">
                    <span>
                      <span className="block text-sm text-zinc-200">Require citations</span>
                      <span className="block text-xs text-zinc-500">Force grounded answers for knowledge-backed work.</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={structuredConfig.requiresCitations}
                      onChange={(e) => updateStructuredConfig('requiresCitations', e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-overlay/60 px-3 py-2">
                    <span>
                      <span className="block text-sm text-zinc-200">Tenant-editable template</span>
                      <span className="block text-xs text-zinc-500">Allow local tenant adaptation after deployment.</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={structuredConfig.allowTenantEditing}
                      onChange={(e) => updateStructuredConfig('allowTenantEditing', e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'advanced' && (
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-zinc-500">Advanced</h3>
              <div className="rounded-xl border border-surface-border bg-surface-overlay/40 p-3 text-xs text-zinc-500">
                Structured fields mirror into JSON automatically. Advanced JSON remains available for backward-compatible extension.
              </div>
              <textarea
                aria-label="Advanced JSON configuration"
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                rows={16}
                className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
              />
            </section>
          )}

          {error && (
            <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="flex-1 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
            >
              {busy ? 'Saving…' : target ? 'Save Changes' : 'Create Agent'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const EMPTY: CreateAgentsPoolInitial = {
  name: '',
  description: '',
  type: 'FUNCTIONAL',
  model: 'gpt-4o-mini',
  systemPrompt: '',
  instructions: '',
  permissions: [],
  config: { allowTenantEditing: true },
  version: '1.0.0',
  enabled: true,
};

interface CreateAgentsPoolInitial {
  name: string;
  description: string;
  type: 'CORE' | 'FUNCTIONAL' | 'EXECUTIVE' | 'META';
  model: string;
  systemPrompt: string;
  instructions: string;
  permissions: string[];
  config: Record<string, unknown>;
  version: string;
  enabled: boolean;
}

// `agentTemplatesService` is referenced for back-compat during the migration
// window; we don't call it here directly but keep it imported to avoid the
// stale entry warning when we re-export from the pool.
void agentTemplatesService;
