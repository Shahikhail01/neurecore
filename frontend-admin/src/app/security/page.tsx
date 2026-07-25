'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHero, GlassPanel } from '@neurecore/ui-visual';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { KpiTile } from '@/components/kpi/KpiTile';
import { DataTable } from '@/components/data-table/DataTable';
import api from '@/services/api';
import { unwrapArrayOrEmpty } from '@/services/unwrap';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PolicyRow {
  id: string;
  name: string;
  type: string;
  enforcement: string;
  createdAt: string;
}

interface AnomalyRow {
  id: string;
  type: string;
  severity: string;
  description: string;
  detectedAt: string;
}

type Tab = 'policies' | 'anomalies';

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'border border-[color:var(--state-danger)]/40 bg-[color:var(--state-danger)]/10 text-[color:var(--state-danger)]',
  HIGH:     'border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)]',
  MEDIUM:   'border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)]',
  LOW:      'bg-white/5 text-zinc-400',
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'policies', label: 'Governance Policies' },
  { id: 'anomalies', label: 'Anomaly Detection' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SecurityPage() {
  const user = useAdminAuth();
  const [tab, setTab] = useState<Tab>('policies');
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [policyRes, anomalyRes] = await Promise.all([
        api.get('/governance/policies?limit=50').catch(() => ({ data: { data: [] } })),
        api.get('/governance/anomalies?limit=50').catch(() => ({ data: { data: [] } })),
      ]);
      setPolicies(unwrapArrayOrEmpty(policyRes) as PolicyRow[]);
      setAnomalies(unwrapArrayOrEmpty(anomalyRes) as AnomalyRow[]);
    } catch {
      setPolicies([]);
      setAnomalies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <PageHero
        title="Security"
        subtitle="Governance, compliance and anomaly detection"
      />
      <div className="max-w-6xl mx-auto space-y-6">
          <button onClick={() => void fetchData()} className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 transition">
            Refresh
          </button>

        {/* ── KPI tiles ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile label="Policies" value={policies.length} color="ops" loading={loading} />
          <KpiTile label="Anomalies" value={anomalies.length} color={anomalies.length > 0 ? 'risk' : 'profit'} loading={loading} />
          <KpiTile label="Critical" value={anomalies.filter((a) => a.severity === 'CRITICAL').length} color="risk" loading={loading} />
          <KpiTile label="Active Policies" value={policies.filter((p) => p.enforcement === 'ENFORCE').length} color="strategy" loading={loading} />
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 border-b border-surface-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-[color:var(--accent-500)] text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Policies tab ── */}
        {tab === 'policies' && (
          <DataTable<PolicyRow>
            data={policies}
            loading={loading}
            columns={[
              { key: 'name', header: 'Policy Name', accessor: (row) => <span className="text-zinc-200">{row.name}</span> },
              { key: 'type', header: 'Type', accessor: (row) => <span className="text-xs text-zinc-400">{row.type}</span> },
              {
                key: 'enforcement',
                header: 'Mode',
                accessor: (row) => (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    row.enforcement === 'ENFORCE' ? 'bg-[color:var(--accent-500)]/15 text-[color:var(--accent-300)]' : 'bg-white/5 text-zinc-400'
                  }`}>
                    {row.enforcement}
                  </span>
                ),
              },
              { key: 'createdAt', header: 'Created', accessor: (row) => <span className="text-xs text-zinc-500">{new Date(row.createdAt).toLocaleDateString()}</span> },
            ]}
            renderEmpty={() => <div className="py-12 text-center text-zinc-500 text-sm">No policies configured</div>}
          />
        )}

        {/* ── Anomalies tab ── */}
        {tab === 'anomalies' && (
          <DataTable<AnomalyRow>
            data={anomalies}
            loading={loading}
            columns={[
              { key: 'type', header: 'Type', accessor: (row) => <span className="text-zinc-200">{row.type}</span> },
              {
                key: 'severity',
                header: 'Severity',
                accessor: (row) => (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_BADGE[row.severity] ?? 'bg-white/5 text-zinc-400'}`}>
                    {row.severity}
                  </span>
                ),
              },
              { key: 'description', header: 'Description', accessor: (row) => <span className="text-xs text-zinc-400 line-clamp-1">{row.description}</span> },
              { key: 'detectedAt', header: 'Detected', accessor: (row) => <span className="text-xs text-zinc-500">{new Date(row.detectedAt).toLocaleString()}</span> },
            ]}
            renderEmpty={() => <div className="py-12 text-center text-zinc-500 text-sm">No anomalies detected</div>}
          />
        )}
      </div>
    </AdminShell>
  );
}
