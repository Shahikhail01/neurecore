"use client";

import { useEffect, useMemo, useState } from "react";
import AdminBrevoShell from "@/components/admin-brevo/AdminBrevoShell";
import { EventTypeBadge } from "@/components/admin-brevo/BrevoAdminPrimitives";
import { adminBrevoService } from "@/services/adminBrevo.service";
import { useAdminBrevo } from "@/hooks/useAdminBrevo";
import type {
  AdminBrevoWebhookEvent,
  BrevoWebhookEventType,
} from "@/types/adminBrevo.types";

const ALL_EVENT_TYPES: BrevoWebhookEventType[] = [
  "DELIVERED",
  "OPEN",
  "CLICK",
  "BOUNCE_HARD",
  "BOUNCE_SOFT",
  "SPAM",
  "UNSUBSCRIBE",
  "BLOCKED",
  "ERROR",
  "REQUEST",
];

const PAGE_SIZE = 50;

export default function AdminBrevoEventsPage() {
  const { tenants } = useAdminBrevo();
  const [eventType, setEventType] = useState<BrevoWebhookEventType | "">("");
  const [tenantId, setTenantId] = useState<string>("");
  const [messageId, setMessageId] = useState<string>("");
  const [offset, setOffset] = useState(0);

  const [rows, setRows] = useState<AdminBrevoWebhookEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = useMemo(
    () => JSON.stringify({ eventType, tenantId, messageId, offset }),
    [eventType, tenantId, messageId, offset],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    adminBrevoService
      .listEvents({
        eventType: eventType || undefined,
        tenantId: tenantId || undefined,
        messageId: messageId || undefined,
        limit: PAGE_SIZE,
        offset,
      })
      .then((r) => {
        setRows(r.rows);
        setTotal(r.total);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [paramsKey, eventType, tenantId, messageId, offset]);

  function clear() {
    setEventType("");
    setTenantId("");
    setMessageId("");
    setOffset(0);
  }

  return (
    <AdminBrevoShell subtitle="Webhook delivery events (DELIVERED, OPEN, CLICK, BOUNCE, SPAM, etc). Filter by tenant, type, or message id.">
      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label htmlFor="brevo-events-tenant" className="block text-[11px] uppercase text-zinc-500 mb-1">
            Tenant
          </label>
          <select
            id="brevo-events-tenant"
            value={tenantId}
            onChange={(e) => {
              setTenantId(e.target.value);
              setOffset(0);
            }}
            className="w-full rounded-lg bg-zinc-900/40 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All tenants</option>
            {tenants.map((t) => (
              <option key={t.tenantId} value={t.tenantId}>
                {t.tenantName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="brevo-events-type" className="block text-[11px] uppercase text-zinc-500 mb-1">
            Event type
          </label>
          <select
            id="brevo-events-type"
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value as BrevoWebhookEventType | "");
              setOffset(0);
            }}
            className="w-full rounded-lg bg-zinc-900/40 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All events</option>
            {ALL_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="brevo-events-messageid" className="block text-[11px] uppercase text-zinc-500 mb-1">
            Message ID
          </label>
          <input
            id="brevo-events-messageid"
            type="search"
            value={messageId}
            onChange={(e) => {
              setMessageId(e.target.value);
              setOffset(0);
            }}
            placeholder="e.g. &lt;m-abc@brevo&gt;"
            className="w-full rounded-lg bg-zinc-900/40 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={clear}
            className="w-full px-3 py-2 text-xs rounded border border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700"
          >
            Clear filters
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-rose-500/30 bg-[color:var(--visual-accent-rose-500)]/10 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left font-medium px-4 py-3">Type</th>
              <th className="text-left font-medium px-4 py-3">Recipient</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                Tenant
              </th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                Message
              </th>
              <th className="text-left font-medium px-4 py-3">Received</th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">
                Reason
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {loading && rows.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
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
                  No events match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((e) => {
                const reason =
                  (e.payload as { reason?: string }).reason ?? null;
                return (
                  <tr key={e.id} className="text-zinc-200 hover:bg-zinc-900/60">
                    <td className="px-4 py-3">
                      <EventTypeBadge type={e.eventType} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{e.email}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-zinc-400">
                      {e.tenantId ?? "—"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-zinc-400 truncate max-w-[16rem]">
                      {e.messageId ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400 font-mono whitespace-nowrap">
                      {new Date(e.receivedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-zinc-400 truncate max-w-[20rem]">
                      {reason ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────── */}
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
    </AdminBrevoShell>
  );
}
