'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GlassPanel, PageHero } from '@neurecore/ui-visual';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { harnessControlService } from '@/services/harness-control.service';

export default function HarnessControlReplayPage() {
  const user = useAdminAuth();
  const [bundles, setBundles] = useState<Awaited<ReturnType<typeof harnessControlService.replayBundles>>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string>('');
  const [result, setResult] = useState<string>('');

  const load = useCallback(async () => {
    try {
      setBundles(await harnessControlService.replayBundles());
      setError('');
    } catch {
      setError('Replay bundles could not be loaded.');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const execute = async (bundleId: string, env: string, sideEffects: boolean) => {
    if (sideEffects || env === 'PRODUCTION') {
      setResult('Refused: side-effect firewall would block this execution.');
      return;
    }
    setBusy(bundleId);
    setResult('');
    try {
      const r = await harnessControlService.executeReplay(bundleId);
      setResult(`Replay ${r.id} executed in sandbox state=${r.state}.`);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Replay was rejected.';
      setResult(`Denied: ${msg}`);
    } finally {
      setBusy('');
    }
  };

  const sorted = useMemo(() => [...bundles], [bundles]);

  if (!user) return null;
  return (
    <AdminShell user={user}>
      <PageHero title="Replay Bundles" subtitle="Side-effect firewall: PRODUCTION and external side-effects are refused" />
      <div className="mx-auto max-w-7xl space-y-4">
        {error && <div role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        {result && <div role="status" className="rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{result}</div>}
        <GlassPanel>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 text-gray-400">
                <tr>
                  <th className="p-4">Bundle</th>
                  <th>Source run</th>
                  <th>Environment</th>
                  <th>Side effects</th>
                  <th>Schema</th>
                  <th>Checksum</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b) => (
                  <tr key={b.id} className="border-b border-gray-900">
                    <td className="p-4 font-mono text-xs">{b.id.slice(0, 8)}</td>
                    <td className="font-mono text-xs">{b.sourceRunId.slice(0, 8)}</td>
                    <td>{b.environment}</td>
                    <td>{b.externalSideEffects ? 'External' : 'Sandboxed'}</td>
                    <td>{b.schemaVersion}</td>
                    <td className="font-mono text-xs">{b.checksum.slice(0, 12)}…</td>
                    <td className="p-4">
                      <button
                        disabled={busy === b.id || b.externalSideEffects || b.environment === 'PRODUCTION'}
                        onClick={() => void execute(b.id, b.environment, b.externalSideEffects)}
                        className="rounded bg-violet-700 px-3 py-1 text-white disabled:opacity-40"
                      >
                        Execute (safe sandbox)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!sorted.length && <div className="p-8 text-center text-gray-500">No replay bundles are visible.</div>}
          </div>
        </GlassPanel>
      </div>
    </AdminShell>
  );
}
