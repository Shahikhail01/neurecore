'use client';

import { useCallback, useEffect, useState } from 'react';
import { GlassPanel, PageHero } from '@neurecore/ui-visual';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { harnessControlService } from '@/services/harness-control.service';

export default function HarnessControlAuditPage() {
  const user = useAdminAuth();
  const [events, setEvents] = useState<Awaited<ReturnType<typeof harnessControlService.audit>>>([]);
  const [verify, setVerify] = useState<Awaited<ReturnType<typeof harnessControlService.verifyAudit>> | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [eventsRes, verifyRes] = await Promise.all([
        harnessControlService.audit(),
        harnessControlService.verifyAudit(),
      ]);
      setEvents(eventsRes);
      setVerify(verifyRes);
      setError('');
    } catch {
      setError('Audit log could not be loaded.');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!user) return null;
  return (
    <AdminShell user={user}>
      <PageHero title="Harness Audit Trail" subtitle="Append-only. Hash-chained. Verified independently." />
      <div className="mx-auto max-w-7xl space-y-4">
        {error && <div role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        <GlassPanel>
          <div className="flex items-center justify-between p-4 text-sm">
            <div>
              Chain verified: <span className={verify?.ok ? 'text-emerald-400' : 'text-red-400'}>{verify?.ok ? 'OK' : 'BROKEN'}</span>
              {verify?.brokenAt && <span className="ml-2 font-mono text-xs">first break: {verify.brokenAt}</span>}
            </div>
            <div>Events checked: {verify?.checked ?? 0}</div>
          </div>
        </GlassPanel>
        <GlassPanel>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 text-gray-400">
                <tr>
                  <th className="p-4">Created</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-gray-900">
                    <td className="p-4 font-mono text-xs">{new Date(e.createdAt).toLocaleString()}</td>
                    <td>{e.actorId}</td>
                    <td className="font-mono text-xs">{e.action}</td>
                    <td className="font-mono text-xs">{e.resourceType}/{e.resourceId.slice(0, 8)}</td>
                    <td className="font-mono text-xs">{e.eventHash.slice(0, 12)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!events.length && <div className="p-8 text-center text-gray-500">No audit events yet.</div>}
          </div>
        </GlassPanel>
      </div>
    </AdminShell>
  );
}
