'use client';

import { useCallback, useEffect, useState } from 'react';
import { GlassPanel, PageHero } from '@neurecore/ui-visual';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { harnessControlService } from '@/services/harness-control.service';

export default function HarnessControlWaiversPage() {
  const user = useAdminAuth();
  const [waivers, setWaivers] = useState<Awaited<ReturnType<typeof harnessControlService.waivers>>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string>('');

  const load = useCallback(async () => {
    try {
      setWaivers(await harnessControlService.waivers());
      setError('');
    } catch {
      setError('Waivers could not be loaded.');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, action: 'approve' | 'revoke') => {
    setBusy(id);
    try {
      if (action === 'approve') await harnessControlService.approveWaiver(id);
      else await harnessControlService.revokeWaiver(id, 'Revoked via control center');
      await load();
    } catch (err) {
      setError(`${action} was rejected: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setBusy('');
    }
  };

  if (!user) return null;
  return (
    <AdminShell user={user}>
      <PageHero title="Waivers" subtitle="Separation of duties: requester and owner cannot self-approve" />
      <div className="mx-auto max-w-7xl space-y-4">
        {error && <div role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        <GlassPanel>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 text-gray-400">
                <tr>
                  <th className="p-4">Capability</th>
                  <th>Scope</th>
                  <th>Owner</th>
                  <th>Requested by</th>
                  <th>Approved by</th>
                  <th>State</th>
                  <th>Expires</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {waivers.map((w) => (
                  <tr key={w.id} className="border-b border-gray-900">
                    <td className="p-4 font-mono text-xs">{w.capabilityId}</td>
                    <td>{w.scope}</td>
                    <td>{w.ownerId}</td>
                    <td>{w.requestedBy}</td>
                    <td>{w.approvedBy ?? '—'}</td>
                    <td>{w.state}</td>
                    <td>{new Date(w.expiresAt).toLocaleString()}</td>
                    <td className="p-4 space-x-2">
                      {w.state === 'PENDING_APPROVAL' && (
                        <button disabled={busy === w.id} onClick={() => void act(w.id, 'approve')} className="rounded bg-emerald-700 px-3 py-1 disabled:opacity-40">Approve</button>
                      )}
                      {w.state === 'ACTIVE' && (
                        <button disabled={busy === w.id} onClick={() => void act(w.id, 'revoke')} className="rounded bg-red-800 px-3 py-1 disabled:opacity-40">Revoke</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!waivers.length && <div className="p-8 text-center text-gray-500">No waivers.</div>}
          </div>
        </GlassPanel>
      </div>
    </AdminShell>
  );
}
