'use client';

/**
 * /ai-twin — AI Twin workspace.
 *
 * Phase 1 of the Creatio AI parity program (v2 plan §5.3).
 *
 * Renders:
 *   • My Agents list (DRAFT / ACTIVE / PAUSED / ARCHIVED)
 *   • 4-step wizard (Goal → Iterate → Try → Deploy)
 *   • Pause / Resume / Archive lifecycle controls
 *   • Audit trail panel
 *
 * Solid (frontend):
 *   • SRP — page composes the wizard, list, inspector; no business logic.
 *   • SRP — wizard component owns the multi-step state.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Pause,
  Play,
  Archive,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Circle,
  ChevronRight,
} from 'lucide-react';

import TenantShell from '@/components/TenantShell';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { PageShell, PageHero, GlassPanel } from '@neurecore/ui-visual';
import { KpiCard } from '@/components/creatio/KpiCard';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import {
  listTwins,
  findTwin,
  listAudits,
  createTwin,
  advanceStep,
  deploy,
  pause,
  resume,
  archive,
  type AiTwin,
  type AiTwinAudit,
  type TwinStatus,
} from '@/services/ai-twin.service';

const STEPS = [
  { key: 1, label: 'Describe Your Goal' },
  { key: 2, label: 'Iterate with the AI Twin' },
  { key: 3, label: 'Try Your Agent Instantly' },
  { key: 4, label: 'Deploy with Confidence' },
] as const;

const SCOPE_CATALOG: { id: string; label: string; side: 'read' | 'write' }[] = [
  { id: 'crm.read.contacts', label: 'CRM — read contacts', side: 'read' },
  { id: 'crm.read.deals', label: 'CRM — read deals', side: 'read' },
  { id: 'crm.write.tasks', label: 'CRM — write tasks', side: 'write' },
  { id: 'knowledge.search', label: 'Knowledge — search articles', side: 'read' },
  { id: 'chat.send', label: 'Chat — send messages', side: 'write' },
];

export default function AiTwinPage() {
  const user = useTenantAuth();
  const [twins, setTwins] = useState<AiTwin[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audits, setAudits] = useState<AiTwinAudit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listTwins();
      setTwins(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user, selectedId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = useMemo(
    () => twins.find((t) => t.id === selectedId) ?? null,
    [twins, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setAudits([]);
      return;
    }
    listAudits(selected.id).then(setAudits).catch(() => setAudits([]));
  }, [selected]);

  const stats = useMemo(() => {
    return {
      total: twins.length,
      active: twins.filter((t) => t.status === 'ACTIVE').length,
      draft: twins.filter((t) => t.status === 'DRAFT').length,
      paused: twins.filter((t) => t.status === 'PAUSED').length,
    };
  }, [twins]);

  // Auth guard: useTenantAuth() returns null during static prerender and
  // before the auth store resolves. Rendering TenantShell (which requires a
  // non-null user) would crash; the auth hook redirects to /login once the
  // session resolves. Solid: same guard pattern as existing tenant pages.
  if (!user) return null;

  return (
    <TenantShell user={user}>
      <PageShell>
        <PageHero
          eyebrow="Personal Agents"
          title="AI Twin"
          subtitle="Build personal agents that inherit your permissions — never exceed them."
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <KpiCard label="My Twins" value={stats.total} color="ops" />
          <KpiCard label="Active" value={stats.active} color="profit" />
          <KpiCard label="Draft" value={stats.draft} color="strategy" />
          <KpiCard label="Paused" value={stats.paused} color="warn" />
        </div>

        {error && (
          <GlassPanel className="mb-6 border-red-500/50 bg-red-500/10">
            <p className="text-red-300 text-sm">{error}</p>
          </GlassPanel>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Left: my agents list */}
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white/80">
                My Agents
              </h2>
              <button
                type="button"
                onClick={refresh}
                className="p-1 text-white/60 hover:text-white"
                aria-label="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {twins.length === 0 && !loading && (
                <p className="text-xs text-white/40 py-4 text-center">
                  No twins yet — create one below.
                </p>
              )}
              {twins.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left rounded-md px-3 py-2 transition-colors ${
                    selectedId === t.id
                      ? 'bg-violet-500/20 border border-violet-400/40'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white">{t.displayName}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="text-xs text-white/40">/{t.slug}</div>
                </button>
              ))}
            </div>
            <NewTwinForm onCreated={(t) => setSelectedId(t.id)} />
          </GlassPanel>

          {/* Right: wizard + audit */}
          <div className="space-y-6">
            {selected ? (
              <TwinInspector
                twin={selected}
                audits={audits}
                onChanged={refresh}
              />
            ) : (
              <GlassPanel className="p-8 text-center text-white/40">
                Select or create a twin to begin.
              </GlassPanel>
            )}
          </div>
        </div>
      </PageShell>
    </TenantShell>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────

function NewTwinForm({
  onCreated,
}: {
  onCreated: (t: AiTwin) => void;
}) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      const created = await createTwin({
        slug,
        displayName,
        step1Goal: { goal },
      });
      onCreated(created);
      setOpen(false);
      setSlug('');
      setDisplayName('');
      setGoal('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-dashed border-white/20 px-3 py-2 text-sm text-white/60 hover:text-white hover:border-white/40"
      >
        + New Twin
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-white/10 p-3">
      <input
        type="text"
        placeholder="slug (lowercase, dashes ok)"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
      />
      <input
        type="text"
        placeholder="display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
      />
      <textarea
        placeholder="what should your twin do?"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={2}
        className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-xs text-white"
      />
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !slug || !displayName || !goal}
          className="flex-1 rounded bg-violet-600 hover:bg-violet-500 px-2 py-1 text-xs text-white disabled:opacity-40"
        >
          {submitting ? 'Creating…' : 'Create draft'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-white/10 px-2 py-1 text-xs text-white/60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TwinInspector({
  twin,
  audits,
  onChanged,
}: {
  twin: AiTwin;
  audits: AiTwinAudit[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const runStep = async (
    step: 1 | 2 | 3 | 4,
    payload: Record<string, unknown>,
    scopes?: { read: string[]; write: string[] },
  ) => {
    setBusy(true);
    setErr(null);
    try {
      await advanceStep(twin.id, step, { payload, ...scopes });
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runDeploy = async () => {
    setBusy(true);
    setErr(null);
    try {
      await deploy(twin.id, {
        agentTemplateId: 'placeholder-agent-template',
        agentTemplateVersionId: 'placeholder-version',
      });
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runLifecycle = async (op: 'pause' | 'resume' | 'archive') => {
    setBusy(true);
    setErr(null);
    try {
      if (op === 'pause') await pause(twin.id);
      if (op === 'resume') await resume(twin.id);
      if (op === 'archive') await archive(twin.id);
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              {twin.displayName}
            </h3>
            <p className="text-xs text-white/40">/{twin.slug}</p>
          </div>
          <StatusBadge status={twin.status} />
        </div>

        {/* Stepper */}
        <ol className="grid grid-cols-4 gap-2 mb-4">
          {STEPS.map((s) => {
            const done = twin.wizardStep >= s.key;
            return (
              <li
                key={s.key}
                className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                  done
                    ? 'bg-violet-500/15 text-violet-200'
                    : 'bg-white/5 text-white/40'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                <span>
                  {s.key}. {s.label}
                </span>
              </li>
            );
          })}
        </ol>

        {err && (
          <p className="text-xs text-red-400 mb-3">{err}</p>
        )}

        <WizardBody
          twin={twin}
          busy={busy}
          onAdvance={runStep}
          onDeploy={runDeploy}
          onLifecycle={runLifecycle}
        />
      </GlassPanel>

      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-white/80 mb-3">
          Audit Trail
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {audits.length === 0 && (
            <p className="text-xs text-white/40 py-4 text-center">
              No actions recorded yet.
            </p>
          )}
          {audits.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 border-b border-white/5 pb-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/80">{a.action}</div>
                <div className="text-xs text-white/40">
                  by {a.actorUserId}
                  {a.reason ? ` · ${a.reason}` : ''}
                </div>
              </div>
              <span className="text-[10px] text-white/40 whitespace-nowrap">
                {new Date(a.occurredAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

function WizardBody({
  twin,
  busy,
  onAdvance,
  onDeploy,
  onLifecycle,
}: {
  twin: AiTwin;
  busy: boolean;
  onAdvance: (
    step: 1 | 2 | 3 | 4,
    payload: Record<string, unknown>,
    scopes?: { read: string[]; write: string[] },
  ) => void;
  onDeploy: () => void;
  onLifecycle: (op: 'pause' | 'resume' | 'archive') => void;
}) {
  if (twin.status === 'ARCHIVED') {
    return (
      <p className="text-xs text-white/40">
        This twin is archived. The audit trail above is preserved indefinitely.
      </p>
    );
  }

  if (twin.status === 'ACTIVE') {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onLifecycle('pause')}
          disabled={busy}
          className="flex items-center gap-1 rounded bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          <Pause className="h-3 w-3" /> Pause
        </button>
        <button
          type="button"
          onClick={() => onLifecycle('archive')}
          disabled={busy}
          className="flex items-center gap-1 rounded border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 disabled:opacity-40"
        >
          <Archive className="h-3 w-3" /> Archive
        </button>
      </div>
    );
  }

  if (twin.status === 'PAUSED') {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onLifecycle('resume')}
          disabled={busy}
          className="flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          <Play className="h-3 w-3" /> Resume
        </button>
        <button
          type="button"
          onClick={() => onLifecycle('archive')}
          disabled={busy}
          className="flex items-center gap-1 rounded border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 disabled:opacity-40"
        >
          <Archive className="h-3 w-3" /> Archive
        </button>
      </div>
    );
  }

  // DRAFT
  const currentStep = Math.min(4, Math.max(1, twin.wizardStep)) as 1 | 2 | 3 | 4;
  return (
    <WizardStepEditor
      step={currentStep}
      busy={busy}
      onAdvance={onAdvance}
      onDeploy={onDeploy}
      onLifecycle={onLifecycle}
    />
  );
}

function WizardStepEditor({
  step,
  busy,
  onAdvance,
  onDeploy,
  onLifecycle,
}: {
  step: 1 | 2 | 3 | 4;
  busy: boolean;
  onAdvance: (
    step: 1 | 2 | 3 | 4,
    payload: Record<string, unknown>,
    scopes?: { read: string[]; write: string[] },
  ) => void;
  onDeploy: () => void;
  onLifecycle: (op: 'pause' | 'resume' | 'archive') => void;
}) {
  const [text, setText] = useState('');
  const [read, setRead] = useState<string[]>([]);
  const [write, setWrite] = useState<string[]>([]);

  const toggleScope = (id: string, side: 'read' | 'write') => {
    if (side === 'read') {
      setRead(read.includes(id) ? read.filter((x) => x !== id) : [...read, id]);
    } else {
      setWrite(write.includes(id) ? write.filter((x) => x !== id) : [...write, id]);
    }
  };

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="space-y-2"
        >
          {step === 1 && (
            <>
              <p className="text-xs text-white/60">
                Describe your twin's goal in natural language.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="e.g. summarise every new CRM contact and ping me on Slack"
                className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
              />
            </>
          )}
          {step === 2 && (
            <>
              <p className="text-xs text-white/60">
                Refine — describe tools and constraints.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="e.g. only act on contacts owned by me; never auto-send emails"
                className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
              />
            </>
          )}
          {step === 3 && (
            <>
              <p className="text-xs text-white/60">
                Test — record a sample prompt + expected outcome.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="sample prompt → expected output"
                className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-sm text-white"
              />
            </>
          )}
          {step === 4 && (
            <>
              <p className="text-xs text-white/60">
                Deploy — grant explicit scopes. Nothing else is allowed.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SCOPE_CATALOG.map((s) => {
                  const checked =
                    s.side === 'read' ? read.includes(s.id) : write.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 rounded border border-white/10 px-2 py-1 text-xs text-white/80 cursor-pointer hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleScope(s.id, s.side)}
                        className="accent-violet-500"
                      />
                      <span className="font-mono">{s.id}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-white/40">
                Read scopes: {read.length} · Write scopes: {write.length}
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {step < 4 ? (
        <button
          type="button"
          onClick={() =>
            onAdvance(step, text ? { text } : {}, undefined)
          }
          disabled={busy || !text}
          className="flex items-center gap-1 rounded bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          Next <ChevronRight className="h-3 w-3" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onAdvance(4, {}, { read, write })}
          disabled={busy || read.length + write.length === 0}
          className="flex items-center gap-1 rounded bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          Save scopes
        </button>
      )}

      {step === 4 && (
        <button
          type="button"
          onClick={onDeploy}
          disabled={busy}
          className="flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          Deploy Twin
        </button>
      )}

      <button
        type="button"
        onClick={() => onLifecycle('archive')}
        disabled={busy}
        className="text-[11px] text-white/40 hover:text-white"
      >
        <ArrowLeft className="inline h-3 w-3" /> Discard twin
      </button>
    </div>
  );
}
