"use client";

import AdminBrevoShell from "@/components/admin-brevo/AdminBrevoShell";
import { KpiCard } from "@/components/admin-brevo/BrevoAdminPrimitives";
import { useAdminBrevo } from "@/hooks/useAdminBrevo";

export default function AdminBrevoSettingsPage() {
  const { loading, error, stats, health, refresh } = useAdminBrevo();

  if (loading && !stats) {
    return (
      <AdminBrevoShell subtitle="Loading platform Brevo configuration…">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-zinc-800/40 animate-pulse" />
          ))}
        </div>
      </AdminBrevoShell>
    );
  }
  if (!stats) return null;

  return (
    <AdminBrevoShell subtitle="Display of platform-level Brevo configuration. Sensitive values are never returned over the wire; only presence + status are shown.">
      {error && (
        <div className="mb-4 p-3 rounded-lg border border-rose-500/30 bg-[color:var(--visual-accent-rose-500)]/10 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* ── Environment summary ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <KpiCard
          label="Master API key"
          value={stats.masterKeyConfigured ? "Configured" : "Missing"}
          tone={stats.masterKeyConfigured ? "good" : "bad"}
          icon="🔑"
          hint={
            <span>
              <code className="text-zinc-400">BREVO_MASTER_API_KEY</code> as
              fallback for tenants without their own key
            </span>
          }
        />
        <KpiCard
          label="Webhook secret"
          value={stats.webhookSecretConfigured ? "Configured" : "Missing"}
          tone={stats.webhookSecretConfigured ? "good" : "bad"}
          icon="🪝"
          hint={
            <span>
              Required to validate Brevo-signed events at{" "}
              <code className="text-zinc-400">
                /api/v1/integrations/brevo/webhook
              </code>
            </span>
          }
        />
        <KpiCard
          label="Default daily limit"
          value={stats.globalDailyLimit.toLocaleString()}
          tone="neutral"
          icon="📊"
          hint={
            <span>
              <code className="text-zinc-400">BREVO_DAILY_LIMIT</code> applies
              to per-tenant counters
            </span>
          }
        />
      </div>

      {/* ── Sender identity ────────────────────────────────── */}
      <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 mb-6">
        <h2 className="text-sm font-medium text-zinc-200 mb-3">
          Global sender identity
        </h2>
        <p className="text-xs text-zinc-500 mb-4">
          Used when a tenant has no per-tenant sender configured. Each tenant
          may override these values via{" "}
          <code className="text-zinc-400">
            PUT /integrations/brevo/sender
          </code>
          .
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <Field
            label="EMAIL_FROM_ADDRESS"
            value={stats.globalFromAddress || "— not set —"}
            tone={!stats.globalFromAddress ? "bad" : "neutral"}
          />
          <Field
            label="EMAIL_FROM_NAME"
            value={stats.globalFromName || "—"}
          />
          <Field
            label="EMAIL_REPLY_TO"
            value={stats.globalReplyTo || "— not set —"}
          />
        </div>
      </section>

      {/* ── Brevo account probe ──────────────────────────── */}
      {health && (
        <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-medium text-zinc-200">
                Brevo account (master key)
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Probed {new Date(health.fetchedAt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => void refresh()}
              className="text-xs text-[color:var(--accent-400)] hover:underline"
            >
              Re-probe
            </button>
          </div>

          {health.ok && health.account ? (
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
              {Object.entries(health.account)
                .slice(0, 12)
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded bg-zinc-900/60 border border-zinc-800 p-2"
                  >
                    <dt className="text-zinc-500 uppercase text-[10px] tracking-wider">
                      {k}
                    </dt>
                    <dd className="font-mono text-zinc-200 mt-1 break-words">
                      {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </dd>
                  </div>
                ))}
            </dl>
          ) : (
            <div className="mt-3 p-3 rounded border border-rose-500/30 bg-[color:var(--visual-accent-rose-500)]/10 text-xs text-rose-200">
              {health.error ?? "Brevo account unreachable"}
            </div>
          )}
        </section>
      )}

      {/* ── Webhook config ─────────────────────────────── */}
      <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 mb-6">
        <h2 className="text-sm font-medium text-zinc-200 mb-3">
          Webhook configuration
        </h2>
        <p className="text-xs text-zinc-500 mb-3">
          Configure these in the Brevo dashboard →{" "}
          <em>Transactional → Settings → Webhooks</em>:
        </p>
        <ul className="text-xs text-zinc-400 space-y-2 list-disc pl-4">
          <li>
            <strong className="text-zinc-200">Webhook URL:</strong>{" "}
            <code className="text-zinc-300">
              https://&lt;host&gt;/api/v1/integrations/brevo/webhook
            </code>
          </li>
          <li>
            <strong className="text-zinc-200">Events:</strong> delivered, open,
            click, hardBounce, softBounce, spam, unsubscribe, blocked, error,
            request
          </li>
          <li>
            <strong className="text-zinc-200">Signing secret:</strong>{" "}
            Provided by Brevo. Save it as{" "}
            <code className="text-zinc-300">BREVO_WEBHOOK_SECRET</code>.
            When set, Brevo's HMAC-SHA256 signature is verified using{" "}
            <code className="text-zinc-300">timingSafeEqual</code>.
          </li>
          <li>
            <strong className="text-zinc-200">Tenant routing:</strong> Use the
            Brevo send-tag{" "}
            <code className="text-zinc-300">&lt;tenantId&gt;:&lt;label&gt;</code>{" "}
            so BrevoWebhookService can resolve the receiving tenant.
          </li>
        </ul>
      </section>

      {/* ── Operation quick reference ───────────────────── */}
      <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-medium text-zinc-200 mb-3">
          CLI / API quick reference
        </h2>
        <ul className="text-xs text-zinc-400 space-y-2 list-disc pl-4">
          <li>
            <code className="text-zinc-300">
              pnpm run brevo:bootstrap -- &lt;tenantId&gt;
            </code>{" "}
            — seed Brevo credential for one tenant using the master key.
          </li>
          <li>
            <code className="text-zinc-300">
              pnpm run brevo:bootstrap -- --all
            </code>{" "}
            — seed Brevo credential for every tenant missing one.
          </li>
          <li>
            <code className="text-zinc-300">
              bash scripts/brevo-smoke.sh &lt;base&gt; &lt;auth&gt; &lt;email&gt;
            </code>{" "}
            — 4-step smoke test (validate, quota, test-send, quota after).
          </li>
          <li>
            <code className="text-zinc-300">
              POST /integrations/admin/brevo/tenants/:tenantId/disconnect
            </code>{" "}
            — revokes credential + clears sender identity (audited).
          </li>
          <li>
            <code className="text-zinc-300">
              POST /integrations/admin/brevo/tenants/:tenantId/reset-quota
            </code>{" "}
            — clears today's usage counter for a runaway tenant.
          </li>
        </ul>
      </section>
    </AdminBrevoShell>
  );
}

function Field({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "bad";
}) {
  return (
    <div className="rounded bg-zinc-900/60 border border-zinc-800 p-3">
      <p className="text-[11px] uppercase text-zinc-500 tracking-wider mb-1">
        {label}
      </p>
      <p
        className={`font-mono ${
          tone === "bad" ? "text-rose-300" : "text-zinc-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
