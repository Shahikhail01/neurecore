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

                    {canEdit && (
                      <div className="flex gap-2 mt-auto pt-2 border-t border-surface-border/50">
                        <button
                          onClick={() => openDeployModal(tpl)}
                          className="flex-1 py-1.5 rounded-lg text-xs border border-[color:var(--accent-500)]/40 text-indigo-300 hover:text-indigo-100 hover:border-indigo-400 transition"
                        >
                          Deploy
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
    </AdminShell>
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
  const [permissionsText, setPermissionsText] = useState(
    ((target?.permissions ?? []) as string[]).join('\n'),
  );
  const [configText, setConfigText] = useState(
    JSON.stringify(target?.config ?? { allowTenantEditing: true }, null, 2),
  );

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
    const permissions = permissionsText
      .split(/\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
      >
        <h2 className="text-base font-semibold text-zinc-100 mb-5">
          {target ? `Edit: ${target.name}` : 'Create Agent Template'}
        </h2>
        <div className="space-y-4">
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500">Identity</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Name *</label>
                <input
                  value={(form as AgentTemplate).name}
                  onChange={(e) => setForm((f) => ({ ...(f as object), name: e.target.value } as AgentTemplate))}
                  className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Type</label>
                <select
                  value={(form as AgentTemplate).type}
                  onChange={(e) =>
                    setForm(
                      (f) => ({ ...(f as object), type: e.target.value } as AgentTemplate),
                    )
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Model</label>
                <input
                  value={(form as AgentTemplate).model ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...(f as object), model: e.target.value } as AgentTemplate))
                  }
                  placeholder="gpt-4o-mini"
                  className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Version</label>
                <input
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
              <label className="text-xs text-zinc-400 mb-1 block">Description</label>
              <textarea
                value={(form as AgentTemplate).description ?? ''}
                onChange={(e) =>
                  setForm(
                    (f) => ({ ...(f as object), description: e.target.value } as AgentTemplate),
                  )
                }
                rows={2}
                className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm resize-none focus:outline-none focus:border-[color:var(--accent-500)]"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500">Prompting</h3>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">System Prompt</label>
              <textarea
                value={(form as AgentTemplate).systemPrompt ?? ''}
                onChange={(e) =>
                  setForm(
                    (f) => ({ ...(f as object), systemPrompt: e.target.value } as AgentTemplate),
                  )
                }
                rows={4}
                className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Instructions (optional)</label>
              <textarea
                value={(form as AgentTemplate).instructions ?? ''}
                onChange={(e) =>
                  setForm(
                    (f) => ({ ...(f as object), instructions: e.target.value } as AgentTemplate),
                  )
                }
                rows={2}
                className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm resize-none focus:outline-none focus:border-[color:var(--accent-500)]"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500">Permissions & Config</h3>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                Permissions (one per line)
              </label>
              <textarea
                value={permissionsText}
                onChange={(e) => setPermissionsText(e.target.value)}
                rows={3}
                placeholder={'tasks:read\nworkflows:execute'}
                className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Config (JSON)</label>
              <textarea
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
              />
            </div>
          </section>

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
