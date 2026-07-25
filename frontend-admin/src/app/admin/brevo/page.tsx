"use client";

import AdminBrevoShell from "@/components/admin-brevo/AdminBrevoShell";
import {
  KpiCard,
  StatusBadge,
  EventTypeBadge,
  QuotaBar,
} from "@/components/admin-brevo/BrevoAdminPrimitives";
import { Sparkline } from "@/components/charts/Sparkline";
import { AreaChart } from "@/components/charts/AreaChart";
import { useAdminBrevo } from "@/hooks/useAdminBrevo";
import { toast } from "sonner";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminBrevoOverviewPage() {
  const { loading, error, stats, tenants, series, health, refresh } =
    useAdminBrevo();

  if (loading && !stats) {
    return (
      <AdminBrevoShell subtitle="Loading platform-wide Brevo summary…">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-lg bg-zinc-800/40 animate-pulse"
              />
            ))}
          </div>
          <div className="h-64 rounded-lg bg-zinc-800/30 animate-pulse" />
        </div>
      </AdminBrevoShell>
    );
  }

  if (error && !stats) {
    return (
      <AdminBrevoShell>
        <div className="p-4 rounded-lg border border-rose-500/30 bg-[color:var(--visual-accent-rose-500)]/10 text-rose-200 text-sm">
          {error}
          <button
            onClick={() => void refresh()}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </AdminBrevoShell>
    );
  }

  if (!stats) return null;

  const last7 = series.slice(-7);
  const sparkData = last7.map((p) => ({
    ts: p.date,
    value: p.total,
  }));

  // Top 5 tenants by today's send count
  const topTenants = [...tenants]
    .sort((a, b) => b.sentToday - a.sentToday)
    .slice(0, 5);

  return (
    <AdminBrevoShell>
      {error && (
        <div className="mb-4 p-3 rounded-lg border border-rose-500/30 bg-[color:var(--visual-accent-rose-500)]/10 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Connected tenants"
          value={
            <>
              {stats.tenantsConnected}
              <span className="text-sm text-zinc-500 ml-1">
                / {stats.totalTenants}
              </span>
            </>
          }
          hint={
            <span>
              + {stats.tenantsUsingMasterKey} on master key ·
              {" "}
              {stats.tenantsNotRouted} unrouted
            </span>
          }
          icon="🔌"
        />
        <KpiCard
          label="Sent today"
          value={stats.totalSentToday.toLocaleString()}
          hint={
            <span>
              Last 30 days: {stats.totalSentLast30Days.toLocaleString()}
            </span>
          }
          icon="✉️"
          tone={
            stats.totalSentToday > stats.globalDailyLimit * 0.8
              ? "warn"
              : "good"
          }
        />
        <KpiCard
          label="Daily limit"
          value={stats.globalDailyLimit.toLocaleString()}
          hint={<span>Per-tenant default</span>}
          icon="📊"
        />
        <KpiCard
          label="Master key"
          value={stats.masterKeyConfigured ? "Configured" : "Missing"}
          tone={stats.masterKeyConfigured ? "good" : "bad"}
          hint={
            <span>
              Webhook secret:{" "}
              {stats.webhookSecretConfigured ? "✓ set" : "✗ unset"}
            </span>
          }
          icon="🔑"
        />
      </div>

      {/* ── Suppression quick-look + cross-link ──────────────────── */}
      {stats?.suppressions && (
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">
              Suppression list
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Sending is auto-skipped to {stats.suppressions.total}{" "}
              suppressed address(es). Built up automatically from hard-bounces,
              unsubscribes, and spam complaints.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {(
                Object.entries(stats.suppressions.byReason) as Array<
                  [string, number]
                >
              ).map(([reason, count]) => (
                <span
                  key={reason}
                  className="px-2 py-0.5 rounded bg-zinc-900/60 border border-zinc-800 text-zinc-300 font-mono"
                  title={`${reason}: ${count}`}
                >
                  {reason.replace("_", " ")}: {count}
                </span>
              ))}
            </div>
          </div>
          <Link
            href="/admin/brevo/suppressions"
            className="text-xs px-3 py-1.5 rounded border border-[color:var(--accent-500)]/30 bg-[color:var(--accent-500)]/10 text-indigo-300 hover:bg-[color:var(--accent-500)]/20"
          >
            Manage suppressions →
          </Link>
        </div>
      )}

      {/* ── Sparkline + chart ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-zinc-200">
              Sends (last 7 days)
            </h2>
            <Link
              href="/admin/brevo/tenants"
              className="text-xs text-[color:var(--accent-400)] hover:underline"
            >
              View tenants →
            </Link>
          </div>
          <AreaChart
            data={last7.map((p) => ({
              ts: p.date,
              value: p.total,
            }))}
            height={220}
            color="#6366f1"
            label="Emails"
            loading={loading}
          />
        </div>
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-medium text-zinc-200 mb-2">
            Trend (last 7 days)
          </h2>
          <Sparkline data={sparkData} color="#22d3ee" height={48} />
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-zinc-500">Avg / day</p>
              <p className="text-zinc-200 font-mono">
                {sparkData.length === 0
                  ? "—"
                  : Math.round(
                      sparkData.reduce((s, d) => s + d.value, 0) /
                        sparkData.length,
                    ).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Peak</p>
              <p className="text-zinc-200 font-mono">
                {sparkData.length === 0
                  ? "—"
                  : Math.max(...sparkData.map((d) => d.value)).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Health / config probe ─────────────────────────────────────── */}
      {health && (
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-medium text-zinc-200">
                Brevo API health
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Last checked {new Date(health.fetchedAt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => void refresh()}
              className="text-xs text-[color:var(--accent-400)] hover:underline"
            >
              Re-probe
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span
              className={`px-2 py-0.5 rounded border ${
                health.ok
                  ? "bg-[color:var(--state-success)]/10 text-emerald-300 border-[color:var(--state-success)]/20"
                  : "bg-[color:var(--visual-accent-rose-500)]/10 text-rose-300 border-rose-500/20"
              }`}
            >
              {health.ok ? "Healthy" : "Unhealthy"}
            </span>
            <span className="text-zinc-500">
              source:{" "}
              <span className="font-mono text-zinc-300">{health.source}</span>
            </span>
            <span className="text-zinc-500">
              webhook endpoint:{" "}
              <span className="font-mono text-zinc-300">
                {health.webhook.endpoint}
              </span>
            </span>
          </div>
          {health.account?.["email"] !== undefined && (
            <div className="mt-3 text-xs text-zinc-400 font-mono">
              {Object.entries(health.account)
                .slice(0, 6)
                .map(([k, v]) => (
                  <span key={k} className="mr-3">
                    {k}: {String(v)}
                  </span>
                ))}
            </div>
          )}
          {health.error && (
            <p className="mt-2 text-xs text-rose-300 font-mono">
              {health.error}
            </p>
          )}
        </div>
      )}

      {/* ── Top tenants ───────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-200">
            Top senders (today)
          </h2>
          <Link
            href="/admin/brevo/tenants"
            className="text-xs text-[color:var(--accent-400)] hover:underline"
          >
            All tenants →
          </Link>
        </div>
        {topTenants.length === 0 ? (
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
            No tenants yet.
          </div>
        ) : (
          <div className="space-y-2">
            {topTenants.map((t) => (
              <div
                key={t.tenantId}
                className="flex items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {t.tenantName}
                    </p>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="text-xs text-zinc-500 truncate">
                    {t.tenantId}
                    {t.brevoSenderEmail ? ` · ${t.brevoSenderEmail}` : ""}
                  </p>
                </div>
                <div className="w-40">
                  <QuotaBar
                    used={t.sentToday}
                    limit={t.dailyLimit}
                    warningAt={Math.floor(t.dailyLimit * 0.8)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent events (5 rows preview) ─────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-200">
            Recent webhook events
          </h2>
          <Link
            href="/admin/brevo/events"
            className="text-xs text-[color:var(--accent-400)] hover:underline"
          >
            Open explorer →
          </Link>
        </div>
        <RecentEventsPreview onError={(e) => toast.error(e)} />
      </div>
    </AdminBrevoShell>
  );
}

function RecentEventsPreview({ onError }: { onError: (msg: string) => void }) {
  const [rows, setRows] = useState<Array<{
    id: string;
    eventType: string;
    email: string;
    tenantId: string | null;
    messageId: string | null;
    receivedAt: string;
  }> | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          "/api/v1/integrations/admin/brevo/events?limit=5",
          { signal: abort.signal, credentials: "include" },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { rows: typeof rows };
        setRows(data.rows ?? []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        onError((err as Error).message);
      }
    })();
    return () => abort.abort();
  }, [onError]);

  if (rows === null) {
    return (
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-6 text-center text-xs text-zinc-500">
        Loading recent events…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-6 text-center text-xs text-zinc-500">
        No webhook events received yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 divide-y divide-zinc-800/60">
      {rows.map((e) => (
        <div
          key={e.id}
          className="flex items-center gap-3 px-3 py-2 text-xs"
        >
          <EventTypeBadge type={e.eventType} />
          <span className="font-mono text-zinc-300 truncate">{e.email}</span>
          <span className="text-zinc-500 truncate">{e.tenantId ?? "—"}</span>
          <span className="ml-auto text-zinc-500 font-mono">
            {new Date(e.receivedAt).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
