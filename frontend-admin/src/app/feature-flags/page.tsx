"use client";

/**
 * /feature-flags — Phase Hermes H9: per-tenant feature flag toggle.
 *
 * Platform admins can override any tenant's runtime feature flags.
 * Each toggle PATCHes `/api/v1/feature-flags/tenants/:tenantId` and
 * invalidates the in-process cache.
 *
 * 2026-07-11: Extended with 11 Enterprise Communication Platform flags.
 * Flags are grouped into "Hermes Runtime" and "Enterprise Communication"
 * sections. AGENT_MESSAGING_ENABLED is visually flagged as HIGH RISK.
 */

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import {
  getTenantFeatureFlags,
  updateTenantFeatureFlags,
  type TenantFeatureFlagOverrides,
} from '@/services/adminFeatureFlags.service';

const FLAG_LABELS: Array<{
  key: keyof TenantFeatureFlagOverrides;
  label: string;
  description: string;
  highRisk?: boolean;
}> = [
  {
    key: 'HERMES_ENABLED',
    label: 'Hermes runtime',
    description:
      'Route all agent executions through the new Hermes runtime (LangGraph-based) instead of the legacy agent state machine.',
  },
  {
    key: 'HERMES_AUTO_LINK',
    label: 'Hermes auto-link',
    description:
      'On first execution of any agent, auto-create a matching HermesAgent record.',
  },
  {
    key: 'HERMES_APPROVAL_REQUIRED',
    label: 'Hermes approval required',
    description:
      'Require explicit human approval before any tool call. Pairs with the ApprovalWorkflowEngine.',
  },
  {
    key: 'HERMES_SESSION_LOGGING',
    label: 'Hermes session logging',
    description:
      'Persist every Hermes session to HermesSession table for replay & audit. Disable for high-volume tenants.',
  },
  {
    key: 'DISABLE_AI_ACTIONS',
    label: 'AI actions kill-switch',
    description:
      'Emergency stop — blocks ALL AI actions for this tenant. Independent of Hermes flag.',
  },

  // ── Enterprise Communication Platform (2026-07-11) ────────

  {
    key: 'COMM_THREADS_ENABLED',
    label: 'Communication threads',
    description:
      'Enable persistent cross-agent/human threads with participant membership and read-state tracking. Gated behind Phase 1.',
  },
  {
    key: 'COMM_ACTIVITIES_ENABLED',
    label: 'Canonical activity feed',
    description:
      'Unify MissionFeed, ActivityStream, and LiveFeedWidget into a single persisted ActivityEvent model. Gated behind Phase 2 + Phase 5.',
  },
  {
    key: 'COMM_PRESENCE_ENABLED',
    label: 'Agent presence',
    description:
      'Redis-backed heartbeat with SCAN-based stale sweep. Shows agent online/idle/working/blocked state. Gated behind Phase 7.',
  },
  {
    key: 'COMM_CONVERSATION_INTELLIGENCE_ENABLED',
    label: 'Conversation intelligence',
    description:
      'Map-reduce summarization, cross-department Q&A, and semantic search across thread history. Gated behind Phase 8.',
  },
  {
    key: 'COMM_DIGEST_ENABLED',
    label: 'Weekly digest',
    description:
      'Generate tenant/department/goal/project/agent digests with KPI rollups, cost-center reports, and risk detection. Gated behind Phase 9a.',
  },
  {
    key: 'COMM_ESCALATION_ENABLED',
    label: 'Escalation engine',
    description:
      '1-min background tick that escalates stale approval requests and risk alerts via REPORTS_TO chain. Gated behind Phase 9b.',
  },
  {
    key: 'COMM_FOLLOWUP_ENABLED',
    label: 'Follow-up nudges',
    description:
      '5-min background tick that emits thread.followup activities for stale threads. Gated behind Phase 9b.',
  },
  {
    key: 'COMM_MENTIONS_ENABLED',
    label: '@Mentions',
    description:
      'Fan-out thread:mention WebSocket events to mentioned user rooms. Gated behind Phase 9c.',
  },
  {
    key: 'COMM_WORKFLOW_TEMPLATES_ENABLED',
    label: 'Workflow templates',
    description:
      'Cron-scheduled templates that auto-create threads and post a first message on schedule. Gated behind Phase 9b.',
  },
  {
    key: 'AGENT_MESSAGING_ENABLED',
    label: '⚠️ Agent-to-agent messaging',
    description:
      'HIGH RISK — enables AI agents to message each other direct. Circuit breaker enforces hop limit (5), message cap, and cost ceiling. MUST be verified per-tenant; NEVER flip globally. Gated behind Phase 4.',
    highRisk: true,
  },
  {
    key: 'COMM_AGENT_MESSAGING_ENABLED',
    label: 'Agent-to-agent messaging (legacy)',
    description:
      'Legacy alias for AGENT_MESSAGING_ENABLED. Either flag enables the A2A path. Prefer AGENT_MESSAGING_ENABLED.',
  },
];

interface TenantOption {
  id: string;
  name: string;
}

async function fetchTenants(): Promise<TenantOption[]> {
  const res = await api.get('/tenants', { params: { limit: 200 } });
  const data = (res.data?.data ?? res.data) as {
    items?: Array<{ id: string; name: string }>;
  };
  return (data.items ?? []).map((t) => ({ id: t.id, name: t.name }));
}

export default function FeatureFlagsAdminPage() {
  const user = useAdminAuth();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [overrides, setOverrides] = useState<TenantFeatureFlagOverrides>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTenants()
      .then((list) => {
        if (!cancelled) setTenants(list);
      })
      .catch(() => {
        if (!cancelled) setTenants([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadOverrides = useCallback(async (tenantId: string) => {
    if (!tenantId) {
      setOverrides({});
      return;
    }
    try {
      const next = await getTenantFeatureFlags(tenantId);
      setOverrides(next);
    } catch {
      setOverrides({});
    }
  }, []);

  useEffect(() => {
    void loadOverrides(selectedId);
  }, [selectedId, loadOverrides]);

  async function toggle(
    key: keyof TenantFeatureFlagOverrides,
    value: boolean,
  ) {
    if (!selectedId) return;
    setSavingKey(key);
    setStatusMessage(null);
    try {
      const next = await updateTenantFeatureFlags(selectedId, {
        ...overrides,
        [key]: value,
      });
      setOverrides(next);
      setStatusMessage(`Saved ${key}=${value}`);
    } catch (err) {
      setStatusMessage(
        `Save failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    } finally {
      setSavingKey(null);
    }
  }

  const HERMES_FLAGS = FLAG_LABELS.slice(0, 5);
  const COMMS_FLAGS = FLAG_LABELS.slice(5);

  function FlagRow({
    flag,
    value,
    saving,
    onToggle,
  }: {
    flag: (typeof FLAG_LABELS)[number];
    value: boolean | undefined;
    saving: boolean;
    onToggle: (v: boolean) => void;
  }) {
    return (
      <div className="p-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-zinc-100">
            {flag.label}
            {flag.highRisk && (
              <span className="ml-2 text-[10px] text-[color:var(--state-warning)] font-semibold">
                HIGH RISK
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500 mt-1 max-w-xl">
            {flag.description}
          </div>
          <div className="text-[10px] text-zinc-600 mt-2 font-mono">
            {flag.key}
            {typeof value === 'boolean' ? ` = ${value}` : ' (inherits global default)'}
          </div>
        </div>
        <button
          onClick={() => onToggle(!value)}
          disabled={saving}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            value === true
              ? 'bg-[color:var(--state-success)]/20 border-[color:var(--state-success)] text-emerald-300'
              : value === false
                ? 'bg-[color:var(--visual-accent-rose-500)]/20 border-rose-500 text-rose-300'
                : 'border-surface-border text-zinc-400 hover:text-zinc-200'
          } ${saving ? 'opacity-50' : ''}`}
        >
          {saving ? 'Saving…' : value === true ? 'On' : value === false ? 'Off' : 'Inherit'}
        </button>
      </div>
    );
  }

  function renderFlagSection(
    header: string,
    flags: typeof FLAG_LABELS,
  ) {
    return (
      <section className="rounded-xl border border-surface-border bg-surface-raised divide-y divide-surface-border">
        <div className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          {header}
        </div>
        {flags.length === 0 ? (
          <div className="p-4 text-xs text-zinc-600">
            No flags in this section.
          </div>
        ) : (
          flags.map((flag) => (
            <FlagRow
              key={flag.key}
              flag={flag}
              value={overrides[flag.key]}
              saving={savingKey === flag.key}
              onToggle={(v) => toggle(flag.key, v)}
            />
          ))
        )}
      </section>
    );
  }

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Feature flags
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Override runtime feature flags per tenant. Global defaults live in
            the backend <code>.env</code> file.
          </p>
        </div>

        <section className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Tenant</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
            >
              <option value="">— Select a tenant —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {!selectedId && (
            <p className="text-xs text-zinc-500">
              Pick a tenant to view and edit its feature-flag overrides.
            </p>
          )}
        </section>

        {selectedId && (
          <div className="space-y-4">
            {renderFlagSection('Hermes Runtime', HERMES_FLAGS)}
            {renderFlagSection('Enterprise Communication', COMMS_FLAGS)}
          </div>
        )}

        {statusMessage && (
          <div className="text-xs text-zinc-400">{statusMessage}</div>
        )}
      </div>
    </AdminShell>
  );
}