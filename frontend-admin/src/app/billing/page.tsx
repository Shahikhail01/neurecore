"use client";

import { useState, useEffect, useCallback } from "react";
import AdminShell from "@/components/AdminShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { KpiTile } from "@/components/kpi/KpiTile";
import { BarChart } from "@/components/charts/BarChart";
import { AreaChart } from "@/components/charts/AreaChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { usePlatformKpis } from "@/hooks/usePlatformKpis";
import { usePlatformChartData } from "@/hooks/usePlatformChartData";
import { useTimeRange } from "@/hooks/useTimeRange";
import { adminMetricsService } from "@/services/admin-metrics.service";
import { financeService, type Invoice } from "@/services/finance.service";
import type { BarDataPoint } from "@/types/ui.types";

const RANGE_OPTIONS = [
  { label: "24 h", value: "24h" as const },
  { label: "7 d", value: "7d" as const },
  { label: "30 d", value: "30d" as const },
];

const PLAN_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#22c55e"];

export default function BillingPage() {
  const user = useAdminAuth();
  const isPlatformViewer =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "PLATFORM_ADMIN" ||
    user?.role === "SECURITY_OFFICER" ||
    user?.role === "SUPPORT";
  const { kpis, loading: kpisLoading } = usePlatformKpis();
  const { range, setRange } = useTimeRange();
  const { data: costData, loading: costLoading } = usePlatformChartData(
    "cost",
    range,
  );

  const [tenantCosts, setTenantCosts] = useState<BarDataPoint[]>([]);
  const [costsLoading, setCostsLoading] = useState(true);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const result = await financeService.listInvoices({
        page: 1,
        limit: 10,
        ...(isPlatformViewer ? { scope: "platform" as const } : {}),
      });
      setInvoices(result?.data ?? []);
    } catch {
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, [isPlatformViewer]);

  const fetchCosts = useCallback(async () => {
    setCostsLoading(true);
    try {
      const data = await adminMetricsService.getTenantCostBreakdown();
      setTenantCosts(data);
    } catch {
      setTenantCosts([]);
    } finally {
      setCostsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCosts();
  }, [fetchCosts]);
  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  const planDistribution = [
    { name: "Enterprise", value: 4, color: PLAN_COLORS[0] },
    { name: "Business", value: 8, color: PLAN_COLORS[1] },
    { name: "Starter", value: 12, color: PLAN_COLORS[2] },
    { name: "Trial", value: 6, color: PLAN_COLORS[3] },
  ];

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Billing</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Platform revenue and cost analytics
            </p>
          </div>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-2.5 py-1 rounded-md text-xs transition ${range === opt.value ? "bg-indigo-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI tiles ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile
            label="Est. Revenue"
            value={kpis ? `$${kpis.revenueUsd.toFixed(0)}` : "—"}
            color="profit"
            loading={kpisLoading}
          />
          <KpiTile
            label="Platform Cost"
            value={kpis ? `$${kpis.totalCostUsd.toFixed(0)}` : "—"}
            color="risk"
            loading={kpisLoading}
          />
          <KpiTile
            label="Gross Margin"
            value={
              kpis
                ? `${Math.round(((kpis.revenueUsd - kpis.totalCostUsd) / kpis.revenueUsd) * 100)}%`
                : "—"
            }
            color="ops"
            loading={kpisLoading}
          />
          <KpiTile
            label="Active Tenants"
            value={kpis?.activeTenants ?? "—"}
            color="strategy"
            loading={kpisLoading}
          />
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">
              Cost Trend
            </h3>
            <AreaChart
              data={costData}
              dataKey="value"
              xKey="timestamp"
              color="#22c55e"
              loading={costLoading}
              height={200}
            />
          </div>
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">
              Plan Distribution
            </h3>
            <DonutChart
              data={planDistribution}
              nameKey="name"
              valueKey="value"
              loading={false}
              height={200}
            />
          </div>
        </div>

        {/* Cost per tenant */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">
            Cost by Tenant (USD)
          </h3>
          <BarChart
            data={tenantCosts}
            dataKey="value"
            xKey="label"
            loading={costsLoading}
            height={220}
          />
        </div>

        {/* Billing table */}
        <div className="rounded-xl border border-surface-border bg-surface-raised">
          <div className="px-4 py-3 border-b border-surface-border">
            <h3 className="text-sm font-semibold text-zinc-200">
              Recent Invoices
            </h3>
          </div>
          <div className="p-4 overflow-x-auto">
            {invoicesLoading ? (
              <div className="py-8 text-center text-zinc-500 text-sm">
                Loading…
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-sm">
                No invoices found.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="text-zinc-500">
                  <tr className="text-left">
                    <th className="py-2 pr-4">Number</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-200">
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-t border-surface-border/60"
                    >
                      <td className="py-2 pr-4 font-mono text-xs text-zinc-300">
                        {inv.number}
                      </td>
                      <td className="py-2 pr-4">{inv.status}</td>
                      <td className="py-2 pr-4">
                        ${Number(inv.total).toFixed(2)}
                      </td>
                      <td className="py-2 pr-4">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 flex gap-2">
                        <button
                          className="px-2 py-1 text-xs rounded border border-surface-border text-zinc-300 hover:text-white"
                          disabled={inv.status !== "DRAFT"}
                          onClick={async () => {
                            await financeService.issueInvoice(
                              inv.id,
                              inv.tenantId,
                            );
                            await fetchInvoices();
                          }}
                        >
                          Issue
                        </button>
                        <button
                          className="px-2 py-1 text-xs rounded border border-surface-border text-zinc-300 hover:text-white"
                          disabled={inv.status !== "ISSUED"}
                          onClick={async () => {
                            await financeService.markPaid(inv.id, inv.tenantId);
                            await fetchInvoices();
                          }}
                        >
                          Mark Paid
                        </button>
                        <button
                          className="px-2 py-1 text-xs rounded border border-surface-border text-zinc-300 hover:text-white"
                          disabled={
                            inv.status === "CANCELLED" || inv.status === "PAID"
                          }
                          onClick={async () => {
                            await financeService.cancelInvoice(
                              inv.id,
                              inv.tenantId,
                            );
                            await fetchInvoices();
                          }}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
