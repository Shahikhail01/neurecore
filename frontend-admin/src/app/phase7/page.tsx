"use client";

/**
 * /phase7 — Phase 7 console.
 *
 * Single-page tab navigator over the Phase 7 surfaces:
 *   • Customer 360 (5.9.1)
 *   • Triage rules (5.9.2)
 *   • Chatbot personas (5.9.4)
 *   • Knowledge gaps (5.9.8)
 *   • Governance (custom rules + operational + internal + security)
 *   • XAI "why this action" demo (5.4.17)
 *
 * Solid (frontend):
 *   • SRP — page composes sub-views; no business logic.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  Users,
  ShieldAlert,
  Bot,
  BookOpen,
  Cog,
  Sparkles,
  Plus,
} from 'lucide-react';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  getCustomer360,
  listTriageRules,
  listChatbotPersonas,
  listKnowledgeGaps,
  detectKnowledgeGaps,
  listOperationalHealth,
  runOperationalProbes,
  listInternalCompliance,
  runInternalCompliance,
  listSecurityControls,
  listCustomGovRules,
  fetchWhyPanel,
  type Customer360,
  type TriageRule,
  type ChatbotPersona,
  type KnowledgeGap,
  type OperationalHealth,
  type InternalCompliance,
  type SecurityControl,
  type CustomGovRule,
} from '@/services/phase7.service';

type Tab = 'crm360' | 'triage' | 'personas' | 'knowledge' | 'governance' | 'xai';

export default function Phase7Page() {
  const user = useAdminAuth();
  const [tab, setTab] = useState<Tab>('crm360');
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !tenantId) {
      const t = (user as { tenantId?: string }).tenantId;
      if (t) setTenantId(t);
    }
  }, [user, tenantId]);

  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    { id: 'crm360', label: 'Customer 360', icon: <Users className="h-4 w-4" /> },
    { id: 'triage', label: 'Triage Rules', icon: <ShieldAlert className="h-4 w-4" /> },
    { id: 'personas', label: 'Chatbot Personas', icon: <Bot className="h-4 w-4" /> },
    { id: 'knowledge', label: 'Knowledge Gaps', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'governance', label: 'Governance', icon: <Cog className="h-4 w-4" /> },
    { id: 'xai', label: 'XAI Panel', icon: <Sparkles className="h-4 w-4" /> },
  ];

  return (
    <AdminShell user={user}>
      <div className="px-6 py-8 max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white">Phase 7 Console</h1>
          <p className="text-sm text-white/60 mt-1">
            Service 360 / contact center / knowledge self-curation / governance authoring / XAI.
          </p>
          <div className="mt-3">
            <label className="text-xs text-white/40 mr-2">Tenant:</label>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white font-mono"
              placeholder="tenant-a"
            />
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <nav className="flex gap-2 mb-4 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'bg-violet-600 text-white'
                  : 'border border-white/10 text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        {tenantId ? (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-md border border-white/10 p-4"
          >
            {tab === 'crm360' && <Crm360Tab tenantId={tenantId} />}
            {tab === 'triage' && <TriageTab tenantId={tenantId} />}
            {tab === 'personas' && <PersonaTab tenantId={tenantId} />}
            {tab === 'knowledge' && <KnowledgeTab tenantId={tenantId} />}
            {tab === 'governance' && <GovernanceTab tenantId={tenantId} />}
            {tab === 'xai' && <XaiTab tenantId={tenantId} />}
          </motion.div>
        ) : (
          <p className="text-white/40 text-sm">Enter a tenant id above to begin.</p>
        )}
      </div>
    </AdminShell>
  );
}

// ─── Customer 360 ───────────────────────────────────────────────

function Crm360Tab({ tenantId }: { tenantId: string }) {
  const [customerId, setCustomerId] = useState('');
  const [view, setView] = useState<Customer360 | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const v = await getCustomer360(tenantId, customerId);
      setView(v);
    } catch (e) {
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, customerId]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="customer id"
          className="flex-1 rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
        />
        <button
          type="button"
          onClick={load}
          disabled={!customerId || loading}
          className="rounded bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          {loading ? 'Loading…' : 'Load 360°'}
        </button>
      </div>
      {view && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile label="Touchpoints" value={String(view.summary.totalTouchpoints)} />
          <KpiTile label="Channels" value={view.summary.channelsTouched.join(', ') || '—'} />
          <KpiTile label="Active intent" value={view.summary.activeIntent ?? '—'} />
          <KpiTile
            label="Last touch"
            value={view.summary.lastTouchpointAt ? new Date(view.summary.lastTouchpointAt).toLocaleDateString() : '—'}
          />
        </div>
      )}
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] uppercase text-white/40">{label}</div>
      <div className="text-sm text-white mt-1 break-words">{value}</div>
    </div>
  );
}

// ─── Triage rules ───────────────────────────────────────────────

function TriageTab({ tenantId }: { tenantId: string }) {
  const [rules, setRules] = useState<TriageRule[]>([]);
  const refresh = useCallback(async () => {
    try {
      setRules(await listTriageRules(tenantId));
    } catch {
      setRules([]);
    }
  }, [tenantId]);
  useEffect(() => { refresh(); }, [refresh]);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={refresh}
        className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs text-white/60"
      >
        <RefreshCw className="h-3 w-3" /> Refresh
      </button>
      <div className="rounded border border-white/10 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="text-left px-2 py-1">Slug</th>
              <th className="text-left px-2 py-1">Name</th>
              <th className="text-left px-2 py-1">Priority</th>
              <th className="text-left px-2 py-1">Action</th>
              <th className="text-left px-2 py-1">Enabled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rules.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-3 text-center text-white/40">No triage rules.</td></tr>
            )}
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-1 font-mono text-white/80">{r.slug}</td>
                <td className="px-2 py-1 text-white">{r.displayName}</td>
                <td className="px-2 py-1"><PriorityChip priority={r.priority} /></td>
                <td className="px-2 py-1 text-white/60">{r.action}</td>
                <td className="px-2 py-1">{r.enabled ? '✅' : '⛔'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriorityChip({ priority }: { priority: TriageRule['priority'] }) {
  const colors: Record<TriageRule['priority'], string> = {
    URGENT: 'bg-red-500/15 text-red-300',
    HIGH: 'bg-orange-500/15 text-orange-300',
    MEDIUM: 'bg-amber-500/15 text-amber-300',
    LOW: 'bg-zinc-500/15 text-zinc-300',
  };
  return <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${colors[priority]}`}>{priority}</span>;
}

// ─── Chatbot personas ──────────────────────────────────────────

function PersonaTab({ tenantId }: { tenantId: string }) {
  const [personas, setPersonas] = useState<ChatbotPersona[]>([]);
  const refresh = useCallback(async () => {
    try { setPersonas(await listChatbotPersonas(tenantId)); } catch { setPersonas([]); }
  }, [tenantId]);
  useEffect(() => { refresh(); }, [refresh]);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={refresh}
        className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs text-white/60"
      >
        <RefreshCw className="h-3 w-3" /> Refresh
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {personas.length === 0 && (
          <p className="text-xs text-white/40 col-span-2 text-center py-6">No personas yet.</p>
        )}
        {personas.map((p) => (
          <div key={p.id} className="rounded border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium text-white">{p.displayName}</div>
              <span className="rounded bg-violet-500/15 text-violet-300 px-2 py-0.5 text-[10px]">
                {p.kind.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-white/60 italic">/{p.slug}</p>
            <p className="text-xs text-white/50 mt-2 line-clamp-2">{p.systemPrompt}</p>
            <p className="text-[10px] text-white/40 mt-2">
              Escalation threshold: {p.escalationThreshold} · Allowed actions: {p.allowedActionIds.length}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Knowledge gaps ────────────────────────────────────────────

function KnowledgeTab({ tenantId }: { tenantId: string }) {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [topic, setTopic] = useState('');
  const refresh = useCallback(async () => {
    try { setGaps(await listKnowledgeGaps(tenantId)); } catch { setGaps([]); }
  }, [tenantId]);
  useEffect(() => { refresh(); }, [refresh]);

  const detect = async () => {
    if (!topic) return;
    try {
      await detectKnowledgeGaps({ tenantId, topics: [topic] });
      setTopic('');
      await refresh();
    } catch {
      /* swallow */
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="topic to detect"
          className="flex-1 rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
        />
        <button
          type="button"
          onClick={detect}
          disabled={!topic}
          className="rounded bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          <Plus className="inline h-3 w-3" /> Detect
        </button>
      </div>
      <div className="rounded border border-white/10 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="text-left px-2 py-1">Topic</th>
              <th className="text-left px-2 py-1">Cases</th>
              <th className="text-left px-2 py-1">Status</th>
              <th className="text-left px-2 py-1">Detected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {gaps.length === 0 && (
              <tr><td colSpan={4} className="px-2 py-3 text-center text-white/40">No gaps yet.</td></tr>
            )}
            {gaps.map((g) => (
              <tr key={g.id}>
                <td className="px-2 py-1 text-white">{g.topic}</td>
                <td className="px-2 py-1 text-white/60">{g.caseCount}</td>
                <td className="px-2 py-1 text-white/60">{g.status}</td>
                <td className="px-2 py-1 text-white/40">{new Date(g.detectedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Governance ────────────────────────────────────────────────

function GovernanceTab({ tenantId }: { tenantId: string }) {
  const [rules, setRules] = useState<CustomGovRule[]>([]);
  const [ops, setOps] = useState<OperationalHealth[]>([]);
  const [intl, setIntl] = useState<InternalCompliance[]>([]);
  const [sec, setSec] = useState<SecurityControl[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [r, o, i, s] = await Promise.all([
        listCustomGovRules(tenantId),
        listOperationalHealth(tenantId),
        listInternalCompliance(tenantId),
        listSecurityControls(tenantId),
      ]);
      setRules(r); setOps(o); setIntl(i); setSec(s);
    } catch {
      setRules([]); setOps([]); setIntl([]); setSec([]);
    }
  }, [tenantId]);

  useEffect(() => { refresh(); }, [refresh]);

  const runProbes = async () => {
    try {
      await runOperationalProbes(tenantId);
      await runInternalCompliance(tenantId);
      await refresh();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={runProbes}
          className="rounded bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs text-white"
        >
          Run all probes
        </button>
        <button
          type="button"
          onClick={refresh}
          className="rounded border border-white/10 px-3 py-1.5 text-xs text-white/60"
        >
          <RefreshCw className="inline h-3 w-3" /> Refresh
        </button>
      </div>

      <Section title="Operational Probes" rows={ops.map((o) => ({
        key: o.probe,
        chip: o.severity,
        detail: new Date(o.observedAt).toLocaleString(),
      }))} />

      <Section title="Internal Compliance Checks" rows={intl.map((i) => ({
        key: i.checkName,
        chip: i.outcome,
        detail: i.category + ' · ' + new Date(i.ranAt).toLocaleString(),
      }))} />

      <Section title="Security Controls" rows={sec.map((s) => ({
        key: s.controlKey,
        chip: s.state,
        detail: new Date(s.observedAt).toLocaleString(),
      }))} />

      <div className="rounded border border-white/10 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="text-left px-2 py-1">Rule slug</th>
              <th className="text-left px-2 py-1">Domain</th>
              <th className="text-left px-2 py-1">Standards</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rules.length === 0 && (
              <tr><td colSpan={3} className="px-2 py-3 text-center text-white/40">No custom rules.</td></tr>
            )}
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-1 font-mono text-white/80">{r.slug}</td>
                <td className="px-2 py-1 text-white/60">{r.domain}</td>
                <td className="px-2 py-1 text-white/60">{r.standards.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Section({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; chip: string; detail: string }>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white/80 mb-2">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {rows.length === 0 && (
          <p className="text-xs text-white/40 col-span-2 py-2 text-center">
            No records.
          </p>
        )}
        {rows.map((r) => (
          <div key={r.key} className="rounded border border-white/10 bg-white/5 px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-mono text-white/80 truncate">{r.key}</span>
            <span className="flex items-center gap-2">
              <span className="rounded bg-violet-500/15 text-violet-300 px-2 py-0.5 text-[10px]">{r.chip}</span>
              <span className="text-[10px] text-white/40">{r.detail}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── XAI ──────────────────────────────────────────────────────

function XaiTab({ tenantId }: { tenantId: string }) {
  const [intent, setIntent] = useState('send-quote');
  const [features, setFeatures] = useState<Array<{ factor: string; value: number }>>([
    { factor: 'engagement', value: 0.8 },
    { factor: 'budget_fit', value: 0.6 },
    { factor: 'recency', value: 0.2 },
  ]);
  const [panel, setPanel] = useState<{
    intent: string;
    factors: Array<{ factor: string; value: number; weight: number }>;
    narrative: string;
    modelId: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const p = await fetchWhyPanel({ tenantId, intent, factors });
      setPanel(p);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded border border-white/10 p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs text-white/60">
            Intent
            <input
              type="text"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="w-full mt-1 rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
            />
          </label>
          <div className="text-xs text-white/60">
            Features (factor + value)
            <div className="space-y-1 mt-1">
              {features.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={f.factor}
                    onChange={(e) => {
                      const next = [...features];
                      next[i] = { ...next[i], factor: e.target.value };
                      setFeatures(next);
                    }}
                    className="flex-1 rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={f.value}
                    onChange={(e) => {
                      const next = [...features];
                      next[i] = { ...next[i], value: Number(e.target.value) };
                      setFeatures(next);
                    }}
                    className="w-24 rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          {loading ? 'Computing…' : 'Compute "why this action"'}
        </button>
      </div>

      {panel && (
        <div className="rounded border border-white/10 bg-white/5 p-4 space-y-3">
          <p className="text-sm text-white">{panel.narrative}</p>
          <div className="space-y-2">
            {panel.factors.map((f) => (
              <div key={f.factor} className="flex items-center gap-3">
                <span className="text-xs font-mono w-32 text-white/80">{f.factor}</span>
                <div className="flex-1 h-2 bg-white/10 rounded">
                  <div
                    className="h-2 bg-violet-500 rounded"
                    style={{ width: `${Math.max(0, Math.min(100, f.weight * 100))}%` }}
                  />
                </div>
                <span className="text-[10px] text-white/40 w-16 text-right">
                  {(f.weight * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/40">
            Model: <code className="font-mono">{panel.modelId}</code>
          </p>
        </div>
      )}
    </div>
  );
}
