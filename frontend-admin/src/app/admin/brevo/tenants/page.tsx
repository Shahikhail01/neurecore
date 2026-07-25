"use client";

import { useMemo, useState } from "react";
import AdminBrevoShell from "@/components/admin-brevo/AdminBrevoShell";
import {
  KpiCard,
  StatusBadge,
  QuotaBar,
} from "@/components/admin-brevo/BrevoAdminPrimitives";
import { useAdminBrevo } from "@/hooks/useAdminBrevo";
import { toast } from "sonner";
import type { AdminBrevoTenantRow, BrevoTenantStatus } from "@/types/adminBrevo.types";

type Filter = "ALL" | BrevoTenantStatus;

export default function AdminBrevoTenantsPage() {
  const {
    loading,
    error,
    stats,
    tenants,
    disconnectTenant,
    resetQuota,
  } = useAdminBrevo();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo<AdminBrevoTenantRow[]>(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (filter !== "ALL" && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.tenantName.toLowerCase().includes(q) ||
        t.tenantId.toLowerCase().includes(q) ||
        (t.brevoSenderEmail ?? "").toLowerCase().includes(q)
      );
    });
  }, [tenants, filter, search]);

  async function handleDisconnect(t: AdminBrevoTenantRow) {
    const ok = confirm(
      `Disconnect Brevo for "${t.tenantName}"?\n\nThis clears the tenant's Brevo API key, removes any per-tenant sender identity, and (if no master key is configured) prevents email sending until reconnected.\n\nThe action is recorded in the platform audit log.`,
    );
    if (!ok) return;
    try {
      setBusyId(t.tenantId);
      const r = await disconnectTenant(t.tenantId);
      toast.success(
        `Disconnected Brevo for ${t.tenantName}. ` +
          `Removed credential=${r.hadCredential}, sender=${r.hadSenderIdentity}.`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to disconnect tenant",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleResetQuota(t: AdminBrevoTenantRow) {
    const ok = confirm(
      `Reset today's quota for "${t.tenantName}"? Sent ${t.sentToday} emails today. This zeros the counter for the current UTC day.`,
    );
    if (!ok) return;
    try {
      setBusyId(t.tenantId);
      const r = await resetQuota(t.tenantId);
      if (r.reset) {
        toast.success(
          `Cleared ${r.previousCount} email(s) from today's counter for ${t.tenantName}.`,
        );
      } else {
        toast.info(`No counter to reset for ${t.tenantName}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminBrevoShell subtitle="Per-tenant Brevo credentials, daily quota, and per-tenant sender identity.">
      {error && (
        <div className="mb-4 p-3 rounded-lg border border-rose-500/30 bg-[color:var(--visual-accent-rose-500)]/10 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by tenant name, id, sender…"
          className="flex-1 rounded-lg bg-zinc-900/40 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <div className="flex gap-1">
          {(
            [
              { id: "ALL", label: "All" },
              { id: "CONNECTED", label: "Connected" },
              { id: "MASTER", label: "Master" },
              { id: "NOT_CONNECTED", label: "Not connected" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={`px-3 py-1.5 text-xs rounded border ${
                filter === opt.id
                  ? "bg-[color:var(--accent-500)]/20 text-indigo-300 border-[color:var(--accent-500)]/40"
                  : "bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:text-zinc-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Quick KPIs ──────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard
            label="Total tenants"
            value={stats.totalTenants}
            icon="📇"
          />
          <KpiCard
            label="Connected"
            value={stats.tenantsConnected}
            tone="good"
            icon="🔗"
          />
          <KpiCard
            label="Master key"
            value={stats.tenantsUsingMasterKey}
            tone="warn"
            icon="🗝"
            hint={
              <span>
                {stats.masterKeyConfigured
                  ? "Master configured"
                  : "Master NOT configured"}
              </span>
            }
          />
          <KpiCard
            label="Unrouted"
            value={stats.tenantsNotRouted}
            tone={stats.tenantsNotRouted > 0 ? "bad" : "neutral"}
            icon="🚫"
          />
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left font-medium px-4 py-3">Tenant</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                Sender
              </th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">
                Updated
              </th>
              <th className="text-left font-medium px-4 py-3">Quota</th>
              <th className="text-right font-medium px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {loading && tenants.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3">
                    <div className="h-4 w-40 bg-zinc-800 rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-24 bg-zinc-800 rounded" />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="h-4 w-32 bg-zinc-800 rounded" />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="h-4 w-28 bg-zinc-800 rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-32 bg-zinc-800 rounded" />
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-zinc-500"
                >
                  {tenants.length === 0
                    ? "No tenants in the system yet."
                    : "No tenants match the current filter."}
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const isBusy = busyId === t.tenantId;
                return (
                  <tr
                    key={t.tenantId}
                    className="text-zinc-200 hover:bg-zinc-900/60"
                  >
                    <td className="px-4 py-3 max-w-[16rem]">
                      <p className="truncate font-medium">{t.tenantName}</p>
                      <p className="text-xs text-zinc-500 truncate font-mono">
                        {t.tenantId}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={t.status} />
                        {t.isAtLimit && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--visual-accent-rose-500)]/15 text-rose-300 border border-rose-500/30 font-mono">
                            AT LIMIT
                          </span>
                        )}
                        {!t.isAtLimit && t.isAtWarning && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--state-warning)]/15 text-amber-300 border border-[color:var(--state-warning)]/30 font-mono">
                            WARNING
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {t.brevoSenderEmail ? (
                        <div>
                          <p className="text-xs text-zinc-200 font-mono truncate">
                            {t.brevoSenderEmail}
                          </p>
                          {t.brevoSenderName && (
                            <p className="text-xs text-zinc-500 truncate">
                              {t.brevoSenderName}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500">
                          {stats?.globalFromAddress ? (
                            <>
                              <span className="line-through">
                                default
                              </span>{" "}
                              <span className="font-mono">
                                {stats.globalFromAddress}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-zinc-500 font-mono">
                      {t.credentialLastUpdatedAt
                        ? new Date(t.credentialLastUpdatedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 w-44">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs text-zinc-300 font-mono">
                          {t.sentToday} / {t.dailyLimit}
                        </p>
                        <QuotaBar
                          used={t.sentToday}
                          limit={t.dailyLimit}
                          warningAt={Math.floor(t.dailyLimit * 0.8)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        {t.sentToday > 0 && (
                          <button
                            onClick={() => handleResetQuota(t)}
                            disabled={isBusy}
                            className="text-xs px-2 py-1 rounded bg-[color:var(--state-warning)]/10 text-amber-300 border border-[color:var(--state-warning)]/30 hover:bg-[color:var(--state-warning)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Zero today's counter (UTC)"
                          >
                            {isBusy ? "…" : "Reset quota"}
                          </button>
                        )}
                        {(t.status === "CONNECTED" ||
                          t.brevoSenderEmail !== null) && (
                          <button
                            onClick={() => handleDisconnect(t)}
                            disabled={isBusy}
                            className="text-xs px-2 py-1 rounded bg-[color:var(--visual-accent-rose-500)]/10 text-rose-300 border border-rose-500/30 hover:bg-[color:var(--visual-accent-rose-500)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Clear Brevo credential + sender identity"
                          >
                            {isBusy ? "…" : "Disconnect"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Sending routing is{" "}
        <strong className="text-zinc-300">tenant credential → master key → blocked</strong>.
        Use the reset-quota button when an agent has burned through the daily
        cap by mistake; the counter rebuilds on the next successful send. All
        admin actions write to the platform audit log.
      </p>
    </AdminBrevoShell>
  );
}
