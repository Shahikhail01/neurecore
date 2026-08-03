'use client';

import { useCallback, useEffect, useState } from 'react';
import { GlassPanel, PageHero } from '@neurecore/ui-visual';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { harnessControlService, type HarnessDashboard, type HarnessRun } from '@/services/harness-control.service';

const tabs = ['Runs', 'Configuration', 'Waivers', 'Certificates', 'Audit'];

export default function HarnessControlPage() {
  const user = useAdminAuth();
  const [dashboard, setDashboard] = useState<HarnessDashboard | null>(null);
  const [runs, setRuns] = useState<HarnessRun[]>([]);
  const [tab, setTab] = useState('Runs');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const [summary, runItems] = await Promise.all([harnessControlService.dashboard(), harnessControlService.runs()]);
      setDashboard(summary);
      setRuns(runItems);
      setError('');
    } catch {
      setError('Harness control data is unavailable. No operation was attempted.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, action: 'approve' | 'cancel') => {
    setBusy(id);
    try {
      if (action === 'approve') await harnessControlService.approveRun(id);
      else await harnessControlService.cancelRun(id);
      await load();
    } catch {
      setError(`Run ${action} was denied or failed.`);
    } finally {
      setBusy('');
    }
  };

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <PageHero title="Harness Control Center" subtitle="Governed operations, immutable evidence, independent approvals" />
      <div className="mx-auto max-w-7xl space-y-5">
        {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ['Pending approvals', dashboard?.pendingApprovals],
            ['Active certificates', dashboard?.activeCertificates],
            ['Active waivers', dashboard?.activeWaivers],
            ['Catalog scenarios', dashboard?.capabilities],
            ['Integrity issues', dashboard?.integrityIssues],
          ].map(([label, value]) => <GlassPanel key={String(label)}><div className="p-4"><div className="text-xs text-gray-400">{label}</div><div className="mt-2 text-2xl font-semibold">{value ?? '—'}</div></div></GlassPanel>)}
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Harness resources">
          {tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`rounded-lg px-4 py-2 text-sm ${tab === item ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-300'}`}>{item}</button>)}
        </div>
        {tab === 'Runs' ? (
          <GlassPanel>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-800 text-gray-400"><tr><th className="p-4">Capability / scenario</th><th>Environment</th><th>Status</th><th>Evidence</th><th>Safety</th><th className="p-4">Actions</th></tr></thead>
                <tbody>{runs.map((run) => <tr key={run.id} className="border-b border-gray-900"><td className="p-4"><div>{run.capabilityId}</div><div className="text-xs text-gray-500">{run.scenarioId}</div></td><td>{run.environment}</td><td>{run.state}</td><td>{run._count?.evidence ?? 0}</td><td>{run.destructive ? 'Destructive' : 'Non-destructive'}</td><td className="p-4 space-x-2">{run.state === 'REQUESTED' && <button disabled={busy === run.id} onClick={() => void act(run.id, 'approve')} className="rounded bg-emerald-700 px-3 py-1 disabled:opacity-50">Approve</button>}{['REQUESTED', 'APPROVED', 'RUNNING'].includes(run.state) && <button disabled={busy === run.id} onClick={() => void act(run.id, 'cancel')} className="rounded bg-red-800 px-3 py-1 disabled:opacity-50">Cancel</button>}</td></tr>)}</tbody>
              </table>
              {!runs.length && <div className="p-8 text-center text-gray-500">No harness runs are visible.</div>}
            </div>
          </GlassPanel>
        ) : (
          <GlassPanel><div className="p-8"><h2 className="text-lg font-semibold">{tab}</h2><p className="mt-2 text-sm text-gray-400">Read and mutation APIs are governed server-side. Raw evidence and finalized verdict editing are not exposed.</p></div></GlassPanel>
        )}
      </div>
    </AdminShell>
  );
}
