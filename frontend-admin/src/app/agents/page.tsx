"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import api from "@/services/api";
import {
  tierCompositionService,
  type TenantListItem,
  type TierAgentPoolSlot,
} from "@/services/tierComposition.service";
import { unwrapList } from "@/services/unwrap";

interface AgentRow {
  id: string;
  tenantId: string;
  departmentId?: string | null;
  tierAgentPoolId?: string | null;
  templateId?: string | null;
  deployedFromTierId?: string | null;
  name: string;
  description?: string | null;
  type: string;
  status: string;
  model?: string | null;
  budgetPerDay?: number | null;
  isFixed?: boolean;
  isSelected?: boolean;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    tierId?: string | null;
    tier?: {
      id: string;
      name: string;
      slug: string;
      maxAgents: number;
    };
  };
  department?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    tasks: number;
  };
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface AgentFormState {
  tenantId: string;
  name: string;
  description: string;
  type: string;
  status: string;
  model: string;
  budgetPerDay: string;
  departmentId: string;
  tierAgentPoolId: string;
  isSelected: boolean;
}

type AgentWizardStepId =
  | "tenant"
  | "identity"
  | "runtime"
  | "assignment"
  | "review";

type StatusFilter = "ALL" | "ACTIVE" | "IDLE" | "RUNNING" | "PAUSED" | "ERROR";
type LineageFilter = "ALL" | "TIER" | "TEMPLATE" | "MANUAL";

const PAGE_SIZE = 50;
const STATUS_FILTERS: StatusFilter[] = [
  "ALL",
  "ACTIVE",
  "IDLE",
  "RUNNING",
  "PAUSED",
  "ERROR",
];
const STATUS_OPTIONS = ["ACTIVE", "IDLE", "RUNNING", "PAUSED", "ERROR"];
const AGENT_TYPES = ["EXECUTIVE", "CORE", "FUNCTIONAL", "META"];
const AGENT_WIZARD_STEPS: Array<{
  id: AgentWizardStepId;
  label: string;
  description: string;
}> = [
  {
    id: "tenant",
    label: "Tenant",
    description:
      "Choose the tenant context and inherit its department and tier slot options.",
  },
  {
    id: "identity",
    label: "Identity",
    description:
      "Define the live agent identity, role classification, and purpose.",
  },
  {
    id: "runtime",
    label: "Runtime",
    description: "Set runtime model, status, and daily budget posture.",
  },
  {
    id: "assignment",
    label: "Assignment",
    description:
      "Connect the live agent to a department and optional tier lineage slot.",
  },
  {
    id: "review",
    label: "Review",
    description: "Validate the cross-tenant live agent setup before saving.",
  },
];

function createEmptyForm(tenantId = ""): AgentFormState {
  return {
    tenantId,
    name: "",
    description: "",
    type: "FUNCTIONAL",
    status: "IDLE",
    model: "gpt-4o-mini",
    budgetPerDay: "",
    departmentId: "",
    tierAgentPoolId: "",
    isSelected: true,
  };
}

function getLineageType(agent: AgentRow): LineageFilter {
  if (agent.deployedFromTierId) return "TIER";
  if (agent.templateId) return "TEMPLATE";
  return "MANUAL";
}

function getLineageBadge(agent: AgentRow) {
  if (agent.deployedFromTierId) {
    return {
      label: agent.isFixed ? "Tier Fixed" : "Tier Linked",
      className: agent.isFixed
        ? "bg-indigo-950/70 text-indigo-300"
        : "bg-sky-950/70 text-sky-300",
    };
  }

  if (agent.templateId) {
    return {
      label: "Template Deploy",
      className: "bg-emerald-950/70 text-emerald-300",
    };
  }

  return {
    label: "Manual",
    className: "bg-zinc-800 text-zinc-400",
  };
}

export default function AdminAgentFleetPage() {
  const user = useAdminAuth();

  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [filterDepartments, setFilterDepartments] = useState<
    DepartmentOption[]
  >([]);

  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [lineageFilter, setLineageFilter] = useState<LineageFilter>("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<AgentRow | null>(null);
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [formData, setFormData] = useState<AgentFormState>(createEmptyForm());
  const [formDepartments, setFormDepartments] = useState<DepartmentOption[]>(
    [],
  );
  const [formTierSlots, setFormTierSlots] = useState<TierAgentPoolSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const tierOptions = useMemo(() => {
    const seen = new Map<string, NonNullable<TenantListItem["tier"]>>();
    tenants.forEach((tenant) => {
      if (tenant.tier && !seen.has(tenant.tier.id)) {
        seen.set(tenant.tier.id, tenant.tier);
      }
    });
    return Array.from(seen.values());
  }, [tenants]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    agents.forEach((agent) => {
      counts[agent.status] = (counts[agent.status] ?? 0) + 1;
    });
    return counts;
  }, [agents]);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/agents", {
        params: {
          page,
          limit: PAGE_SIZE,
          tenantId: tenantFilter || undefined,
          scope: tenantFilter ? undefined : "platform",
          status: statusFilter === "ALL" ? undefined : statusFilter,
        },
      });
      const unwrapped = unwrapList(res);
      setAgents(unwrapped.items as AgentRow[]);
      setTotal(unwrapped.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, tenantFilter]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    (async () => {
      setLoadingTenants(true);
      try {
        setTenants(await tierCompositionService.listTenants(100));
      } finally {
        setLoadingTenants(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!tenantFilter) {
      setFilterDepartments([]);
      setDepartmentFilter("");
      return;
    }

    (async () => {
      try {
        const res = await api.get("/departments", {
          params: {
            tenantId: tenantFilter || undefined,
            scope: tenantFilter ? undefined : "platform",
          },
        });
        setFilterDepartments(unwrapList(res).items as DepartmentOption[]);
      } catch {
        setFilterDepartments([]);
      }
    })();
  }, [tenantFilter]);

  useEffect(() => {
    if (!modalOpen || !formData.tenantId) {
      setFormDepartments([]);
      setFormTierSlots([]);
      return;
    }

    const selectedTenant = tenants.find(
      (tenant) => tenant.id === formData.tenantId,
    );

    (async () => {
      try {
        const [deptRes, tierSlots] = await Promise.all([
          api.get("/departments", { params: { tenantId: formData.tenantId } }),
          selectedTenant?.tier?.id
            ? tierCompositionService.listAgentPool(selectedTenant.tier.id)
            : Promise.resolve([] as TierAgentPoolSlot[]),
        ]);
        setFormDepartments(unwrapList(deptRes).items as DepartmentOption[]);
        setFormTierSlots(tierSlots);
      } catch {
        setFormDepartments([]);
        setFormTierSlots([]);
      }
    })();
  }, [formData.tenantId, modalOpen, tenants]);

  const visibleAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchSearch =
        agent.name.toLowerCase().includes(search.toLowerCase()) ||
        (agent.tenant?.name ?? "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        (agent.department?.name ?? "")
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchTier = !tierFilter || agent.tenant?.tier?.id === tierFilter;
      const matchDepartment =
        !departmentFilter || agent.department?.id === departmentFilter;
      const matchLineage =
        lineageFilter === "ALL" || getLineageType(agent) === lineageFilter;
      return matchSearch && matchTier && matchDepartment && matchLineage;
    });
  }, [agents, departmentFilter, lineageFilter, search, tierFilter]);

  function openCreate() {
    setEditAgent(null);
    setWizardStepIndex(0);
    setFormData(createEmptyForm(tenantFilter));
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(agent: AgentRow) {
    setEditAgent(agent);
    setWizardStepIndex(0);
    setFormData({
      tenantId: agent.tenantId,
      name: agent.name,
      description: agent.description ?? "",
      type: agent.type,
      status: agent.status,
      model: agent.model ?? "gpt-4o-mini",
      budgetPerDay:
        agent.budgetPerDay !== undefined && agent.budgetPerDay !== null
          ? String(agent.budgetPerDay)
          : "",
      departmentId: agent.departmentId ?? "",
      tierAgentPoolId: agent.tierAgentPoolId ?? "",
      isSelected: agent.isSelected ?? true,
    });
    setSaveError(null);
    setModalOpen(true);
  }

  function validateWizardStep(stepIndex: number) {
    const step = AGENT_WIZARD_STEPS[stepIndex];

    if (step.id === "tenant" && !formData.tenantId) {
      setSaveError("Tenant is required");
      return false;
    }

    if (step.id === "identity" && !formData.name.trim()) {
      setSaveError("Agent name is required");
      return false;
    }

    if (
      step.id === "runtime" &&
      formData.budgetPerDay &&
      Number.isNaN(Number(formData.budgetPerDay))
    ) {
      setSaveError("Budget per day must be a valid number");
      return false;
    }

    setSaveError(null);
    return true;
  }

  function goToNextWizardStep() {
    if (!validateWizardStep(wizardStepIndex)) return;
    setWizardStepIndex((current) =>
      Math.min(current + 1, AGENT_WIZARD_STEPS.length - 1),
    );
  }

  function goToPreviousWizardStep() {
    setSaveError(null);
    setWizardStepIndex((current) => Math.max(current - 1, 0));
  }

  function buildAgentPayload() {
    return {
      tenantId: formData.tenantId,
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      type: formData.type,
      status: formData.status,
      model: formData.model.trim() || undefined,
      budgetPerDay: formData.budgetPerDay
        ? Number(formData.budgetPerDay)
        : undefined,
      departmentId: formData.departmentId || undefined,
      tierAgentPoolId: formData.tierAgentPoolId || undefined,
      isSelected: formData.isSelected,
    };
  }

  async function handleSave() {
    if (!formData.tenantId || !formData.name.trim()) {
      setSaveError("Tenant and name are required");
      return;
    }

    setSaving(true);
    setSaveError(null);

    const payload = buildAgentPayload();

    try {
      if (editAgent) {
        await api.patch(`/agents/${editAgent.id}`, payload, {
          params: { tenantId: editAgent.tenantId },
        });

        if (!formData.departmentId && editAgent.departmentId) {
          await api.post(
            `/agents/${editAgent.id}/unassign-department`,
            {},
            { params: { tenantId: formData.tenantId } },
          );
        }
      } else {
        await api.post("/agents", payload);
      }

      setModalOpen(false);
      await fetchAgents();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(agent: AgentRow) {
    try {
      await api.delete(`/agents/${agent.id}`, {
        params: { tenantId: agent.tenantId },
      });
      await fetchAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent");
    }
  }

  async function handleStatusToggle(agent: AgentRow) {
    try {
      await api.post(
        `/agents/${agent.id}/${agent.status === "PAUSED" ? "resume" : "pause"}`,
        {},
        { params: { tenantId: agent.tenantId } },
      );
      await fetchAgents();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update agent status",
      );
    }
  }

  if (!user) return null;

  const currentWizardStep = AGENT_WIZARD_STEPS[wizardStepIndex];
  const selectedTenant = tenants.find(
    (tenant) => tenant.id === formData.tenantId,
  );
  const selectedDepartment = formDepartments.find(
    (department) => department.id === formData.departmentId,
  );
  const selectedTierSlot = formTierSlots.find(
    (slot) => slot.id === formData.tierAgentPoolId,
  );

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Live Agents</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Manage live tenant agents across tenants, departments, and tier
              lineage.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void fetchAgents()}
              className="px-3 py-2 rounded-lg border border-surface-border text-sm text-zinc-300 hover:bg-surface-overlay transition"
            >
              Refresh
            </button>
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
            >
              + Add Agent
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents, tenants, or departments…"
            className="lg:col-span-2 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          <select
            value={tenantFilter}
            onChange={(e) => {
              setTenantFilter(e.target.value);
              setDepartmentFilter("");
              setPage(1);
            }}
            disabled={loadingTenants}
            className="rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200"
          >
            <option value="">All tenants</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200"
          >
            <option value="">All tiers</option>
            {tierOptions.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name}
              </option>
            ))}
          </select>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            disabled={!tenantFilter}
            className="rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
          >
            <option value="">All departments</option>
            {filterDepartments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <select
            value={lineageFilter}
            onChange={(e) => setLineageFilter(e.target.value as LineageFilter)}
            className="rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200"
          >
            <option value="ALL">All lineage</option>
            <option value="TIER">Tier linked</option>
            <option value="TEMPLATE">Template deployed</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                statusFilter === status
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay"
              }`}
            >
              {status}
              {status !== "ALL" && statusCounts[status] ? (
                <span className="ml-1 opacity-70">{statusCounts[status]}</span>
              ) : null}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-surface-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-raised">
                <Th>Name</Th>
                <Th>Tenant</Th>
                <Th>Tier</Th>
                <Th>Department</Th>
                <Th>Status</Th>
                <Th>Lineage</Th>
                <Th>Selected</Th>
                <Th>Tasks</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-zinc-500"
                  >
                    Loading agents...
                  </td>
                </tr>
              ) : visibleAgents.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-zinc-500"
                  >
                    No agents match the current filters.
                  </td>
                </tr>
              ) : (
                visibleAgents.map((agent, index) => {
                  const badge = getLineageBadge(agent);
                  return (
                    <tr
                      key={agent.id}
                      className={`border-b border-surface-border/50 hover:bg-surface-raised/50 transition ${
                        index % 2 === 0 ? "" : "bg-surface-overlay/20"
                      }`}
                    >
                      <Td>
                        <div className="font-medium text-zinc-100">
                          {agent.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {agent.type}
                        </div>
                      </Td>
                      <Td>
                        <div className="text-zinc-200">
                          {agent.tenant?.name ?? "Unknown"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {agent.tenant?.slug ?? "—"}
                        </div>
                      </Td>
                      <Td>
                        <div className="text-zinc-200">
                          {agent.tenant?.tier?.name ?? "No tier"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {agent.tenant?.tier?.slug ?? "—"}
                        </div>
                      </Td>
                      <Td className="text-zinc-400">
                        {agent.department?.name ?? "Unassigned"}
                      </Td>
                      <Td>
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
                          {agent.status}
                        </span>
                      </Td>
                      <Td>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </Td>
                      <Td className="text-zinc-400">
                        {agent.isSelected ? "Yes" : "No"}
                      </Td>
                      <Td className="text-zinc-400">
                        {agent._count?.tasks ?? 0}
                      </Td>
                      <Td className="text-zinc-500 text-xs">
                        {new Date(agent.createdAt).toLocaleDateString()}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openEdit(agent)}
                            className="rounded-lg border border-surface-border px-2 py-1 text-xs text-zinc-300 hover:bg-surface-overlay transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void handleStatusToggle(agent)}
                            className="rounded-lg border border-surface-border px-2 py-1 text-xs text-zinc-300 hover:bg-surface-overlay transition"
                          >
                            {agent.status === "PAUSED" ? "Resume" : "Pause"}
                          </button>
                          <button
                            onClick={() => void handleDelete(agent)}
                            className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-950/60 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-zinc-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((current) => current + 1)}
                disabled={page * PAGE_SIZE >= total}
                className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setModalOpen(false);
              }
            }}
          >
            <div className="w-full max-w-4xl rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    {editAgent ? "Edit Live Agent" : "Create Live Agent"}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {currentWizardStep.description}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-[0.24em] text-zinc-600">
                    Step {wizardStepIndex + 1} of {AGENT_WIZARD_STEPS.length}
                  </div>
                  <div className="mt-1 text-sm font-medium text-zinc-300">
                    {currentWizardStep.label}
                  </div>
                </div>
              </div>

              <div className="mb-6 grid gap-2 md:grid-cols-5">
                {AGENT_WIZARD_STEPS.map((step, index) => {
                  const isActive = index === wizardStepIndex;
                  const isComplete = index < wizardStepIndex;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        if (
                          index <= wizardStepIndex ||
                          validateWizardStep(wizardStepIndex)
                        ) {
                          setWizardStepIndex(index);
                        }
                      }}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        isActive
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-100"
                          : isComplete
                            ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-200"
                            : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-[0.24em]">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div className="mt-1 text-xs font-medium">
                        {step.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              {saveError && (
                <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
                  {saveError}
                </div>
              )}

              {currentWizardStep.id === "tenant" && (
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                    <Field label="Tenant">
                      <select
                        value={formData.tenantId}
                        onChange={(e) =>
                          setFormData((current) => ({
                            ...current,
                            tenantId: e.target.value,
                            departmentId: "",
                            tierAgentPoolId: "",
                          }))
                        }
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                      >
                        <option value="">Select tenant</option>
                        {tenants.map((tenant) => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
                    <div className="text-xs uppercase tracking-[0.24em] text-zinc-600">
                      Context
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-400">
                      {selectedTenant
                        ? `${selectedTenant.name} is on ${selectedTenant.tier?.name ?? "no tier"}. Department and tier-slot choices in later steps will load from this tenant.`
                        : "Select a tenant first. This wizard provisions a live agent directly into that tenant scope."}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {loadingTenants
                        ? "Loading tenant list..."
                        : `${tenants.length} tenants available`}
                    </div>
                  </div>
                </div>
              )}

              {currentWizardStep.id === "identity" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Name">
                    <input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          name: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                    />
                  </Field>
                  <Field label="Type">
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          type: e.target.value,
                        }))
                      }
                      disabled={Boolean(editAgent)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50"
                    >
                      {AGENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Description" className="md:col-span-2">
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          description: e.target.value,
                        }))
                      }
                      rows={5}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                    />
                  </Field>
                </div>
              )}

              {currentWizardStep.id === "runtime" && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Status">
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          status: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Model">
                    <input
                      value={formData.model}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          model: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                    />
                  </Field>
                  <Field label="Budget / Day">
                    <input
                      type="number"
                      value={formData.budgetPerDay}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          budgetPerDay: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                    />
                  </Field>
                  <label className="md:col-span-3 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={formData.isSelected}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          isSelected: e.target.checked,
                        }))
                      }
                      className="rounded border-zinc-600 bg-zinc-800 text-indigo-500"
                    />
                    Selected in tenant
                  </label>
                </div>
              )}

              {currentWizardStep.id === "assignment" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Department">
                    <select
                      value={formData.departmentId}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          departmentId: e.target.value,
                        }))
                      }
                      disabled={!formData.tenantId}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
                    >
                      <option value="">Unassigned</option>
                      {formDepartments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tier Slot Lineage">
                    <select
                      value={formData.tierAgentPoolId}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          tierAgentPoolId: e.target.value,
                        }))
                      }
                      disabled={!formData.tenantId}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
                    >
                      <option value="">No tier slot</option>
                      {formTierSlots.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {slot.templateName} ({slot.slotType})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">
                    {selectedTenant
                      ? `${formDepartments.length} departments and ${formTierSlots.length} tier slots are available for ${selectedTenant.name}.`
                      : "Choose a tenant first to load valid department and tier lineage assignments."}
                  </div>
                </div>
              )}

              {currentWizardStep.id === "review" && (
                <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <div className="text-xs text-zinc-500">Tenant</div>
                        <div className="mt-1 text-sm font-medium text-zinc-200">
                          {selectedTenant?.name || "Not selected"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {selectedTenant?.tier?.name || "No tier assigned"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <div className="text-xs text-zinc-500">Agent</div>
                        <div className="mt-1 text-sm font-medium text-zinc-200">
                          {formData.name || "Unnamed live agent"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {formData.type} • {formData.status}
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <div className="text-xs text-zinc-500">Runtime</div>
                        <div className="mt-1 text-sm font-medium text-zinc-200">
                          {formData.model || "Default model"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {formData.budgetPerDay
                            ? `$${formData.budgetPerDay}/day`
                            : "No explicit daily budget"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <div className="text-xs text-zinc-500">Assignment</div>
                        <div className="mt-1 text-sm font-medium text-zinc-200">
                          {selectedDepartment?.name || "Unassigned department"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {selectedTierSlot
                            ? `${selectedTierSlot.templateName} (${selectedTierSlot.slotType})`
                            : "No tier slot lineage"}
                        </div>
                      </div>
                    </div>
                    {formData.description && (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <div className="text-xs text-zinc-500">Description</div>
                        <div className="mt-1 text-sm text-zinc-300">
                          {formData.description}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
                    <div className="text-xs uppercase tracking-[0.24em] text-zinc-600">
                      Validation
                    </div>
                    <div
                      className={`rounded-xl border px-3 py-2 text-sm ${formData.tenantId ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-200" : "border-red-800/60 bg-red-500/10 text-red-200"}`}
                    >
                      {formData.tenantId ? "Tenant selected" : "Tenant missing"}
                    </div>
                    <div
                      className={`rounded-xl border px-3 py-2 text-sm ${formData.name.trim() ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-200" : "border-red-800/60 bg-red-500/10 text-red-200"}`}
                    >
                      {formData.name.trim()
                        ? "Agent name set"
                        : "Agent name missing"}
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400">
                      Saving will create or update the live agent directly
                      inside the selected tenant context.
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (wizardStepIndex === 0) {
                      setModalOpen(false);
                      return;
                    }
                    goToPreviousWizardStep();
                  }}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition"
                >
                  {wizardStepIndex === 0 ? "Cancel" : "Back"}
                </button>
                {wizardStepIndex < AGENT_WIZARD_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goToNextWizardStep}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : editAgent
                        ? "Save Agent"
                        : "Create Agent"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs text-zinc-500">{label}</label>
      {children}
    </div>
  );
}
