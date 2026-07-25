"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import api, { apiCall } from "@/services/api";

interface TenantGoogleStatus {
  tenantId: string;
  tenantName: string;
  connected: boolean;
  email?: string;
  scopes?: string[];
  agentCount: number;
  driveFolderCount: number;
}

interface GlobalGoogleStats {
  totalTenants: number;
  connectedTenants: number;
  totalAgentsWithDrive: number;
  scopeCoverage: Record<string, number>;
}

export default function AdminIntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [revokingTenantId, setRevokingTenantId] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantGoogleStatus[]>([]);
  const [stats, setStats] = useState<GlobalGoogleStats | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall(() =>
        api.get<{ tenants: TenantGoogleStatus[]; stats: GlobalGoogleStats }>(
          "/integrations/google/platform-status",
        ),
      );
      setTenants(result.tenants ?? []);
      setStats(result.stats ?? null);
    } catch (err) {
      setError("Failed to load integration status");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRevoke = async (tenant: TenantGoogleStatus) => {
    if (
      !confirm(
        `Revoke Google Workspace for "${tenant.tenantName}"? This will log every Google call for the tenant's agents and force them to re-consent. The action is recorded in the audit log.`,
      )
    ) {
      return;
    }
    try {
      setRevokingTenantId(tenant.tenantId);
      await apiCall(() =>
        api.post(`/integrations/admin/google/${tenant.tenantId}/disconnect`),
      );
      setSuccessMessage(`Revoked Google for ${tenant.tenantName}.`);
      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to revoke Google for ${tenant.tenantName}.`,
      );
      console.error(err);
    } finally {
      setRevokingTenantId(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const scopeLabels: Record<string, string> = {
    gmail: "📧 Gmail",
    drive: "📁 Drive",
    calendar: "📅 Calendar",
    spreadsheets: "📊 Sheets",
  };

  const getScopeKey = (scope: string): string => {
    if (scope.includes("gmail")) return "gmail";
    if (scope.includes("drive")) return "drive";
    if (scope.includes("calendar")) return "calendar";
    if (scope.includes("spreadsheets")) return "spreadsheets";
    return scope;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-zinc-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-zinc-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && tenants.length === 0) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {error && (
        <div className="bg-[color:var(--state-danger)]/10 border border-[color:var(--state-danger)]/20 rounded-lg p-3 text-sm text-[color:var(--state-danger)]">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}
      {successMessage && (
        <div className="bg-[color:var(--state-success)]/10 border border-[color:var(--state-success)]/20 rounded-lg p-3 text-sm text-[color:var(--state-success)]">
          {successMessage}
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-2 underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Google Workspace</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Monitor Google Workspace connections and Drive usage across all tenants.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4"
          >
            <p className="text-xs text-zinc-500 mb-1">Connected Tenants</p>
            <p className="text-2xl font-bold text-zinc-100">
              {stats.connectedTenants}
              <span className="text-sm font-normal text-zinc-500 ml-1">
                / {stats.totalTenants}
              </span>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4"
          >
            <p className="text-xs text-zinc-500 mb-1">Agents with Drive</p>
            <p className="text-2xl font-bold text-zinc-100">
              {stats.totalAgentsWithDrive}
            </p>
          </motion.div>

          {Object.entries(stats.scopeCoverage ?? {}).map(
            ([scope, count], idx) => (
              <motion.div
                key={scope}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4"
              >
                <p className="text-xs text-zinc-500 mb-1">
                  {scopeLabels[scope] ?? scope}
                </p>
                <p className="text-2xl font-bold text-zinc-100">{count}</p>
              </motion.div>
            ),
          )}
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-zinc-300 mb-3">
          Tenant Connections
        </h2>
        {tenants.length === 0 ? (
          <div className="bg-zinc-800/30 border border-zinc-800 rounded-lg p-6 text-center">
            <p className="text-zinc-500 text-sm">
              No tenants have connected Google Workspace yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tenants.map((tenant, idx) => (
              <motion.div
                key={tenant.tenantId}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-zinc-800/30 border border-zinc-700/30 rounded-lg p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        tenant.connected ? "bg-[color:var(--state-success)]" : "bg-zinc-600"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">
                        {tenant.tenantName}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {tenant.tenantId}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    {tenant.connected && tenant.scopes && (
                      <div className="hidden md:flex items-center gap-1.5">
                        {tenant.scopes.map((s) => {
                          const key = getScopeKey(s);
                          return (
                            <span
                              key={s}
                              className="text-xs px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400"
                              title={s}
                            >
                              {scopeLabels[key] ?? key}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span title="Agents with Drive folders">
                        🤖 {tenant.agentCount}
                      </span>
                      <span title="Drive folders">
                        📁 {tenant.driveFolderCount}
                      </span>
                    </div>

                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        tenant.connected
                          ? "bg-[color:var(--state-success)]/10 text-[color:var(--state-success)] border border-[color:var(--state-success)]/20"
                          : "bg-zinc-700/50 text-zinc-500 border border-zinc-700/50"
                      }`}
                    >
                      {tenant.connected ? "Connected" : "Not Connected"}
                    </span>

                    {tenant.connected && (
                      <button
                        onClick={() => handleRevoke(tenant)}
                        disabled={revokingTenantId === tenant.tenantId}
                        className="text-xs px-2 py-1 rounded bg-[color:var(--state-danger)]/10 text-[color:var(--state-danger)] border border-[color:var(--state-danger)]/20 hover:bg-[color:var(--state-danger)]/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        title="Phase 3 (G7) admin override — audited"
                      >
                        {revokingTenantId === tenant.tenantId
                          ? "Revoking…"
                          : "Revoke"}
                      </button>
                    )}
                  </div>
                </div>

                {tenant.connected && tenant.email && (
                  <div className="mt-2 text-xs text-zinc-500 ml-6">
                    {tenant.email}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-zinc-800/20 border border-zinc-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-2">
          Google OAuth Configuration
        </h3>
        <p className="text-xs text-zinc-500">
          OAuth is configured via <code className="text-zinc-400">GOOGLE_CLIENT_ID</code> and{" "}
          <code className="text-zinc-400">GOOGLE_CLIENT_SECRET</code> environment
          variables. The callback URL is{" "}
          <code className="text-zinc-400">
            /api/v1/integrations/google/callback
          </code>{" "}
          which must be registered in the Google Cloud Console under Authorized
          redirect URIs.
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          Requested scopes: Gmail (read/send), Drive, Calendar, Google Sheets.
          Tenants manage their own connections from the tenant dashboard.
        </p>
      </div>
    </div>
  );
}
