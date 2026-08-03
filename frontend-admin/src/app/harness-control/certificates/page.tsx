'use client';

import { useCallback, useEffect, useState } from 'react';
import { GlassPanel, PageHero } from '@neurecore/ui-visual';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { harnessControlService } from '@/services/harness-control.service';

export default function HarnessControlCertificatesPage() {
  const user = useAdminAuth();
  const [items, setItems] = useState<Awaited<ReturnType<typeof harnessControlService.certificates>>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string>('');

  const load = useCallback(async () => {
    try {
      setItems(await harnessControlService.certificates());
      setError('');
    } catch {
      setError('Certificates could not be loaded.');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const revoke = async (id: string) => {
    setBusy(id);
    try {
      await harnessControlService.revokeCertificate(id, 'Revoked via control center');
      await load();
    } catch (err) {
      setError(`Revoke rejected: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setBusy('');
    }
  };

  if (!user) return null;
  return (
    <AdminShell user={user}>
      <PageHero title="Capability Certificates" subtitle="Verdicts are server-derived. Only revoke is permitted from the UI." />
      <div className="mx-auto max-w-7xl space-y-4">
        {error && <div role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        <GlassPanel>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 text-gray-400">
                <tr>
                  <th className="p-4">Capability</th>
                  <th>Environment</th>
                  <th>Verdict</th>
                  <th>State</th>
                  <th>Issued</th>
                  <th>Expires</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-gray-900">
                    <td className="p-4 font-mono text-xs">{c.capabilityId}</td>
                    <td>{c.environment}</td>
                    <td>{c.verdict}</td>
                    <td>{c.state}</td>
                    <td>{new Date(c.issuedAt).toLocaleString()}</td>
                    <td>{new Date(c.expiresAt).toLocaleString()}</td>
                    <td className="p-4">
                      {c.state === 'ACTIVE' && (
                        <button disabled={busy === c.id} onClick={() => void revoke(c.id)} className="rounded bg-red-800 px-3 py-1 disabled:opacity-40">Revoke</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && <div className="p-8 text-center text-gray-500">No certificates visible.</div>}
          </div>
        </GlassPanel>
      </div>
    </AdminShell>
  );
}
