'use client';

/**
 * /command-center — Phase 14 admin command-center page (admin FE).
 *
 * Reads three SUPER_ADMIN surfaces:
 *   - GET /command-center/summary           — platform dashboard summary
 *   - GET /command-center/inventory         — 4 inventory buckets
 *   - GET /command-center/audit-correlation — recent audit events
 *
 * Adds an operator-facing kill-switch toggle list that uses both:
 *   - GET  /command-center/kill-switches
 *   - POST /command-center/kill-switches    (audited)
 *
 * Conventions mirror the tenant page: strict typed wrapper, no `any`,
 * "no silent success" empty states, heading per card, label per list item.
 * No mutation beyond the audited POST.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Boxes,
  Brain,
  GraduationCap,
  Library,
  Wallet,
  Activity,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';

// ─── Typed DTO mirrors (CR-AI-1201, 1205, 1207) ────────────────────────────

type InventoryBucket = ReadonlyArray<{ id?: string; name?: string }>;

interface AdminInventoryResponse {
  agents: InventoryBucket;
  skills: InventoryBucket;
  knowledge: InventoryBucket;
  channels: InventoryBucket;
  tenantId: string;
  fetchedAt: string;
}

interface AdminSummaryEntry {
  id: string;
  message: string;
  severity: string;
  timestamp: string;
}

interface AdminSummary {
  activity: AdminSummaryEntry[];
  fetchedAt: string;
}

interface AdminAuditEvent {
  id: string;
  actor: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  correlationId: string | null;
  occurredAt: string;
}

interface AdminAuditCorrelation {
  events: AdminAuditEvent[];
  count: number;
  fetchedAt: string;
}

type AdminKillSwitchScope = 'process' | 'phase' | 'channel' | 'tenant-feature';

interface AdminKillSwitchEntry {
  scope: AdminKillSwitchScope;
  target: string;
  enabled: boolean;
  processEnabled: boolean;
  updatedAt: string;
}

interface AdminKillSwitchListResponse {
  entries: AdminKillSwitchEntry[];
  processEnabled: boolean;
  tenantId: string;
  fetchedAt: string;
}

// ─── Runtime narrowing helpers (no `any`) ─────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function asBoolean(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

interface AxiosLike<T> {
  data: T;
}

function unwrapAxios<T>(res: unknown): T {
  if (isObject(res) && 'data' in res) {
    return (res as unknown as AxiosLike<T>).data;
  }
  return res as T;
}

function unwrapNested<T>(res: unknown): T {
  const outer = unwrapAxios<unknown>(res);
  if (isObject(outer) && 'data' in outer && (outer as { data?: unknown }).data !== undefined) {
    return (outer as { data: T }).data;
  }
  return outer as T;
}

// ─── Shape mappers ────────────────────────────────────────────────────────

function mapInventory(raw: unknown): AdminInventoryResponse {
  const data = isObject(raw) ? raw : {};
  return {
    agents: asArray<{ id?: string; name?: string }>(data['agents']),
    skills: asArray<{ id?: string; name?: string }>(data['skills']),
    knowledge: asArray<{ id?: string; name?: string }>(data['knowledge']),
    channels: asArray<{ id?: string; name?: string }>(data['channels']),
    tenantId: asString(data['tenantId'], ''),
    fetchedAt: asString(data['fetchedAt'], nowIso()),
  };
}

function mapSummary(raw: unknown): AdminSummary {
  const data = isObject(raw) ? raw : {};
  const activity = asArray<unknown>(data['activity']).map((entry, index): AdminSummaryEntry => {
    const obj = isObject(entry) ? entry : {};
    return {
      id: asString(obj['id'], `activity-${index}`),
      message: asString(obj['message'], ''),
      severity: asString(obj['severity'], 'info'),
      timestamp: asString(obj['timestamp'], nowIso()),
    };
  });
  return {
    activity,
    fetchedAt: asString(data['fetchedAt'], nowIso()),
  };
}

function mapAuditCorrelation(raw: unknown): AdminAuditCorrelation {
  const data = isObject(raw) ? raw : {};
  const events = asArray<unknown>(data['events']).map((entry, index): AdminAuditEvent => {
    const obj = isObject(entry) ? entry : {};
    return {
      id: asString(obj['id'], `audit-${index}`),
      actor: asString(obj['actor'], 'unknown'),
      action: asString(obj['action'], ''),
      resource: typeof obj['resource'] === 'string' ? obj['resource'] : null,
      resourceId: typeof obj['resourceId'] === 'string' ? obj['resourceId'] : null,
      correlationId: typeof obj['correlationId'] === 'string' ? obj['correlationId'] : null,
      occurredAt: asString(obj['occurredAt'], nowIso()),
    };
  });
  return {
    events,
    count: asNumber(data['count'], events.length),
    fetchedAt: asString(data['fetchedAt'], nowIso()),
  };
}

function mapKillSwitchList(raw: unknown): AdminKillSwitchListResponse {
  const data = isObject(raw) ? raw : {};
  const entries = asArray<unknown>(data['entries']).map((entry, index): AdminKillSwitchEntry => {
    const obj = isObject(entry) ? entry : {};
    const scopeValue = asString(obj['scope'], 'phase');
    const scope: AdminKillSwitchScope =
      scopeValue === 'process' || scopeValue === 'phase' ||
      scopeValue === 'channel' || scopeValue === 'tenant-feature'
        ? scopeValue
        : 'phase';
    return {
      scope,
      target: asString(obj['target'], `entry-${index}`),
      enabled: asBoolean(obj['enabled'], false),
      processEnabled: asBoolean(obj['processEnabled'], false),
      updatedAt: asString(obj['updatedAt'], nowIso()),
    };
  });
  return {
    entries,
    processEnabled: asBoolean(data['processEnabled'], false),
    tenantId: asString(data['tenantId'], ''),
    fetchedAt: asString(data['fetchedAt'], nowIso()),
  };
}

// ─── Service (typed, no `any`) ────────────────────────────────────────────

interface CommandCenterAdminService {
  getSummary(): Promise<AdminSummary>;
  getInventory(): Promise<AdminInventoryResponse>;
  getAuditCorrelation(): Promise<AdminAuditCorrelation>;
  getKillSwitches(): Promise<AdminKillSwitchListResponse>;
  setKillSwitch(input: {
    scope: AdminKillSwitchScope;
    target?: string;
    enabled: boolean;
    reason: string;
  }): Promise<AdminKillSwitchEntry>;
}

const commandCenterAdmin: CommandCenterAdminService = {
  async getSummary(): Promise<AdminSummary> {
    const res = await api.get<unknown>('/command-center/summary');
    return mapSummary(unwrapNested<unknown>(res));
  },

  async getInventory(): Promise<AdminInventoryResponse> {
    const res = await api.get<unknown>('/command-center/inventory');
    return mapInventory(unwrapNested<unknown>(res));
  },

  async getAuditCorrelation(): Promise<AdminAuditCorrelation> {
    const res = await api.get<unknown>('/command-center/audit-correlation');
    return mapAuditCorrelation(unwrapNested<unknown>(res));
  },

  async getKillSwitches(): Promise<AdminKillSwitchListResponse> {
    const res = await api.get<unknown>('/command-center/kill-switches');
    return mapKillSwitchList(unwrapNested<unknown>(res));
  },

  async setKillSwitch(input): Promise<AdminKillSwitchEntry> {
    await api.post<unknown>('/command-center/kill-switches', input);
    return {
      scope: input.scope,
      target: input.target ?? '',
      enabled: input.enabled,
      processEnabled: input.enabled,
      updatedAt: nowIso(),
    };
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────

interface CardState<T> {
  loading: boolean;
  data: T | null;
  error: string | null;
}

const INITIAL: CardState<never> = { loading: true, data: null, error: null };

export default function AdminCommandCenterPage() {
  const user = useAdminAuth();

  const [summary, setSummary] = useState<CardState<AdminSummary>>(INITIAL);
  const [inventory, setInventory] = useState<CardState<AdminInventoryResponse>>(INITIAL);
  const [audit, setAudit] = useState<CardState<AdminAuditCorrelation>>(INITIAL);
  const [killSwitches, setKillSwitches] = useState<CardState<AdminKillSwitchListResponse>>(INITIAL);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setSummary({ loading: true, data: null, error: null });
    setInventory({ loading: true, data: null, error: null });
    setAudit({ loading: true, data: null, error: null });
    setKillSwitches({ loading: true, data: null, error: null });

    const [s, inv, ac, ks] = await Promise.all([
      commandCenterAdmin.getSummary(),
      commandCenterAdmin.getInventory(),
      commandCenterAdmin.getAuditCorrelation(),
      commandCenterAdmin.getKillSwitches(),
    ]);
    setSummary({ loading: false, data: s, error: null });
    setInventory({ loading: false, data: inv, error: null });
    setAudit({ loading: false, data: ac, error: null });
    setKillSwitches({ loading: false, data: ks, error: null });
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadAll().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to load command center';
      const errorState: CardState<never> = { loading: false, data: null, error: message };
      setSummary(errorState);
      setInventory(errorState);
      setAudit(errorState);
      setKillSwitches(errorState);
    });
  }, [user, loadAll]);

  const handleToggle = useCallback(
    async (entry: AdminKillSwitchEntry) => {
      const key = `${entry.scope}:${entry.target}`;
      setToggling(key);
      setToggleError(null);
      try {
        await commandCenterAdmin.setKillSwitch({
          scope: entry.scope,
          target: entry.target,
          enabled: !entry.enabled,
          reason: `Toggled from admin /command-center at ${nowIso()}`,
        });
        const refreshed = await commandCenterAdmin.getKillSwitches();
        setKillSwitches({ loading: false, data: refreshed, error: null });
      } catch (err: unknown) {
        setToggleError(err instanceof Error ? err.message : 'Failed to toggle kill switch');
      } finally {
        setToggling(null);
      }
    },
    [],
  );

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Command Center</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Platform inventory, activity, and operator kill-switch console.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="inline-flex items-center gap-2 rounded-md border border-surface-border px-3 py-2 text-sm text-zinc-300 hover:bg-surface-overlay"
            aria-label="Refresh command center"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </header>

        {summary.error && (
          <ErrorBanner message={summary.error} />
        )}
        {toggleError && (
          <ErrorBanner message={toggleError} />
        )}

        <section aria-labelledby="cc-admin-summary-heading">
          <h2 id="cc-admin-summary-heading" className="text-sm font-semibold text-zinc-300 mb-3">
            Recent activity
          </h2>
          <SummaryCard state={summary} />
        </section>

        <section aria-labelledby="cc-admin-inventory-heading">
          <h2 id="cc-admin-inventory-heading" className="text-sm font-semibold text-zinc-300 mb-3">
            Inventory
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InventoryCard
              label="Agents"
              icon={<Brain className="w-5 h-5" />}
              state={inventory}
              bucket="agents"
            />
            <InventoryCard
              label="Skills"
              icon={<GraduationCap className="w-5 h-5" />}
              state={inventory}
              bucket="skills"
            />
            <InventoryCard
              label="Knowledge"
              icon={<Library className="w-5 h-5" />}
              state={inventory}
              bucket="knowledge"
            />
            <InventoryCard
              label="Channels"
              icon={<Boxes className="w-5 h-5" />}
              state={inventory}
              bucket="channels"
            />
          </div>
        </section>

        <section aria-labelledby="cc-admin-audit-heading">
          <h2 id="cc-admin-audit-heading" className="text-sm font-semibold text-zinc-300 mb-3">
            Audit correlation
          </h2>
          <AuditCard state={audit} />
        </section>

        <section aria-labelledby="cc-admin-killswitch-heading">
          <h2 id="cc-admin-killswitch-heading" className="text-sm font-semibold text-zinc-300 mb-3">
            Kill switches
          </h2>
          <KillSwitchCard
            state={killSwitches}
            onToggle={handleToggle}
            toggling={toggling}
          />
        </section>
      </div>
    </AdminShell>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────

function SummaryCard({ state }: { state: CardState<AdminSummary> }) {
  if (state.loading) return <PanelLoading label="Loading activity…" />;
  if (state.error) return null;
  const activity = state.data?.activity ?? [];
  if (activity.length === 0) {
    return (
      <EmptyPanel
        icon={<Activity className="w-5 h-5" />}
        title="No recent activity"
        description="The activity stream will populate as tenants produce events."
      />
    );
  }
  return (
    <ul className="rounded-xl border border-surface-border bg-surface-raised divide-y divide-surface-border">
      {activity.slice(0, 8).map((entry) => (
        <li key={entry.id} className="px-4 py-3 flex items-start gap-3 text-sm">
          <span
            className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
              entry.severity === 'critical' ? 'bg-state-danger' :
              entry.severity === 'warning' ? 'bg-state-warning' :
              'bg-state-info'
            }`}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="text-zinc-200">{entry.message}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {entry.severity} · {new Date(entry.timestamp).toLocaleString()}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

type Bucket = 'agents' | 'skills' | 'knowledge' | 'channels';

function InventoryCard({
  label,
  icon,
  state,
  bucket,
}: {
  label: string;
  icon: React.ReactNode;
  state: CardState<AdminInventoryResponse>;
  bucket: Bucket;
}) {
  if (state.loading) return <PanelLoading label={`Loading ${label.toLowerCase()}…`} />;
  if (state.error) return <PanelError message={state.error} />;
  const items = state.data?.[bucket] ?? [];
  const count = items.length;
  return (
    <article
      className="rounded-xl border border-surface-border bg-surface-raised p-4"
      aria-labelledby={`cc-bucket-${bucket}-heading`}
    >
      <header className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-md bg-accent-500/15 text-accent-400 flex items-center justify-center">
          {icon}
        </div>
        <h3 id={`cc-bucket-${bucket}-heading`} className="text-sm font-semibold text-zinc-100">
          {label}
        </h3>
      </header>
      <p className="text-2xl font-mono text-zinc-100" aria-label={`${label} count: ${count}`}>
        {count}
      </p>
      {count === 0 ? (
        <p className="text-xs text-zinc-500 mt-2" role="status">
          No {label.toLowerCase()} registered platform-wide.
        </p>
      ) : (
        <ul className="mt-2 text-xs text-zinc-400 space-y-0.5 max-h-24 overflow-y-auto">
          {items.slice(0, 5).map((item, idx) => (
            <li key={(item.id ?? `item-${idx}`)} className="truncate">
              {item.name ?? item.id ?? `${label} ${idx + 1}`}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function AuditCard({ state }: { state: CardState<AdminAuditCorrelation> }) {
  if (state.loading) return <PanelLoading label="Loading audit events…" />;
  if (state.error) return <PanelError message={state.error} />;
  const events = state.data?.events ?? [];
  if (events.length === 0) {
    return (
      <EmptyPanel
        icon={<Wallet className="w-5 h-5" />}
        title="No correlated audit events"
        description="Cross-source audit feeds will appear here once activity exists."
      />
    );
  }
  return (
    <ul className="rounded-xl border border-surface-border bg-surface-raised divide-y divide-surface-border">
      {events.slice(0, 10).map((event) => (
        <li key={event.id} className="px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-200 font-medium">{event.action}</span>
            <span className="font-mono text-xs text-zinc-500">
              {new Date(event.occurredAt).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            actor={event.actor}
            {event.resource ? ` · resource=${event.resource}` : ''}
            {event.correlationId ? ` · corr=${event.correlationId}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}

function KillSwitchCard({
  state,
  onToggle,
  toggling,
}: {
  state: CardState<AdminKillSwitchListResponse>;
  onToggle: (entry: AdminKillSwitchEntry) => void;
  toggling: string | null;
}) {
  if (state.loading) return <PanelLoading label="Loading kill switches…" />;
  if (state.error) return <PanelError message={state.error} />;
  const entries = state.data?.entries ?? [];
  if (entries.length === 0) {
    return (
      <EmptyPanel
        icon={<ShieldCheck className="w-5 h-5" />}
        title="No kill switches configured"
        description="Phase, channel, and tenant-feature flags will appear here once registered."
      />
    );
  }
  return (
    <ul className="rounded-xl border border-surface-border bg-surface-raised divide-y divide-surface-border">
      {entries.map((entry) => {
        const key = `${entry.scope}:${entry.target}`;
        const isToggling = toggling === key;
        return (
          <li key={key} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {entry.enabled ? (
                  <ShieldAlert className="w-4 h-4 text-state-danger" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-state-success" aria-hidden="true" />
                )}
                <span className="text-sm font-medium text-zinc-100 truncate">
                  {entry.target}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
                  {entry.scope}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Updated {new Date(entry.updatedAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={entry.enabled}
              aria-label={`${entry.enabled ? 'Disable' : 'Enable'} ${entry.target}`}
              disabled={isToggling}
              onClick={() => void onToggle(entry)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50 ${
                entry.enabled ? 'bg-state-danger' : 'bg-surface-overlay border border-surface-border'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  entry.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Shared bits ───────────────────────────────────────────────────────────

function PanelLoading({ label }: { label: string }) {
  return (
    <div
      className="rounded-xl border border-surface-border bg-surface-raised p-6 flex items-center gap-2 text-sm text-zinc-500"
      role="status"
    >
      <Loader2 className="w-4 h-4 animate-spin" />
      {label}
    </div>
  );
}

function PanelError({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-state-danger/30 bg-state-danger/5 p-4 flex items-start gap-2 text-sm text-state-danger"
      role="status"
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-state-danger/30 bg-state-danger/10 p-4 flex items-start gap-2 text-sm text-state-danger"
      role="alert"
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function EmptyPanel({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-xl border border-surface-border bg-surface-raised p-6 text-center"
      role="status"
    >
      <div className="w-10 h-10 mx-auto rounded-lg bg-surface-overlay text-zinc-400 flex items-center justify-center mb-2">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
      <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">{description}</p>
    </div>
  );
}
