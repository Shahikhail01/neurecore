"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import api from "@/services/api";
import { unwrapList } from "@/services/unwrap";
import type { Tenant } from "@/types/api.types";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-900 text-green-300",
  SUSPENDED: "bg-yellow-900 text-yellow-300",
  CANCELLED: "bg-red-900 text-red-300",
  TRIAL: "bg-blue-900 text-blue-300",
};

interface TierTrackedResource {
  deployedFromTierId?: string | null;
}

interface TenantDeploymentSummary {
  tierLinkedAgents: number;
  tierLinkedDepartments: number;
  driftedAgents: number;
  driftedDepartments: number;
}

export default function TenantsPage() {
  const user = useAdminAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [deploymentSummaries, setDeploymentSummaries] = useState<
    Record<string, TenantDeploymentSummary>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/tenants", {
        params: { page, limit, search: search || undefined },
      });
      setTenants(unwrapList(res).items);
      setTotal(unwrapList(res).total ?? 0);
    } catch {
      setError("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;

    async function loadDeploymentSummaries() {
      if (tenants.length === 0) {
        setDeploymentSummaries({});
        return;
      }

      setLoadingSummaries(true);
      const entries = await Promise.all(
        tenants.map(async (tenant) => {
          try {
            const [agentsRes, departmentsRes] = await Promise.all([
              api.get("/agents", {
                params: { tenantId: tenant.id, limit: 100 },
              }),
              api.get("/departments", {
                params: { tenantId: tenant.id, limit: 100 },
              }),
            ]);
            const agents = unwrapList(agentsRes).items as TierTrackedResource[];
            const departments = unwrapList(departmentsRes)
              .items as TierTrackedResource[];
            const currentTierId = tenant.tier?.id;
            const tierLinkedAgents = agents.filter((agent) =>
              Boolean(agent.deployedFromTierId),
            ).length;
            const tierLinkedDepartments = departments.filter((department) =>
              Boolean(department.deployedFromTierId),
            ).length;
            const driftedAgents = agents.filter((agent) =>
              Boolean(
                currentTierId &&
                agent.deployedFromTierId &&
                agent.deployedFromTierId !== currentTierId,
              ),
            ).length;
            const driftedDepartments = departments.filter((department) =>
              Boolean(
                currentTierId &&
                department.deployedFromTierId &&
                department.deployedFromTierId !== currentTierId,
              ),
            ).length;

            return [
              tenant.id,
              {
                tierLinkedAgents,
                tierLinkedDepartments,
                driftedAgents,
                driftedDepartments,
              },
            ] as const;
          } catch {
            return [
              tenant.id,
              {
                tierLinkedAgents: 0,
                tierLinkedDepartments: 0,
                driftedAgents: 0,
                driftedDepartments: 0,
              },
            ] as const;
          }
        }),
      );

      if (!cancelled) {
        setDeploymentSummaries(Object.fromEntries(entries));
        setLoadingSummaries(false);
      }
    }

    void loadDeploymentSummaries();

    return () => {
      cancelled = true;
    };
  }, [tenants]);

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tenants</h1>
        <span className="text-sm text-gray-400">{total} total</span>
      </div>

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search tenants…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full max-w-sm rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-950 border border-red-800 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Max Agents</th>
              <th className="px-4 py-3 text-left">Deployment</th>
              <th className="px-4 py-3 text-left">Drift</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : tenants.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No tenants found
                </td>
              </tr>
            ) : (
              tenants.map((tenant) => {
                const summary = deploymentSummaries[tenant.id];

                return (
                  <tr key={tenant.id} className="hover:bg-gray-900 transition">
                    <td className="px-4 py-3 font-medium">{tenant.name}</td>
                    <td className="px-4 py-3 text-gray-400">{tenant.slug}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-100">
                        {tenant.tier?.name ?? "Unassigned"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {tenant.tier?.slug ?? "no-tier"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[tenant.status] ?? "bg-gray-800 text-gray-300"}`}
                      >
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tenant.tier?.maxAgents ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {loadingSummaries && !summary ? (
                        <span className="text-gray-500">Loading…</span>
                      ) : (
                        <>
                          <div>Agents: {summary?.tierLinkedAgents ?? 0}</div>
                          <div>
                            Departments: {summary?.tierLinkedDepartments ?? 0}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {loadingSummaries && !summary ? (
                        <span className="text-gray-500">Loading…</span>
                      ) : (
                        <>
                          <div>Agents: {summary?.driftedAgents ?? 0}</div>
                          <div>
                            Departments: {summary?.driftedDepartments ?? 0}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3 text-xs">
                        <Link
                          href={`/tenants/${tenant.id}`}
                          className="text-indigo-400 hover:text-indigo-300 hover:underline transition"
                        >
                          Change Tier
                        </Link>
                        <Link
                          href={`/tenants/${tenant.id}`}
                          className="text-gray-400 hover:text-gray-200 hover:underline transition"
                        >
                          View →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="mt-4 flex items-center gap-2 justify-end">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded px-3 py-1.5 text-sm border border-gray-700 disabled:opacity-40 hover:bg-gray-800 transition"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * limit >= total}
            className="rounded px-3 py-1.5 text-sm border border-gray-700 disabled:opacity-40 hover:bg-gray-800 transition"
          >
            Next
          </button>
        </div>
      )}
    </AdminShell>
  );
}
