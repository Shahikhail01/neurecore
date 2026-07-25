"use client";

import { useEffect, useMemo, useState } from "react";
import AdminBrevoShell from "@/components/admin-brevo/AdminBrevoShell";
import { adminBrevoService } from "@/services/adminBrevo.service";
import { useAdminBrevo } from "@/hooks/useAdminBrevo";
import { toast } from "sonner";
import type {
  AdminBrevoSuppressionRow,
  BrevoSuppressionReason,
} from "@/types/adminBrevo.types";
import { BREVO_SUPPRESSION_REASONS } from "@/types/adminBrevo.types";

const PAGE_SIZE = 50;

const REASON_BADGE: Record<BrevoSuppressionReason, string> = {
  BOUNCE_HARD: "bg-[color:var(--visual-accent-rose-500)]/10 text-rose-300 border-rose-500/30",
  UNSUBSCRIBE: "bg-zinc-700/50 text-zinc-300 border-zinc-700/50",
  ADMIN_BLOCK: "bg-[color:var(--accent-500)]/10 text-violet-300 border-violet-500/30",
  SPAM_COMPLAINT: "bg-rose-700/10 text-rose-200 border-rose-700/30",
  MANUAL: "bg-[color:var(--accent-500)]/10 text-indigo-300 border-[color:var(--accent-500)]/30",
};

export default function AdminBrevoSuppressionsPage() {
  const { tenants, stats, refresh } = useAdminBrevo();
  const [reason, setReason] = useState<BrevoSuppressionReason | "">("");
  const [tenantId, setTenantId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [offset, setOffset] = useState(0);

  const [rows, setRows] = useState<AdminBrevoSuppressionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<{
    email: string;
    reason: BrevoSuppressionReason;
    tenantId: string | ""; // '' = global
  }>({ email: "", reason: "ADMIN_BLOCK", tenantId: "" });
  const [saving, setSaving] = useState(false);

  const paramsKey = useMemo(
    () => JSON.stringify({ reason, tenantId, email, offset }),
    [reason, tenantId, email, offset],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    adminBrevoService
      .listSuppressions({
        email: email || undefined,
        reason: reason || undefined,
        tenantId: tenantId === "" ? undefined : tenantId,
        limit: PAGE_SIZE,
        offset,
      })
      .then((r) => {
        setRows(r.rows);
        setTotal(r.total);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError")
          setError((err as Error).message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [paramsKey, reason, tenantId, email, offset]);

  async function handleRemove(id: string, rowEmail: string) {
    if (!confirm(`Remove suppression for ${rowEmail}?`)) return;
    try {
      const r = await adminBrevoService.removeSuppression(id);
      if (r.deleted) {
        toast.success(`Removed ${rowEmail}`);
      } else {
        toast.info(`${rowEmail} was already removed`);
      }
      // Re-fetch
      const refresh = await adminBrevoService.listSuppressions({
        email: email || undefined,
        reason: reason || undefined,
        tenantId: tenantId === "" ? undefined : tenantId,
        limit: PAGE_SIZE,
        offset,
      });
      setRows(refresh.rows);
      setTotal(refresh.total);
      void refresh;
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleAdd() {
    if (!draft.email || !/.+@.+\..+/.test(draft.email)) {
      toast.error("A valid email is required");
      return;
    }
    try {
      setSaving(true);
      const r = await adminBrevoService.addSuppression({
        email: draft.email,
        reason: draft.reason,
        tenantId:
          draft.tenantId === "" ? null : (draft.tenantId as string | null),
        details: { source: "admin-dashboard" },
      });
      toast.success(
        r.created
          ? `Added ${draft.email} to the suppression list`
          : `Existing entry upgraded`,
      );
      setAddOpen(false);
      setDraft({ email: "", reason: "ADMIN_BLOCK", tenantId: "" });
      const refresh = await adminBrevoService.listSuppressions({
        email: email || undefined,
        reason: reason || undefined,
        tenantId: tenantId === "" ? undefined : tenantId,
        limit: PAGE_SIZE,
        offset,
      });
      setRows(refresh.rows);
      setTotal(refresh.total);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminBrevoShell subtitle="Hard-bounce + unsubscribe + admin-blocked email addresses. Sending is skipped to known-suppressed recipients.">
      {/* ── Aggregate ribbon ─────────────────────────────────── */}
      {stats?.suppressions && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Ribbon
            label="Total suppressed"
            value={stats.suppressions.total}
            tone="neutral"
          />
          {BREVO_SUPPRESSION_REASONS.map((r) => (
            <Ribbon
              key={r}
              label={r.replace("_", " ").toLowerCase()}
              value={stats.suppressions.byReason[r] ?? 0}
              tone={
                r === "BOUNCE_HARD" || r === "SPAM_COMPLAINT"
                  ? "bad"
                  : r === "UNSUBSCRIBE"
                    ? "neutral"
                    : "warn"
              }
            />
          ))}
        </div>
      )}

      {/* ── Filters + Add ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <div className="grow min-w-[180px]">
          <label className="block text-[11px] uppercase text-zinc-500 mb-1">
            Email contains
          </label>
          <input
            type="search"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setOffset(0);
            }}
            placeholder="alice@…"
            className="w-full rounded-lg bg-zinc-900/40 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="grow min-w-[180px]">
          <label className="block text-[11px] uppercase text-zinc-500 mb-1">
            Reason
          </label>
          <select
            value={reason}
            onChange={(e) => {
              setReason(e.target.value as BrevoSuppressionReason | "");
              setOffset(0);
            }}
            className="w-full rounded-lg bg-zinc-900/40 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All reasons</option>
            {BREVO_SUPPRESSION_REASONS.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="grow min-w-[180px]">
          <label className="block text-[11px] uppercase text-zinc-500 mb-1">
            Tenant
          </label>
          <select
            value={tenantId}
            onChange={(e) => {
              setTenantId(e.target.value);
              setOffset(0);
            }}
            className="w-full rounded-lg bg-zinc-900/40 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All tenants (incl. global)</option>
            <option value="null">Global (no tenant)</option>
            {tenants.map((t) => (
              <option key={t.tenantId} value={t.tenantId}>
                {t.tenantName}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="ml-auto px-4 py-2 text-sm rounded-lg bg-[color:var(--accent-500)]/20 text-indigo-200 border border-[color:var(--accent-500)]/30 hover:bg-[color:var(--accent-500)]/30"
        >
          + Add suppression
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-rose-500/30 bg-[color:var(--visual-accent-rose-500)]/10 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left font-medium px-4 py-3">Email</th>
              <th className="text-left font-medium px-4 py-3">Reason</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                Tenant
              </th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">
                Added by
              </th>
              <th className="text-left font-medium px-4 py-3">Added</th>
              <th className="text-right font-medium px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {loading && rows.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 w-24 bg-zinc-800 rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-zinc-500"
                >
                  No suppressions match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="text-zinc-200 hover:bg-zinc-900/60"
                >
                  <td className="px-4 py-3 font-mono text-xs">{row.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        REASON_BADGE[row.reason]
                      }`}
                    >
                      {row.reason.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-zinc-400 font-mono">
                    {row.tenantId ?? (
                      <span className="text-zinc-500">global</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-zinc-400">
                    {row.addedBy ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 font-mono whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(row.id, row.email)}
                      className="text-xs px-2 py-1 rounded bg-[color:var(--visual-accent-rose-500)]/10 text-rose-300 border border-rose-500/30 hover:bg-[color:var(--visual-accent-rose-500)]/20"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-4 text-xs text-zinc-400">
        <p>
          Showing {rows.length === 0 ? 0 : offset + 1}–{offset + rows.length}{" "}
          of {total}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="px-3 py-1.5 rounded border border-zinc-800 bg-zinc-900/40 text-zinc-300 disabled:opacity-40"
          >
            ← Prev
          </button>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + rows.length >= total}
            className="px-3 py-1.5 rounded border border-zinc-800 bg-zinc-900/40 text-zinc-300 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      {/* ── Add modal (simple inline) ─────────────────────── */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h2 className="text-sm font-medium text-zinc-200 mb-3">
              Add suppression
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-[11px] uppercase text-zinc-500 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, email: e.target.value }))
                  }
                  placeholder="user@domain.com"
                  className="w-full rounded-lg bg-zinc-900/40 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase text-zinc-500 mb-1">
                  Reason
                </label>
                <select
                  value={draft.reason}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      reason: e.target.value as BrevoSuppressionReason,
                    }))
                  }
                  className="w-full rounded-lg bg-zinc-900/40 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {BREVO_SUPPRESSION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase text-zinc-500 mb-1">
                  Tenant (leave blank for global)
                </label>
                <select
                  value={draft.tenantId}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, tenantId: e.target.value }))
                  }
                  className="w-full rounded-lg bg-zinc-900/40 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Global (no tenant)</option>
                  {tenants.map((t) => (
                    <option key={t.tenantId} value={t.tenantId}>
                      {t.tenantName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setAddOpen(false)}
                className="px-3 py-2 text-xs rounded border border-zinc-800 bg-zinc-900/40 text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAdd()}
                disabled={saving}
                className="ml-auto px-4 py-2 text-xs rounded bg-[color:var(--accent-500)]/20 text-indigo-200 border border-[color:var(--accent-500)]/30 disabled:opacity-50"
              >
                {saving ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
      <button onClick={() => void refresh()} className="hidden" aria-hidden />
    </AdminBrevoShell>
  );
}

function Ribbon({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "good" | "warn" | "bad";
}) {
  const cls =
    tone === "bad"
      ? "border-rose-500/30"
      : tone === "warn"
        ? "border-[color:var(--state-warning)]/30"
        : tone === "good"
          ? "border-[color:var(--state-success)]/30"
          : "border-zinc-700/50";
  return (
    <div className={`rounded-lg border bg-zinc-900/40 p-3 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-zinc-100 font-mono">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
