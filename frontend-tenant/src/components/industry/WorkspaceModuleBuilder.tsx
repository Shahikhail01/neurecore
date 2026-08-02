'use client';

/**
 * WorkspaceModuleBuilder — generic React builder for workspace module pages.
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §6.1.3 (P1) — single component
 * renders list + detail + edit views from a WorkspaceModuleConfig. Adding
 * a new module = one config file (per §6.1.4), zero new component code.
 *
 * Lives alongside the existing IndustryWorkspacePage (which is project-list-
 * specific for F&C). Future workspace modules (Tickets/Releases/Contracts/KB
 * for B&T; Products/Orders/Inventory/Stores/Promotions/Campaigns/Content for
 * Consumer; Programs/Grants/Field Operations/Cases for NGO; Operations/Assets/
 * Documents for SPO) all use this builder.
 *
 * SOLID:
 *   - S: each module config declares its own data model; builder is generic.
 *   - O: new module = one config file; no component changes.
 *   - I: config shape is the only contract consumers depend on.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { GlassPanel, StatTile, StatRow } from '@neurecore/ui-visual';
import api from '@/services/api';
import type { WorkspaceModuleConfig, WorkspaceFieldDef } from '@/lib/industry-workspace-models';

interface Props {
  config: WorkspaceModuleConfig;
}

interface ListItem {
  id: string;
  [k: string]: unknown;
}

export function WorkspaceModuleBuilder({ config }: Props) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formState, setFormState] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await api.get(config.apiBase);
        if (cancelled) return;
        setItems((res.data?.data ?? []) as ListItem[]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [config.apiBase]);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  if (loading) {
    return (
      <GlassPanel>
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading {config.label.toLowerCase()}…
        </div>
      </GlassPanel>
    );
  }

  if (error) {
    return (
      <GlassPanel>
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      </GlassPanel>
    );
  }

  return (
    <div className="space-y-4">
      <GlassPanel>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">{config.label}</h1>
            <p className="text-sm text-zinc-400 mt-1">{config.description}</p>
          </div>
          {config.actions?.includes('create') && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
            >
              <Plus className="h-4 w-4" />
              New {config.label.replace(/s$/, '')}
            </button>
          )}
        </div>
      </GlassPanel>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <GlassPanel>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">
              {config.label} ({items.length})
            </h2>
            <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                      selectedId === item.id
                        ? 'bg-primary/20 text-zinc-100'
                        : 'hover:bg-white/5 text-zinc-300'
                    }`}
                  >
                    <div className="font-medium">{String(item.name ?? item.title ?? item.id)}</div>
                    {item.status !== undefined && (
                      <div className="text-xs text-zinc-500 mt-0.5">{String(item.status)}</div>
                    )}
                  </button>
                </li>
              ))}
              {items.length === 0 && (
                <li className="text-sm text-zinc-500 px-3 py-4 text-center">
                  No {config.label.toLowerCase()} yet. Create one to get started.
                </li>
              )}
            </ul>
          </GlassPanel>
        </div>

        <div className="col-span-8">
          {creating ? (
            <GlassPanel>
              <CreateForm
                config={config}
                formState={formState}
                setFormState={setFormState}
                onCancel={() => { setCreating(false); setFormState({}); }}
                onCreated={(created) => {
                  setItems([...items, created]);
                  setCreating(false);
                  setFormState({});
                  setSelectedId(String(created.id));
                }}
              />
            </GlassPanel>
          ) : selected ? (
            <GlassPanel>
              <DetailView config={config} item={selected} />
            </GlassPanel>
          ) : (
            <GlassPanel>
              <div className="text-sm text-zinc-500 text-center py-12">
                Select a {config.label.toLowerCase().replace(/s$/, '')} from the list, or create a new one.
              </div>
            </GlassPanel>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateForm({
  config,
  formState,
  setFormState,
  onCancel,
  onCreated,
}: {
  config: WorkspaceModuleConfig;
  formState: Record<string, unknown>;
  setFormState: (s: Record<string, unknown>) => void;
  onCancel: () => void;
  onCreated: (item: ListItem) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(config.apiBase, formState);
      onCreated((res.data?.data ?? {}) as ListItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-300">New {config.label.replace(/s$/, '')}</h2>
      {config.fields.map((f) => (
        <FieldInput key={f.key} field={f} value={formState[f.key]} onChange={(v) => setFormState({ ...formState, [f.key]: v })} />
      ))}
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-md border border-white/10 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: WorkspaceFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const baseInput = `w-full px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-sm text-zinc-100`;
  switch (field.type) {
    case 'enum':
      return (
        <label className="block">
          <div className="text-xs text-zinc-400 mb-1">{field.label}{field.required ? ' *' : ''}</div>
          <select className={baseInput} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
            <option value="">—</option>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
      );
    case 'boolean':
      return (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          <span className="text-sm text-zinc-200">{field.label}</span>
        </label>
      );
    case 'number':
      return (
        <label className="block">
          <div className="text-xs text-zinc-400 mb-1">{field.label}{field.required ? ' *' : ''}</div>
          <input type="number" className={baseInput} value={String(value ?? '')} onChange={(e) => onChange(Number(e.target.value))} />
        </label>
      );
    case 'date':
      return (
        <label className="block">
          <div className="text-xs text-zinc-400 mb-1">{field.label}{field.required ? ' *' : ''}</div>
          <input type="date" className={baseInput} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
    case 'datetime':
      return (
        <label className="block">
          <div className="text-xs text-zinc-400 mb-1">{field.label}{field.required ? ' *' : ''}</div>
          <input type="datetime-local" className={baseInput} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
    case 'markdown':
      return (
        <label className="block">
          <div className="text-xs text-zinc-400 mb-1">{field.label}{field.required ? ' *' : ''}</div>
          <textarea rows={5} className={baseInput} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
    case 'text':
    default:
      return (
        <label className="block">
          <div className="text-xs text-zinc-400 mb-1">{field.label}{field.required ? ' *' : ''}</div>
          <input
            type="text"
            className={baseInput}
            value={String(value ?? '')}
            placeholder={field.placeholder ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      );
  }
}

function DetailView({ config, item }: { config: WorkspaceModuleConfig; item: ListItem }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-100">{String(item.name ?? item.title ?? item.id)}</h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {config.fields.map((f) => (
          <div key={f.key}>
            <dt className="text-xs text-zinc-400">{f.label}</dt>
            <dd className="text-zinc-200">{String(item[f.key] ?? '—')}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}