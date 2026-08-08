"use client";

/**
 * /governance — Governance Application shell (Phase 2 of the Creatio
 * AI parity program; v2 plan §5.14).
 *
 * Renders the 4 governance domains with passing/failing control counts
 * and exposes the seed action to onboard the predefined controls.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, ShieldAlert, ServerCog, Lock, RefreshCw, Plus } from 'lucide-react';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  fetchDomains,
  seed,
  type GovernanceDomainSummary,
} from '@/services/governance.service';

const DOMAIN_ICONS: Record<string, React.ReactElement> = {
  data: <Database className="h-5 w-5" />,
  'user-access': <ShieldAlert className="h-5 w-5" />,
  operational: <ServerCog className="h-5 w-5" />,
  security: <Lock className="h-5 w-5" />,
};

export default function GovernancePage() {
  const user = useAdminAuth();
  const [domains, setDomains] = useState<GovernanceDomainSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await fetchDomains();
      setDomains(list);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSeed = async () => {
    setSeeding(true);
    setMsg(null);
    try {
      const res = await seed();
      setMsg(`Seeded ${res.created} predefined controls.`);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AdminShell user={user}>
      <div className="px-6 py-8 max-w-6xl">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Governance Application</h1>
            <p className="text-sm text-white/60 mt-1">
              Four domains — Data, User Access, Operational, Security. Seed the
              predefined controls to begin; customise from there.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-1 rounded border border-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              type="button"
              onClick={onSeed}
              disabled={seeding}
              className="flex items-center gap-1 rounded bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> {seeding ? 'Seeding…' : 'Seed controls'}
            </button>
          </div>
        </header>

        {err && (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {err}
          </div>
        )}
        {msg && (
          <div className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {msg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {domains.length === 0 && !loading && (
            <div className="md:col-span-2 rounded-md border border-dashed border-white/10 p-8 text-center text-white/40">
              No governance domains seeded yet — click "Seed controls" to begin.
            </div>
          )}
          {domains.map((d) => (
            <motion.div
              key={d.domain}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-md border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-center gap-2 mb-2 text-white">
                {DOMAIN_ICONS[d.domain] ?? <Lock className="h-5 w-5" />}
                <h2 className="text-base font-semibold">{d.displayName}</h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-white/60">
                <div>
                  <div className="text-white/40">Total</div>
                  <div className="text-lg text-white">{d.total}</div>
                </div>
                <div>
                  <div className="text-white/40">Passing</div>
                  <div className="text-lg text-emerald-300">{d.passing}</div>
                </div>
                <div>
                  <div className="text-white/40">Failing</div>
                  <div className="text-lg text-red-300">{d.failing}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
          <NavCard
            href="/governance/controls"
            title="Control Library"
            description="Predefined + custom controls with severity, standards mapping, and cadence."
          />
          <NavCard
            href="/governance/audit"
            title="Audit Center"
            description="Append-only audit history across DSR, LLM bindings, AI Twins, and approvals."
          />
          <NavCard
            href="/governance/dsr"
            title="GDPR DSR Workflow"
            description="Open, track, and complete Data Subject Requests."
          />
        </div>
      </div>
    </AdminShell>
  );
}

function NavCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="block rounded-md border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
    >
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <p className="text-xs text-white/50 mt-1">{description}</p>
    </a>
  );
}
