"use client";

/**
 * /llm-registry — Platform-admin LLM Provider Registry page.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.17.4-5.
 *
 * Renders:
 *   • Provider list (kind / status / baseUrl / secretRef-org-only)
 *   • Create-provider form with secretRef pointer (no plaintext keys)
 *   • Add-model flow per provider
 *   • Tenant binding overview (read-only on the admin side; full
 *     bindings live on the tenant workspace).
 *
 * Solid (frontend): SRP — page composes sub-components, no business logic.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Trash2,
  RefreshCw,
  KeyRound,
  Server,
} from 'lucide-react';

import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  listProviders,
  createProvider,
  deleteProvider,
  addModel,
  type LlmProvider,
  type LlmProviderKind,
  type LlmProviderStatus,
  type CreateProviderInput,
} from '@/services/llm-registry.service';

const KIND_OPTIONS: { value: LlmProviderKind; label: string }[] = [
  { value: 'OPENAI_COMPATIBLE', label: 'OpenAI-compatible HTTP' },
  { value: 'ANTHROPIC', label: 'Anthropic' },
  { value: 'GOOGLE', label: 'Google' },
  { value: 'COHERE', label: 'Cohere' },
  { value: 'INTERNAL_MOCK', label: 'Internal mock (test)' },
];

export default function LlmRegistryPage() {
  const user = useAdminAuth();
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProviders({ page: 1, limit: 50 });
      setProviders(res.items);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onCreate = async (input: CreateProviderInput) => {
    try {
      await createProvider(input);
      setShowCreate(false);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this provider? Existing bindings will block the delete.')) {
      return;
    }
    setBusyId(id);
    try {
      await deleteProvider(id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminShell user={user}>
      <div className="px-6 py-8 max-w-6xl">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Server className="h-6 w-6" /> LLM Provider Registry
            </h1>
            <p className="text-sm text-white/60 mt-1">
              Bring-your-own LLM endpoints with per-tenant model bindings.
              Secret values are stored in SecretProviderService — never here.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-1 rounded border border-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1 rounded bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-sm text-white"
            >
              <Plus className="h-4 w-4" /> Add provider
            </button>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-md border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/50">Total providers</div>
            <div className="text-2xl font-semibold text-white">{total}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/50">Active</div>
            <div className="text-2xl font-semibold text-emerald-400">
              {providers.filter((p) => p.status === 'ACTIVE').length}
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/50">Disabled / Draining</div>
            <div className="text-2xl font-semibold text-amber-400">
              {providers.filter((p) => p.status !== 'ACTIVE').length}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {showCreate && (
          <CreateProviderForm onCancel={() => setShowCreate(false)} onSubmit={onCreate} />
        )}

        <div className="rounded-md border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs text-white/60">
              <tr>
                <th className="text-left px-3 py-2">Slug</th>
                <th className="text-left px-3 py-2">Display name</th>
                <th className="text-left px-3 py-2">Kind</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Base URL</th>
                <th className="text-left px-3 py-2">Secret</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-white/40">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && providers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-white/40">
                    No providers registered.
                  </td>
                </tr>
              )}
              {providers.map((p) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-white/5"
                >
                  <td className="px-3 py-2 font-mono text-xs text-white/80">{p.slug}</td>
                  <td className="px-3 py-2 text-white">{p.displayName}</td>
                  <td className="px-3 py-2 text-xs text-white/60">{p.kind}</td>
                  <td className="px-3 py-2">
                    <StatusChip status={p.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-white/60 truncate max-w-xs">
                    {p.baseUrl}
                  </td>
                  <td className="px-3 py-2 text-xs text-white/40">
                    secretRef only
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(p.id)}
                      disabled={busyId === p.id}
                      className="rounded border border-white/10 p-1 text-white/60 hover:text-red-400 disabled:opacity-40"
                      aria-label={`Delete provider ${p.slug}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-md border border-white/10 p-4">
          <h2 className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> How secrets work
          </h2>
          <ul className="text-xs text-white/60 space-y-1 list-disc pl-5">
            <li>
              The provider row stores only <code className="text-white/80">secretRef</code>
              {' '}—for example <code className="text-white/80">env:OPENAI_API_KEY</code>.
            </li>
            <li>
              Resolution happens at call time through SecretProviderService,
              which logs every access via the security audit logger.
            </li>
            <li>
              Rotation: edit the env var, then call <code className="text-white/80">POST /bindings/:id/rotate</code> from the tenant workspace.
            </li>
          </ul>
        </div>
      </div>
    </AdminShell>
  );
}

function StatusChip({ status }: { status: LlmProviderStatus }) {
  const cls =
    status === 'ACTIVE'
      ? 'bg-emerald-500/15 text-emerald-300'
      : status === 'DRAINING'
        ? 'bg-amber-500/15 text-amber-300'
        : 'bg-zinc-500/15 text-zinc-300';
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {status}
    </span>
  );
}

function CreateProviderForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: CreateProviderInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [kind, setKind] = useState<LlmProviderKind>('OPENAI_COMPATIBLE');
  const [baseUrl, setBaseUrl] = useState('');
  const [secretRef, setSecretRef] = useState('env:');
  const [orgId, setOrgId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit({
        slug,
        displayName,
        kind,
        baseUrl,
        secretRef,
        orgId: orgId || undefined,
      });
      setSlug('');
      setDisplayName('');
      setBaseUrl('');
      setSecretRef('env:');
      setOrgId('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-4 rounded-md border border-white/10 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="slug (e.g. openai-prod)"
          aria-label="Slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
        />
        <input
          type="text"
          placeholder="display name"
          aria-label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
        />
        <select
          value={kind}
          aria-label="Kind"
          onChange={(e) => setKind(e.target.value as LlmProviderKind)}
          className="rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-zinc-900">
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="base URL (https://...)"
          aria-label="Base URL"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
        />
        <input
          type="text"
          placeholder="secret ref (env:OPENAI_API_KEY)"
          aria-label="Secret ref"
          value={secretRef}
          onChange={(e) => setSecretRef(e.target.value)}
          className="rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white font-mono"
        />
        <input
          type="text"
          placeholder="org id (optional)"
          aria-label="Org ID"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          className="rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
        />
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !slug || !displayName || !baseUrl || !secretRef}
          className="rounded bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {submitting ? 'Creating…' : 'Create provider'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-white/10 px-3 py-1.5 text-sm text-white/60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
