'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import TenantShell from '@/components/TenantShell';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { connectorsService, type Connector } from '@/services/connectors.service';

export default function TenantConnectorsPage() {
  const user = useTenantAuth();

  const [providers, setProviders] = useState<string[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');

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

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const canCreate = useMemo(() => name.trim().length > 0 && provider.trim().length > 0, [name, provider]);

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Connectors</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your CRM connectors</p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className="w-full rounded-md bg-surface px-3 py-2 text-sm border border-surface-border text-zinc-200"
              placeholder="Connector name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="w-full rounded-md bg-surface px-3 py-2 text-sm border border-surface-border text-zinc-200"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              className="rounded-md bg-violet-600 text-white text-sm px-3 py-2 disabled:opacity-50"
              disabled={!canCreate}
              onClick={async () => {
                await connectorsService.registerConnector({ name: name.trim(), provider });
                setName('');
                await fetchAll();
              }}
            >
              Register
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised">
          <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Connectors</h2>
            <button
              className="text-xs text-zinc-400 hover:text-white"
              onClick={() => void fetchAll()}
            >
              Refresh
            </button>
          </div>

          <div className="p-4 overflow-x-auto">
            {loading ? (
              <div className="py-8 text-center text-zinc-500 text-sm">Loading…</div>
            ) : connectors.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-sm">No connectors registered.</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="text-zinc-500">
                  <tr className="text-left">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Provider</th>
                    <th className="py-2 pr-4">Active</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-200">
                  {connectors.map((c) => (
                    <tr key={c.id} className="border-t border-surface-border/60">
                      <td className="py-2 pr-4">{c.name}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-zinc-300">{c.provider}</td>
                      <td className="py-2 pr-4">{c.isActive ? 'Yes' : 'No'}</td>
                      <td className="py-2 flex gap-2">
                        <button
                          className="px-2 py-1 text-xs rounded border border-surface-border text-zinc-300 hover:text-white"
                          onClick={async () => {
                            await connectorsService.syncConnector(c.id, 'contacts');
                          }}
                        >
                          Sync Contacts
                        </button>
                        <button
                          className="px-2 py-1 text-xs rounded border border-surface-border text-zinc-300 hover:text-white"
                          onClick={async () => {
                            await connectorsService.syncConnector(c.id, 'leads');
                          }}
                        >
                          Sync Leads
                        </button>
                        <button
                          className="px-2 py-1 text-xs rounded border border-surface-border text-zinc-300 hover:text-white"
                          onClick={async () => {
                            await connectorsService.deleteConnector(c.id);
                            await fetchAll();
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </TenantShell>
  );
}
