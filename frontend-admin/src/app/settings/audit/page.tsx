"use client";

import { useState, useEffect } from "react";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import type {
  AuditLog,
  AuditLevel,
  AuditCategory,
} from "@/types/settings.types";
import { motion } from "framer-motion";

const LEVEL_COLORS: Record<AuditLevel, string> = {
  info: "bg-[color:var(--state-info)] text-blue-300",
  warning: "bg-yellow-900 text-yellow-300",
  error: "bg-[color:var(--state-danger)] text-red-300",
  critical: "bg-purple-900 text-purple-300",
};

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  authentication: "Authentication",
  authorization: "Authorization",
  user_management: "User Management",
  tenant_management: "Tenant Management",
  tier_management: "Tier Management",
  billing: "Billing",
  ai_providers: "AI Providers",
  email: "Email",
  settings: "Settings",
  api_access: "API Access",
  data_export: "Data Export",
  security: "Security",
};

const LEVELS: AuditLevel[] = ["info", "warning", "error", "critical"];
const CATEGORIES: AuditCategory[] = [
  "authentication",
  "authorization",
  "user_management",
  "tenant_management",
  "tier_management",
  "billing",
  "ai_providers",
  "email",
  "settings",
  "api_access",
  "data_export",
  "security",
];

export default function AuditLogsPage() {
  const {
    logs,
    total,
    page,
    loading,
    error,
    summary,
    refresh,
    loadMore,
    exportLogs,
  } = useAuditLogs();

  const safeLogs = Array.isArray(logs) ? logs : [];
  const safeTotal = typeof total === "number" ? total : 0;
  const safeSummary = summary ?? null;

  const [filters, setFilters] = useState({
    level: "" as AuditLevel | "",
    category: "" as AuditCategory | "",
    search: "",
  });
  const [exporting, setExporting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    void refresh(
      filters.level || filters.category || filters.search
        ? {
            level: filters.level || undefined,
            category: filters.category || undefined,
            search: filters.search || undefined,
          }
        : {},
    );
  }, [filters.level, filters.category, filters.search]);

  async function handleExport(format: "csv" | "json" | "pdf") {
    setExporting(true);
    try {
      await exportLogs(format);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Audit Logs</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Track all platform activity and changes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">{total} total</span>
          <div className="relative group">
            <button
              disabled={exporting}
              className="px-4 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
            >
              {exporting ? "Exporting..." : "Export"}
            </button>
            <div className="absolute right-0 mt-2 w-40 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-10">
              <button
                onClick={() => handleExport("csv")}
                className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 rounded-t-lg"
              >
                Export CSV
              </button>
              <button
                onClick={() => handleExport("json")}
                className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Export JSON
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 rounded-b-lg"
              >
                Export PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {/* Summary Cards */}
      {safeSummary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="text-2xl font-bold text-zinc-100">
              {safeSummary.total}
            </div>
            <div className="text-xs text-zinc-500">Total Events</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="text-2xl font-bold text-blue-300">
              {safeSummary.byLevel.info}
            </div>
            <div className="text-xs text-zinc-500">Info</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="text-2xl font-bold text-red-300">
              {safeSummary.byLevel.error + safeSummary.byLevel.critical}
            </div>
            <div className="text-xs text-zinc-500">Errors</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="text-2xl font-bold text-yellow-300">
              {safeSummary.byLevel.warning}
            </div>
            <div className="text-xs text-zinc-500">Warnings</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="search"
            placeholder="Search logs..."
            aria-label="Search logs"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))
            }
            className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[color:var(--accent-500)]"
          />
        </div>
        <select
          aria-label="Level filter"
          value={filters.level}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              level: e.target.value as AuditLevel | "",
            }))
          }
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"
        >
          <option value="">All Levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </option>
          ))}
        </select>
        <select
          aria-label="Category filter"
          value={filters.category}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              category: e.target.value as AuditCategory | "",
            }))
          }
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Timestamp</th>
              <th className="px-4 py-3 text-left">Level</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Actor</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Resource</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading && safeLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Loading...
                </td>
              </tr>
            ) : safeLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No logs found
                </td>
              </tr>
            ) : (
              safeLogs.map((log) => (
                <motion.tr
                  key={log.id}
                  role="button"
                  tabIndex={0}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-zinc-900/50 transition cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedLog(log); } }}
                >
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_COLORS[log.level]}`}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {CATEGORY_LABELS[log.category]}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    <div className="font-medium">{log.actorEmail}</div>
                    <div className="text-xs text-zinc-500">{log.actorRole}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{log.action}</td>
                  <td className="px-4 py-3 text-zinc-400 truncate max-w-[200px]">
                    {log.resource}
                    {log.resourceId && (
                      <span className="text-zinc-600"> ({log.resourceId})</span>
                    )}
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>

        {/* Load More */}
        {safeLogs.length > 0 && safeLogs.length < safeTotal && (
          <div className="p-4 border-t border-zinc-800 text-center">
            <button
              onClick={() => loadMore()}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-50"
            >
              Load More
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          role="button"
          tabIndex={0}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setSelectedLog(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setSelectedLog(null); } }}
        >
          <motion.div
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            role="button"
            tabIndex={0}
            className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); } }}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-100">
                Log Details
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-zinc-500">Timestamp</div>
                  <div className="text-sm text-zinc-200">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Level</div>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_COLORS[selectedLog.level]}`}
                  >
                    {selectedLog.level}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Category</div>
                  <div className="text-sm text-zinc-200">
                    {CATEGORY_LABELS[selectedLog.category]}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Action</div>
                  <div className="text-sm text-zinc-200">
                    {selectedLog.action}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-zinc-500">Actor</div>
                <div className="text-sm text-zinc-200">
                  {selectedLog.actorEmail}
                </div>
                <div className="text-xs text-zinc-500">
                  Role: {selectedLog.actorRole}
                </div>
              </div>

              <div>
                <div className="text-xs text-zinc-500">Resource</div>
                <div className="text-sm text-zinc-200">
                  {selectedLog.resource}
                </div>
                {selectedLog.resourceId && (
                  <div className="text-xs text-zinc-500">
                    ID: {selectedLog.resourceId}
                  </div>
                )}
              </div>

              {selectedLog.changes && selectedLog.changes.length > 0 && (
                <div>
                  <div className="text-xs text-zinc-500 mb-2">Changes</div>
                  <div className="space-y-2">
                    {selectedLog.changes.map((change, i) => (
                      <div key={i} className="p-2 rounded bg-zinc-800 text-xs">
                        <div className="font-medium text-zinc-300">
                          {change.field}
                        </div>
                        <div className="text-[color:var(--state-danger)] line-through">
                          {JSON.stringify(change.oldValue)}
                        </div>
                        <div className="text-[color:var(--state-success)]">
                          → {JSON.stringify(change.newValue)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedLog.details &&
                Object.keys(selectedLog.details).length > 0 && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-2">
                      Additional Details
                    </div>
                    <pre className="p-2 rounded bg-zinc-800 text-xs text-zinc-300 overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
                <div>
                  <div className="text-xs text-zinc-500">IP Address</div>
                  <div className="text-sm text-zinc-400">
                    {selectedLog.ipAddress}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">User Agent</div>
                  <div className="text-xs text-zinc-400 truncate">
                    {selectedLog.userAgent}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
