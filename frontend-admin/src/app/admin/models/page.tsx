'use client';

/**
 * /admin/models — AI Gateway catalog management
 *
 * Per ai-gateway-imp-plan.md §7.4: three tabs (Providers, Models,
 * Per-tenant overrides). All mutations call the SuperAdmin-only
 * `/api/v1/admin/models/*` endpoints. Live health is read from
 * `/api/v1/admin/models/health`. Cost summary is read from
 * `/api/v1/admin/models/cost-summary?days=30`.
 *
 * The legacy `/models` page redirects here.
 */

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import { unwrapArrayOrEmpty, unwrapItem } from '@/services/unwrap';

type Tab = 'providers' | 'models' | 'overrides' | 'health';

interface Provider {
  id: string;
  slug: string;
  name: string;
  apiBaseUrl: string;
  apiKeyEnv: string;
  isActive: boolean;
  models?: Array<{ id: string; modelId: string }>;
}

interface Model {
  id: string;
  modelId: string;
  displayName: string;
  capabilities: string[];
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  priority: number;
  isDefault: boolean;
  isAvailable: boolean;
  provider: { id: string; slug: string; name: string };
}

interface Override {
  id: string;
  tenantId: string;
  capability: string;
  aiModelId: string;
  priority: number;
}

interface HealthReport {
  circuit: Array<{ key: string; state: string; failures: number }>;
  booted: boolean;
}

interface CostSummary {
  days: number;
  rows: Array<{
    provider: string;
    model: string;
    _sum: { costCents: unknown; inputTokens: number; outputTokens: number };
    _count: { _all: number };
  }>;
}

const CAPABILITIES = [
  'planning',
  'execution',
  'reasoning',
  'conversation',
  'coding',
  'tools',
  'evaluation',
  'embedding',
] as const;

export default function AdminModelsPage() {
  const user = useAdminAuth();
  const [tab, setTab] = useState<Tab>('providers');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [cost, setCost] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [prov, mod, h, c] = await Promise.all([
        api.get('/api/v1/admin/models/providers'),
        api.get('/api/v1/admin/models'),
        api.get('/api/v1/admin/models/health'),
        api.get('/api/v1/admin/models/cost-summary?days=30'),
      ]);
      setProviders(unwrapArrayOrEmpty(prov) as Provider[]);
      setModels(unwrapArrayOrEmpty(mod) as Model[]);
      setHealth(unwrapItem(h) as HealthReport);
      setCost(unwrapItem(c) as CostSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-[1400px] mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            AI Gateway
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Manage providers, models, and per-tenant overrides. Single
            source of truth for every LLM call in the backend.
          </p>
        </div>

        {error ? (
          <div className="rounded-md border border-red-800 bg-[color:var(--state-danger)]/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-b border-surface-border">
          {(['providers', 'models', 'overrides', 'health'] as const).map(
            (t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm border-b-2 ${
                  tab === t
                    ? 'border-[color:var(--state-info)] text-zinc-100'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t === 'providers'
                  ? 'Providers'
                  : t === 'models'
                    ? 'Models'
                    : t === 'overrides'
                      ? 'Per-tenant Overrides'
                      : 'Health & Cost'}
              </button>
            ),
          )}
          <button
            onClick={() => void load()}
            disabled={loading}
            className="ml-auto px-3 py-1 text-xs rounded border border-surface-border text-zinc-400 hover:text-zinc-100 disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {tab === 'providers' ? (
          <ProvidersTab
            providers={providers}
            onChanged={() => void load()}
          />
        ) : null}
        {tab === 'models' ? <ModelsTab models={models} onChanged={() => void load()} /> : null}
        {tab === 'overrides' ? (
          <OverridesTab models={models} onChanged={() => void load()} />
        ) : null}
        {tab === 'health' ? (
          <HealthTab health={health} cost={cost} providers={providers} />
        ) : null}
      </div>
    </AdminShell>
  );
}

// ─── Tab 1: Providers ─────────────────────────────────────────────

function ProvidersTab({
  providers,
  onChanged,
}: {
  providers: Provider[];
  onChanged: () => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({
    slug: '',
    name: '',
    apiBaseUrl: '',
    apiKeyEnv: '',
    isActive: true,
  });
  const [busy, setBusy] = useState(false);

  async function create(): Promise<void> {
    setBusy(true);
    try {
      await api.post('/api/v1/admin/models/providers', draft);
      setShowNew(false);
      setDraft({ slug: '', name: '', apiBaseUrl: '', apiKeyEnv: '', isActive: true });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(p: Provider): Promise<void> {
    setBusy(true);
    try {
      await api.patch(`/api/v1/admin/models/providers/${p.id}`, {
        isActive: !p.isActive,
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowNew((v) => !v)}
          className="px-3 py-1 text-sm rounded bg-[color:var(--state-info)] hover:bg-[color:var(--state-info)] text-white"
        >
          {showNew ? 'Cancel' : 'New provider'}
        </button>
      </div>
      {showNew ? (
        <div className="rounded-lg border border-surface-border bg-surface-raised p-4 grid grid-cols-2 gap-3">
          <input
            placeholder="slug (e.g. openai)"
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            className="px-2 py-1 rounded bg-surface-sunken text-sm text-zinc-100"
          />
          <input
            placeholder="Display name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="px-2 py-1 rounded bg-surface-sunken text-sm text-zinc-100"
          />
          <input
            placeholder="API base URL"
            value={draft.apiBaseUrl}
            onChange={(e) => setDraft({ ...draft, apiBaseUrl: e.target.value })}
            className="col-span-2 px-2 py-1 rounded bg-surface-sunken text-sm text-zinc-100"
          />
          <input
            placeholder="Env var name (e.g. OPENAI_API_KEY)"
            value={draft.apiKeyEnv}
            onChange={(e) => setDraft({ ...draft, apiKeyEnv: e.target.value })}
            className="col-span-2 px-2 py-1 rounded bg-surface-sunken text-sm text-zinc-100"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
            />
            Active
          </label>
          <button
            onClick={create}
            disabled={busy || !draft.slug || !draft.name || !draft.apiBaseUrl || !draft.apiKeyEnv}
            className="col-span-2 px-3 py-1.5 text-sm rounded bg-[color:var(--state-success)] hover:bg-[color:var(--state-success)] text-white disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create provider'}
          </button>
        </div>
      ) : null}

      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="px-3 py-2">Slug</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Base URL</th>
            <th className="px-3 py-2">Env var</th>
            <th className="px-3 py-2">Models</th>
            <th className="px-3 py-2">Active</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((p) => (
            <tr key={p.id} className="border-t border-surface-border">
              <td className="px-3 py-2 font-mono text-zinc-200">{p.slug}</td>
              <td className="px-3 py-2 text-zinc-200">{p.name}</td>
              <td className="px-3 py-2 text-zinc-400 text-xs">{p.apiBaseUrl}</td>
              <td className="px-3 py-2 font-mono text-zinc-400 text-xs">
                {p.apiKeyEnv}
              </td>
              <td className="px-3 py-2 text-zinc-400">
                {p.models?.length ?? 0}
              </td>
              <td className="px-3 py-2">
                <button
                  onClick={() => void toggle(p)}
                  disabled={busy}
                  className={`px-2 py-0.5 rounded text-xs ${
                    p.isActive
                      ? 'bg-emerald-700 text-emerald-100'
                      : 'bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {p.isActive ? 'on' : 'off'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab 2: Models ────────────────────────────────────────────────

function ModelsTab({
  models,
  onChanged,
}: {
  models: Model[];
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);

  async function toggle(m: Model): Promise<void> {
    setBusy(true);
    try {
      await api.patch(`/api/v1/admin/models/${m.id}`, {
        isAvailable: !m.isAvailable,
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(m: Model): Promise<void> {
    setBusy(true);
    try {
      await api.patch(`/api/v1/admin/models/${m.id}`, {
        isDefault: !m.isDefault,
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const filtered = models.filter((m) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return (
      m.modelId.toLowerCase().includes(f) ||
      m.displayName.toLowerCase().includes(f) ||
      m.provider.slug.toLowerCase().includes(f) ||
      m.capabilities.some((c) => c.toLowerCase().includes(f))
    );
  });

  return (
    <div className="space-y-3">
      <input
        placeholder="Filter by model id, name, provider, capability…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full px-3 py-1.5 rounded bg-surface-sunken text-sm text-zinc-100"
      />
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">Model</th>
            <th className="px-3 py-2">Capabilities</th>
            <th className="px-3 py-2">Context</th>
            <th className="px-3 py-2">$ / 1K in</th>
            <th className="px-3 py-2">$ / 1K out</th>
            <th className="px-3 py-2">Default</th>
            <th className="px-3 py-2">Available</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((m) => (
            <tr key={m.id} className="border-t border-surface-border">
              <td className="px-3 py-2 text-zinc-400">{m.provider.slug}</td>
              <td className="px-3 py-2 font-mono text-zinc-100">
                {m.modelId}
              </td>
              <td className="px-3 py-2 text-zinc-400 text-xs">
                {m.capabilities.join(', ')}
              </td>
              <td className="px-3 py-2 text-zinc-400 text-xs">
                {m.contextWindow.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-zinc-400 text-xs">
                {m.costPer1kInput.toFixed(4)}
              </td>
              <td className="px-3 py-2 text-zinc-400 text-xs">
                {m.costPer1kOutput.toFixed(4)}
              </td>
              <td className="px-3 py-2">
                <button
                  onClick={() => void setDefault(m)}
                  disabled={busy}
                  className={`px-2 py-0.5 rounded text-xs ${
                    m.isDefault
                      ? 'bg-blue-700 text-blue-100'
                      : 'bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {m.isDefault ? '★' : '☆'}
                </button>
              </td>
              <td className="px-3 py-2">
                <button
                  onClick={() => void toggle(m)}
                  disabled={busy}
                  className={`px-2 py-0.5 rounded text-xs ${
                    m.isAvailable
                      ? 'bg-emerald-700 text-emerald-100'
                      : 'bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {m.isAvailable ? 'on' : 'off'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab 3: Per-tenant overrides ──────────────────────────────────

function OverridesTab({
  models,
  onChanged,
}: {
  models: Model[];
  onChanged: () => void;
}) {
  const [tenantId, setTenantId] = useState('');
  const [capability, setCapability] = useState<string>('conversation');
  const [aiModelId, setAiModelId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (!tenantId || !aiModelId) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.post(
        `/api/v1/admin/tenants/${tenantId}/model-overrides`,
        { capability, aiModelId, priority: 100 },
      );
      setMessage(`Override set for tenant ${tenantId} / ${capability}`);
      onChanged();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'Failed to set override',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="rounded-lg border border-surface-border bg-surface-raised p-4 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-200">
          Set a per-tenant override
        </h2>
        <p className="text-xs text-zinc-500">
          Overrides take effect within the gateway cache TTL (60s).
        </p>
        <input
          placeholder="Tenant ID"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="w-full px-2 py-1 rounded bg-surface-sunken text-sm text-zinc-100"
        />
        <select
          value={capability}
          onChange={(e) => setCapability(e.target.value)}
          className="w-full px-2 py-1 rounded bg-surface-sunken text-sm text-zinc-100"
        >
          {CAPABILITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={aiModelId}
          onChange={(e) => setAiModelId(e.target.value)}
          className="w-full px-2 py-1 rounded bg-surface-sunken text-sm text-zinc-100"
        >
          <option value="">— pick a model —</option>
          {models
            .filter((m) => m.isAvailable)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.provider.slug}/{m.modelId} ({m.displayName})
              </option>
            ))}
        </select>
        <button
          onClick={submit}
          disabled={busy || !tenantId || !aiModelId}
          className="px-3 py-1.5 text-sm rounded bg-[color:var(--state-success)] hover:bg-[color:var(--state-success)] text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Set override'}
        </button>
        {message ? (
          <div className="text-xs text-zinc-400">{message}</div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Tab 4: Health + cost summary ─────────────────────────────────

function HealthTab({
  health,
  cost,
  providers,
}: {
  health: HealthReport | null;
  cost: CostSummary | null;
  providers: Provider[];
}) {
  if (!health || !cost) {
    return (
      <div className="text-sm text-zinc-500">Loading health data…</div>
    );
  }
  const byProvider = new Map(providers.map((p) => [p.slug, p]));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-lg border border-surface-border bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-zinc-200 mb-2">
          Circuit breakers
        </h2>
        {health.circuit.length === 0 ? (
          <div className="text-xs text-zinc-500">
            No active circuit state recorded. Every provider/mode pair
            is in CLOSED (normal).
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="px-2 py-1">Key</th>
                <th className="px-2 py-1">State</th>
                <th className="px-2 py-1">Failures</th>
              </tr>
            </thead>
            <tbody>
              {health.circuit.map((c) => (
                <tr key={c.key} className="border-t border-surface-border">
                  <td className="px-2 py-1 font-mono text-zinc-200">
                    {c.key}
                  </td>
                  <td className="px-2 py-1 text-zinc-300">{c.state}</td>
                  <td className="px-2 py-1 text-zinc-400">{c.failures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="rounded-lg border border-surface-border bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-zinc-200 mb-2">
          Cost summary (last {cost.days}d)
        </h2>
        {cost.rows.length === 0 ? (
          <div className="text-xs text-zinc-500">
            No CostRecord rows in the window.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="px-2 py-1">Provider</th>
                <th className="px-2 py-1">Model</th>
                <th className="px-2 py-1">Calls</th>
                <th className="px-2 py-1">Tokens in / out</th>
                <th className="px-2 py-1">¢</th>
              </tr>
            </thead>
            <tbody>
              {cost.rows.map((r, i) => (
                <tr key={i} className="border-t border-surface-border">
                  <td className="px-2 py-1 text-zinc-200">{r.provider}</td>
                  <td className="px-2 py-1 font-mono text-zinc-300">
                    {r.model}
                  </td>
                  <td className="px-2 py-1 text-zinc-400">
                    {r._count._all}
                  </td>
                  <td className="px-2 py-1 text-zinc-400 text-xs">
                    {(r._sum.inputTokens ?? 0).toLocaleString()} /{' '}
                    {(r._sum.outputTokens ?? 0).toLocaleString()}
                  </td>
                  <td className="px-2 py-1 text-zinc-200">
                    {String(r._sum.costCents ?? '0')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {providers.length === 0 ? null : (
          <div className="mt-3 text-xs text-zinc-500">
            {providers.length} provider
            {providers.length === 1 ? '' : 's'} registered.
          </div>
        )}
        <div className="mt-2 text-xs text-zinc-500">
          Provider map:{' '}
          {Array.from(byProvider.entries())
            .map(([slug, p]) => `${slug} → ${p.apiKeyEnv}`)
            .join(' · ')}
        </div>
      </div>
    </div>
  );
}
