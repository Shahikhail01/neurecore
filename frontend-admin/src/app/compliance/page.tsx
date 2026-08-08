"use client";

/**
 * /compliance — Compliance Posture Center (Phase 2 of the Creatio AI
 * parity program; v2 plan §5.18).
 *
 * Renders posture for the 5 standards: AICPA SOC 2, HIPAA, GDPR,
 * ISO 27001, EU AI Act. Score and notes are computed live from real
 * audit data by the backend.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, RefreshCw, AlertTriangle } from 'lucide-react';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  fetchReport,
  type PostureReport,
  type StandardPosture,
  type PostureStatus,
} from '@/services/compliance.service';

const STATUS_LABEL: Record<PostureStatus, string> = {
  COMPLIANT: 'Compliant',
  PARTIAL: 'Partial',
  NON_COMPLIANT: 'Non-compliant',
  UNKNOWN: 'Unknown',
};

const STATUS_COLOR: Record<PostureStatus, string> = {
  COMPLIANT: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  PARTIAL: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  NON_COMPLIANT: 'bg-red-500/15 text-red-300 border-red-500/30',
  UNKNOWN: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
};

export default function CompliancePage() {
  const user = useAdminAuth();
  const [report, setReport] = useState<PostureReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchReport();
      setReport(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AdminShell user={user}>
      <div className="px-6 py-8 max-w-6xl">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" /> Compliance Posture Center
            </h1>
            <p className="text-sm text-white/60 mt-1">
              Posture is computed from real audit data — not asserted.
              Coverage: SOC 2, HIPAA, GDPR, ISO 27001, EU AI Act.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-1 rounded border border-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </header>

        {error && (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {report && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <KpiTile label="Overall score" value={`${report.summary.overallScore}`} accent="text-white" />
              <KpiTile label="Compliant" value={report.summary.compliant} accent="text-emerald-300" />
              <KpiTile label="Partial" value={report.summary.partial} accent="text-amber-300" />
              <KpiTile label="Non-compliant" value={report.summary.nonCompliant} accent="text-red-300" />
              <KpiTile label="Unknown" value={report.summary.unknown} accent="text-zinc-300" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.standards.map((s) => (
                <StandardCard key={s.standardId} standard={s} />
              ))}
            </div>

            <p className="mt-6 text-[11px] text-white/40">
              Generated {new Date(report.generatedAt).toLocaleString()} · tenant{' '}
              {report.tenantId}
            </p>
          </>
        )}

        {!report && !loading && (
          <div className="rounded-md border border-white/10 p-8 text-center text-white/40">
            No report yet.
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className={`text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function StandardCard({ standard }: { standard: StandardPosture }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-md border p-4 ${STATUS_COLOR[standard.status]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold">{standard.displayName}</h2>
        <span className="text-xs font-mono">{standard.score}/100</span>
      </div>
      <div className="text-xs mb-2 opacity-80">
        Status: {STATUS_LABEL[standard.status]} ·{' '}
        {standard.passingControls} passing · {standard.failingControls} failing
      </div>
      {standard.notes.length > 0 ? (
        <ul className="space-y-1 mt-2">
          {standard.notes.map((n, i) => (
            <li key={i} className="flex items-start gap-1 text-xs">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs opacity-70 mt-2">
          No outstanding issues detected.
        </p>
      )}
    </motion.div>
  );
}
