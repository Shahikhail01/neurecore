"use client";

/**
 * /tenants/[id]
 *
 * Tenant detail view with four tabs:
 *   Overview  — basic info + quick stats
 *   Departments — departments already deployed for this tenant
 *   Agents      — agents currently running for this tenant
 *   Deploy      — tier bootstrap preview and execution for the tenant's active tier
 */

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AdminShell from "@/components/AdminShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import api from "@/services/api";
import { unwrapItem, unwrapList } from "@/services/unwrap";
import {
  tierCompositionService,
  type TierBootstrapResult,
  type TierChangePreview,
  type TierDeploymentPreview,
} from "@/services/tierComposition.service";
import type { Tenant } from "@/types/api.types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Department {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  templateId?: string | null;
  tierDepartmentPoolId?: string | null;
  deployedFromTierId?: string | null;
  isFixed?: boolean;
  isSelected?: boolean;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  model: string;
  status: string;
  createdAt: string;
  templateId?: string | null;
  tierAgentPoolId?: string | null;
  deployedFromTierId?: string | null;
  isFixed?: boolean;
  isSelected?: boolean;
}
interface TierOption {
  id: string;
  name: string;
  slug: string;
  maxAgents: number;
  isDefault?: boolean;
}

interface TierTrackedResource {
  templateId?: string | null;
  deployedFromTierId?: string | null;
  isFixed?: boolean;
  isSelected?: boolean;
}

type Tab = "overview" | "departments" | "agents" | "deploy";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "departments", label: "Departments" },
  { id: "agents", label: "Agents" },
  { id: "deploy", label: "Deploy" },
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-900/70 text-green-300",
  TRIAL: "bg-blue-900/70 text-blue-300",
  SUSPENDED: "bg-yellow-900/70 text-yellow-300",
  CANCELLED: "bg-red-900/70 text-red-300",
};

const AGENT_TYPE_BADGE: Record<string, string> = {
  EXECUTIVE: "bg-purple-900/70 text-purple-300",
  CORE: "bg-indigo-900/70 text-indigo-300",
  FUNCTIONAL: "bg-teal-900/70 text-teal-300",
  META: "bg-orange-900/70 text-orange-300",
};

function hasTierLineage(resource: TierTrackedResource) {
  return Boolean(resource.deployedFromTierId);
}

function hasTemplateLineage(resource: TierTrackedResource) {
  return Boolean(resource.templateId);
}

function isDriftedFromTier(
  resource: TierTrackedResource,
  currentTierId?: string,
) {
  return Boolean(
    resource.deployedFromTierId &&
    currentTierId &&
    resource.deployedFromTierId !== currentTierId,
  );
}

function getDeploymentBadge(resource: TierTrackedResource) {
  if (hasTierLineage(resource)) {
    if (resource.isFixed) {
      return {
        label: "Tier Fixed",
        className: "bg-indigo-950/70 text-indigo-300",
      };
    }
    if (resource.isSelected) {
      return {
        label: "Tier Selected",
        className: "bg-sky-950/70 text-sky-300",
      };
    }
    return { label: "Tier Optional", className: "bg-zinc-800 text-zinc-300" };
  }

  if (hasTemplateLineage(resource)) {
    return {
      label: "Template Deploy",
      className: "bg-emerald-950/70 text-emerald-300",
    };
  }

  return { label: "Manual", className: "bg-zinc-800 text-zinc-400" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tenantId } = use(params);
  const router = useRouter();
  const user = useAdminAuth();

  const [tab, setTab] = useState<Tab>("overview");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [tiers, setTiers] = useState<TierOption[]>([]);
  const [loadingTiers, setLoadingTiers] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [tierPreview, setTierPreview] = useState<TierChangePreview | null>(
    null,
  );
  const [tierPreviewLoading, setTierPreviewLoading] = useState(false);
  const [tierPreviewError, setTierPreviewError] = useState<string | null>(null);
  const [changingTier, setChangingTier] = useState(false);

  // departments + agents lists
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const [deployPreview, setDeployPreview] =
    useState<TierDeploymentPreview | null>(null);
  const [deployPreviewLoading, setDeployPreviewLoading] = useState(false);
  const [deployPreviewError, setDeployPreviewError] = useState<string | null>(
    null,
  );
  const [bootstrappingTier, setBootstrappingTier] = useState(false);
  const [bootstrapResult, setBootstrapResult] =
    useState<TierBootstrapResult | null>(null);

  // ─── Fetch tenant ──────────────────────────────────────────────────────────

  const loadTenant = useCallback(async () => {
    setLoadingTenant(true);
    try {
      const res = await api.get(`/tenants/${tenantId}`);
      const nextTenant = unwrapItem(res) as Tenant;
      setTenant(nextTenant);
      setSelectedTierId(nextTenant?.tier?.id ?? "");
    } catch {
      // not found
    } finally {
      setLoadingTenant(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadTenant();
  }, [loadTenant]);

  useEffect(() => {
    (async () => {
      setLoadingTiers(true);
      try {
        const res = await api.get("/tiers");
        setTiers(unwrapList(res).items as TierOption[]);
      } finally {
        setLoadingTiers(false);
      }
    })();
  }, []);

  // ─── Tab-specific fetch ────────────────────────────────────────────────────

  const loadDepts = useCallback(async () => {
    if (!tenantId) return;
    setLoadingDepts(true);
    try {
      const res = await api.get(`/departments?tenantId=${tenantId}&limit=100`);
      setDepartments(unwrapList(res).items as Department[]);
    } finally {
      setLoadingDepts(false);
    }
  }, [tenantId]);

  const loadAgents = useCallback(async () => {
    if (!tenantId) return;
    setLoadingAgents(true);
    try {
      const res = await api.get(`/agents?tenantId=${tenantId}&limit=100`);
      setAgents(unwrapList(res).items as Agent[]);
    } finally {
      setLoadingAgents(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadDepts();
    void loadAgents();
  }, [loadDepts, loadAgents]);

  useEffect(() => {
    if (tab === "departments" && departments.length === 0) void loadDepts();
    if (tab === "agents" && agents.length === 0) void loadAgents();
    if (
      tab === "deploy" &&
      tenant?.tier?.id &&
      !deployPreview &&
      !deployPreviewLoading
    ) {
      void handlePreviewTierBootstrap();
    }
  }, [
    tab,
    departments.length,
    agents.length,
    loadDepts,
    loadAgents,
    tenant?.tier?.id,
    deployPreview,
    deployPreviewLoading,
  ]);

  async function handlePreviewTierChange() {
    if (!tenant || !selectedTierId) return;
    setTierPreviewLoading(true);
    setTierPreviewError(null);
    try {
      const preview = await tierCompositionService.previewTenantTierDeployment(
        tenant.id,
        selectedTierId,
      );
      setTierPreview(preview);
    } catch (err: unknown) {
      setTierPreviewError(
        err instanceof Error ? err.message : "Preview failed",
      );
      setTierPreview(null);
    } finally {
      setTierPreviewLoading(false);
    }
  }

  async function handleChangeTier() {
    if (!tenant || !selectedTierId) return;
    setChangingTier(true);
    setTierPreviewError(null);
    try {
      await api.patch(`/tenants/${tenant.id}/change-tier`, {
        tierId: selectedTierId,
      });
      setDeployPreview(null);
      setBootstrapResult(null);
      await Promise.all([loadTenant(), loadDepts(), loadAgents()]);
      await handlePreviewTierChange();
    } catch (err: unknown) {
      setTierPreviewError(
        err instanceof Error ? err.message : "Tier change failed",
      );
    } finally {
      setChangingTier(false);
    }
  }

  async function handlePreviewTierBootstrap() {
    if (!tenant?.tier?.id) return;
    setDeployPreviewLoading(true);
    setDeployPreviewError(null);
    try {
      const preview = await tierCompositionService.previewTenantTierDeployment(
        tenant.id,
        tenant.tier.id,
      );
      setDeployPreview(preview);
    } catch (err: unknown) {
      setDeployPreviewError(
        err instanceof Error ? err.message : "Bootstrap preview failed",
      );
      setDeployPreview(null);
    } finally {
      setDeployPreviewLoading(false);
    }
  }

  async function handleBootstrapCurrentTier() {
    if (!tenant?.tier?.id) return;
    setBootstrappingTier(true);
    setDeployPreviewError(null);
    try {
      const result = await tierCompositionService.bootstrapTenantTier(
        tenant.id,
        tenant.tier.id,
      );
      setBootstrapResult(result);
      await Promise.all([loadTenant(), loadDepts(), loadAgents()]);
      const preview = await tierCompositionService.previewTenantTierDeployment(
        tenant.id,
        tenant.tier.id,
      );
      setDeployPreview(preview);
    } catch (err: unknown) {
      setDeployPreviewError(
        err instanceof Error ? err.message : "Tier bootstrap failed",
      );
    } finally {
      setBootstrappingTier(false);
    }
  }

  useEffect(() => {
    setDeployPreview(null);
    setDeployPreviewError(null);
    setBootstrapResult(null);
  }, [tenant?.tier?.id]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const currentTierId = tenant?.tier?.id;
  const deployedAgentCount = agents.filter(hasTierLineage).length;
  const deployedDepartmentCount = departments.filter(hasTierLineage).length;
  const driftedAgentCount = agents.filter((agent) =>
    isDriftedFromTier(agent, currentTierId),
  ).length;
  const driftedDepartmentCount = departments.filter((department) =>
    isDriftedFromTier(department, currentTierId),
  ).length;

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* ── Back link + Header ── */}
        <button
          onClick={() => router.push("/tenants")}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1"
        >
          ← All Tenants
        </button>

        {loadingTenant ? (
          <div className="h-20 rounded-xl bg-surface-raised animate-pulse" />
        ) : tenant ? (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-5 flex flex-wrap gap-6 items-start">
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">
                {tenant.name}
              </h1>
              <div className="text-sm text-zinc-500 mt-0.5 font-mono">
                {tenant.slug}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center ml-auto">
              <Stat label="Tier" value={tenant.tier?.name ?? "Unassigned"} />
              <Stat
                label="Max Agents"
                value={String(tenant.tier?.maxAgents ?? 0)}
              />
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[tenant.status] ?? "bg-zinc-800 text-zinc-400"}`}
              >
                {tenant.status}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-zinc-500">
            Tenant not found.
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-1 border-b border-surface-border/50">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                tab === t.id
                  ? "border-indigo-500 text-indigo-300"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ══ Overview ══ */}
          {tab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {tenant && (
                <>
                  <StatCard label="ID" value={tenant.id.slice(0, 8) + "…"} />
                  <StatCard
                    label="Tier"
                    value={tenant.tier?.name ?? "Unassigned"}
                  />
                  <StatCard
                    label="Max Agents"
                    value={String(tenant.tier?.maxAgents ?? 0)}
                  />
                  <StatCard
                    label="Created"
                    value={new Date(tenant.createdAt).toLocaleDateString()}
                  />
                  <div className="col-span-2 md:col-span-4 rounded-xl border border-surface-border bg-surface-raised p-4">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-zinc-100">
                          Deployment Status
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          Current tenant resources linked to the active tier and
                          any drift that needs review.
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <StatCard
                        label="Tier-linked Agents"
                        value={String(deployedAgentCount)}
                      />
                      <StatCard
                        label="Tier-linked Departments"
                        value={String(deployedDepartmentCount)}
                      />
                      <StatCard
                        label="Drifted Agents"
                        value={String(driftedAgentCount)}
                      />
                      <StatCard
                        label="Drifted Departments"
                        value={String(driftedDepartmentCount)}
                      />
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-4 rounded-xl border border-surface-border bg-surface-raised p-4 space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">
                        Change Tier
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Preview compatibility and deployment impact before
                        applying a tier change.
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <select
                        value={selectedTierId}
                        onChange={(e) => {
                          setSelectedTierId(e.target.value);
                          setTierPreview(null);
                          setTierPreviewError(null);
                        }}
                        disabled={loadingTiers}
                        className="min-w-[260px] rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Select target tier</option>
                        {tiers.map((tier) => (
                          <option key={tier.id} value={tier.id}>
                            {tier.name} ({tier.maxAgents} agents)
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={handlePreviewTierChange}
                          disabled={!selectedTierId || tierPreviewLoading}
                          className="rounded-lg border border-surface-border px-4 py-2 text-sm text-zinc-300 hover:bg-surface-overlay transition disabled:opacity-40"
                        >
                          {tierPreviewLoading
                            ? "Previewing…"
                            : "Preview Change"}
                        </button>
                        <button
                          onClick={handleChangeTier}
                          disabled={
                            !selectedTierId ||
                            selectedTierId === tenant.tier?.id ||
                            changingTier
                          }
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition disabled:opacity-40"
                        >
                          {changingTier ? "Applying…" : "Apply Tier"}
                        </button>
                      </div>
                    </div>

                    {tierPreviewError && (
                      <div className="rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
                        {tierPreviewError}
                      </div>
                    )}

                    {tierPreview && (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-lg border border-surface-border bg-surface-overlay p-4">
                          <div className="text-xs text-zinc-500">
                            Compatibility
                          </div>
                          <div
                            className={`mt-1 text-sm font-medium ${tierPreview.compatibility.canChange ? "text-emerald-300" : "text-red-300"}`}
                          >
                            {tierPreview.compatibility.canChange
                              ? "Tier change allowed"
                              : "Tier change blocked"}
                          </div>
                          <div className="mt-2 text-xs text-zinc-500">
                            Selected agents: {tierPreview.usage.selectedAgents}{" "}
                            / {tierPreview.targetTier.maxAgents}
                          </div>
                          {!tierPreview.compatibility.canChange &&
                            tierPreview.compatibility.blockingReasons.length >
                              0 && (
                              <div className="mt-3 text-sm text-red-300">
                                {tierPreview.compatibility.blockingReasons.join(
                                  " ",
                                )}
                              </div>
                            )}
                        </div>
                        <div className="rounded-lg border border-surface-border bg-surface-overlay p-4 space-y-3">
                          <PreviewList
                            title="Would Provision"
                            emptyMessage="No fixed templates would be added."
                            items={[
                              ...tierPreview.impact.agentsToProvision.map(
                                (item) => item.templateName,
                              ),
                              ...tierPreview.impact.departmentsToProvision.map(
                                (item) => item.templateName,
                              ),
                            ]}
                          />
                          <PreviewList
                            title="Outside Policy"
                            emptyMessage="No tier-linked resources would fall out of policy."
                            items={[
                              ...tierPreview.impact.tierLinkedAgentsOutsideTargetPolicy.map(
                                (item) => item.name,
                              ),
                              ...tierPreview.impact.tierLinkedDepartmentsOutsideTargetPolicy.map(
                                (item) => item.name,
                              ),
                            ]}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ══ Departments ══ */}
          {tab === "departments" && (
            <motion.div
              key="departments"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {loadingDepts ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-12 rounded-lg bg-surface-raised animate-pulse"
                    />
                  ))}
                </div>
              ) : departments.length === 0 ? (
                <Empty
                  message="No departments yet."
                  action="Provision From Tier"
                  onAction={() => setTab("deploy")}
                />
              ) : (
                <div className="rounded-xl border border-surface-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border bg-surface-raised">
                        <Th>Name</Th>
                        <Th>Description</Th>
                        <Th>Deployment</Th>
                        <Th>Drift</Th>
                        <Th>Created</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((d, i) => (
                        <tr
                          key={d.id}
                          className={`border-b border-surface-border/50 hover:bg-surface-raised/50 transition ${i % 2 === 0 ? "" : "bg-surface-overlay/20"}`}
                        >
                          <Td className="font-medium text-zinc-200">
                            {d.name}
                          </Td>
                          <Td className="text-zinc-500">
                            {d.description ?? "—"}
                          </Td>
                          <Td>
                            <ResourceBadge {...getDeploymentBadge(d)} />
                          </Td>
                          <Td>
                            {isDriftedFromTier(d, currentTierId) ? (
                              <ResourceBadge
                                label="Out of Current Tier"
                                className="bg-amber-950/70 text-amber-300"
                              />
                            ) : (
                              <span className="text-xs text-zinc-500">
                                Aligned
                              </span>
                            )}
                          </Td>
                          <Td className="text-zinc-600 text-xs">
                            {new Date(d.createdAt).toLocaleDateString()}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* ══ Agents ══ */}
          {tab === "agents" && (
            <motion.div
              key="agents"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {loadingAgents ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-12 rounded-lg bg-surface-raised animate-pulse"
                    />
                  ))}
                </div>
              ) : agents.length === 0 ? (
                <Empty
                  message="No agents deployed."
                  action="Provision From Tier"
                  onAction={() => setTab("deploy")}
                />
              ) : (
                <div className="rounded-xl border border-surface-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border bg-surface-raised">
                        <Th>Name</Th>
                        <Th>Type</Th>
                        <Th>Model</Th>
                        <Th>Status</Th>
                        <Th>Deployment</Th>
                        <Th>Drift</Th>
                        <Th>Created</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((a, i) => (
                        <tr
                          key={a.id}
                          className={`border-b border-surface-border/50 hover:bg-surface-raised/50 transition ${i % 2 === 0 ? "" : "bg-surface-overlay/20"}`}
                        >
                          <Td className="font-medium text-zinc-200">
                            {a.name}
                          </Td>
                          <Td>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${AGENT_TYPE_BADGE[a.type] ?? "bg-zinc-800 text-zinc-400"}`}
                            >
                              {a.type}
                            </span>
                          </Td>
                          <Td className="text-zinc-400 text-xs font-mono">
                            {a.model}
                          </Td>
                          <Td className="text-zinc-400 text-xs capitalize">
                            {a.status}
                          </Td>
                          <Td>
                            <ResourceBadge {...getDeploymentBadge(a)} />
                          </Td>
                          <Td>
                            {isDriftedFromTier(a, currentTierId) ? (
                              <ResourceBadge
                                label="Out of Current Tier"
                                className="bg-amber-950/70 text-amber-300"
                              />
                            ) : (
                              <span className="text-xs text-zinc-500">
                                Aligned
                              </span>
                            )}
                          </Td>
                          <Td className="text-zinc-600 text-xs">
                            {new Date(a.createdAt).toLocaleDateString()}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* ══ Deploy ══ */}
          {tab === "deploy" && (
            <motion.div
              key="deploy"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <DeployCard
                title="Bootstrap Tier Resources"
                subtitle="Preview and apply the active tier's department and agent composition for this tenant. Matching resources are reused, missing required resources are created, and tier-linked drift is surfaced before execution."
              >
                {!tenant?.tier ? (
                  <div className="rounded-lg border border-surface-border bg-surface-overlay px-4 py-5 text-sm text-zinc-400">
                    Assign a tier before bootstrapping tenant resources.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-3 mb-4">
                      <StatCard label="Active Tier" value={tenant.tier.name} />
                      <StatCard
                        label="Selected Agents"
                        value={String(
                          deployPreview?.usage.selectedAgents ?? agents.length,
                        )}
                      />
                      <StatCard
                        label="Selected Departments"
                        value={String(
                          deployPreview?.usage.selectedDepartments ??
                            departments.length,
                        )}
                      />
                    </div>

                    {bootstrapResult && (
                      <SuccessBox>
                        Provisioned{" "}
                        <strong>
                          {bootstrapResult.departmentsProvisioned}
                        </strong>{" "}
                        departments and{" "}
                        <strong>{bootstrapResult.agentsProvisioned}</strong>{" "}
                        agents. Reused{" "}
                        <strong>{bootstrapResult.departmentsReused}</strong>{" "}
                        departments and{" "}
                        <strong>{bootstrapResult.agentsReused}</strong> agents.
                        <button
                          onClick={() => setBootstrapResult(null)}
                          className="mt-3 text-xs text-indigo-400 hover:underline block"
                        >
                          Dismiss
                        </button>
                      </SuccessBox>
                    )}

                    {deployPreviewError && (
                      <ErrorBox>{deployPreviewError}</ErrorBox>
                    )}

                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        onClick={() => void handlePreviewTierBootstrap()}
                        disabled={deployPreviewLoading}
                        className="rounded-lg border border-surface-border px-4 py-2 text-sm text-zinc-300 hover:bg-surface-overlay transition disabled:opacity-40"
                      >
                        {deployPreviewLoading
                          ? "Previewing…"
                          : "Refresh Preview"}
                      </button>
                      <button
                        onClick={() => void handleBootstrapCurrentTier()}
                        disabled={
                          bootstrappingTier ||
                          (deployPreview
                            ? !deployPreview.compatibility.canChange
                            : false)
                        }
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition disabled:opacity-40"
                      >
                        {bootstrappingTier ? "Applying…" : "Apply Bootstrap"}
                      </button>
                    </div>

                    {deployPreview ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-lg border border-surface-border bg-surface-overlay p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wide">
                            Compatibility
                          </div>
                          <div
                            className={`mt-1 text-sm font-medium ${deployPreview.compatibility.canChange ? "text-emerald-300" : "text-red-300"}`}
                          >
                            {deployPreview.compatibility.canChange
                              ? "Tier bootstrap allowed"
                              : "Tier bootstrap blocked"}
                          </div>
                          <div className="mt-2 text-xs text-zinc-500">
                            Selected agents:{" "}
                            {deployPreview.usage.selectedAgents} /{" "}
                            {deployPreview.targetTier.maxAgents}
                          </div>
                          {!deployPreview.compatibility.canChange &&
                            deployPreview.compatibility.blockingReasons.length >
                              0 && (
                              <div className="mt-3 text-sm text-red-300">
                                {deployPreview.compatibility.blockingReasons.join(
                                  " ",
                                )}
                              </div>
                            )}
                        </div>
                        <div className="rounded-lg border border-surface-border bg-surface-overlay p-4 space-y-3">
                          <PreviewList
                            title="Would Provision"
                            emptyMessage="No new tier resources would be created."
                            items={[
                              ...deployPreview.impact.agentsToProvision.map(
                                (item) =>
                                  `${item.templateName} (${item.slotType})`,
                              ),
                              ...deployPreview.impact.departmentsToProvision.map(
                                (item) =>
                                  `${item.templateName} (${item.slotType})`,
                              ),
                            ]}
                          />
                          <PreviewList
                            title="Would Reuse"
                            emptyMessage="No existing resources would be relinked."
                            items={[
                              ...deployPreview.impact.reusableAgents.map(
                                (item) => item.name,
                              ),
                              ...deployPreview.impact.reusableDepartments.map(
                                (item) => item.name,
                              ),
                            ]}
                          />
                          <PreviewList
                            title="Outside Policy"
                            emptyMessage="No tier-linked resources would fall out of policy."
                            items={[
                              ...deployPreview.impact.tierLinkedAgentsOutsideTargetPolicy.map(
                                (item) => item.name,
                              ),
                              ...deployPreview.impact.tierLinkedDepartmentsOutsideTargetPolicy.map(
                                (item) => item.name,
                              ),
                            ]}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-surface-border bg-surface-overlay px-4 py-5 text-sm text-zinc-400">
                        Build a preview to see which resources will be created,
                        reused, or deselected.
                      </div>
                    )}
                  </>
                )}
              </DeployCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminShell>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-sm font-medium text-zinc-200">{value}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-lg font-semibold text-zinc-100 truncate">
        {value}
      </div>
    </div>
  );
}

function PreviewList({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: string[];
  emptyMessage: string;
}) {
  return (
    <div>
      <div className="text-xs text-zinc-500 uppercase tracking-wide">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="mt-1 text-sm text-zinc-500">{emptyMessage}</div>
      ) : (
        <div className="mt-2 space-y-1">
          {items.map((item) => (
            <div
              key={item}
              className="rounded border border-surface-border/70 px-2 py-1 text-sm text-zinc-300"
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceBadge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function Empty({
  message,
  action,
  onAction,
}: {
  message: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="py-16 text-center text-zinc-500 text-sm">
      {message}{" "}
      <button onClick={onAction} className="text-indigo-400 hover:underline">
        {action}
      </button>
    </div>
  );
}

function DeployCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-5 flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="text-xs text-zinc-500 mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

function SuccessBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-green-950 border border-green-800 px-4 py-5 text-sm text-green-300 text-center">
      <div className="text-2xl mb-2">✓</div>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300 mb-3">
      {children}
    </div>
  );
}
