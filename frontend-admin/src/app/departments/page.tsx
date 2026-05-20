"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import api from "@/services/api";
import {
  tierCompositionService,
  type TenantListItem,
  type TierDepartmentPoolSlot,
} from "@/services/tierComposition.service";
import { unwrapList } from "@/services/unwrap";

interface DepartmentRow {
  id: string;
  tenantId: string;
  parentId?: string | null;
  headAgentId?: string | null;
  tierDepartmentPoolId?: string | null;
  templateId?: string | null;
  deployedFromTierId?: string | null;
  name: string;
  description?: string | null;
  status: string;
  isFixed?: boolean;
  isSelected?: boolean;
  createdAt: string;
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
  parent?: {
    id: string;
    name: string;
  } | null;
  headAgent?: {
    id: string;
    name: string;
    status: string;
    type: string;
  } | null;
  agents?: Array<{
    id: string;
    name: string;
    status: string;
    type: string;
  }>;
  _count?: {
    agents: number;
  };
}

interface DepartmentFormState {
  tenantId: string;
  name: string;
  description: string;
  status: string;
  parentId: string;
  headAgentId: string;
  tierDepartmentPoolId: string;
  isSelected: boolean;
}

interface AgentOption {
  id: string;
  name: string;
  status: string;
  type: string;
}

type DepartmentWizardStepId =
  | "tenant"
  | "identity"
  | "hierarchy"
  | "staffing"
  | "review";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
type LineageFilter = "ALL" | "TIER" | "TEMPLATE" | "MANUAL";

const PAGE_SIZE = 100;
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "ARCHIVED"];
const DEPARTMENT_WIZARD_STEPS: Array<{
  id: DepartmentWizardStepId;
  label: string;
  description: string;
}> = [
  {
    id: "tenant",
    label: "Tenant",
    description:
      "Choose the tenant scope and load its departments, agents, and tier slots.",
  },
  {
    id: "identity",
    label: "Identity",
    description:
      "Define the live department identity, description, and runtime status.",
  },
  {
    id: "hierarchy",
    label: "Hierarchy",
    description:
      "Place the department in the tenant org structure and assign tier lineage.",
  },
  {
    id: "staffing",
    label: "Leadership",
    description: "Assign the head agent and tenant selection state.",
  },
  {
    id: "review",
    label: "Review",
    description: "Validate the cross-tenant live department setup before saving.",
  },
];

function createEmptyForm(tenantId = ""): DepartmentFormState {
  return {
    tenantId,
    name: "",
    description: "",
    status: "ACTIVE",
    parentId: "",
    headAgentId: "",
    tierDepartmentPoolId: "",
    isSelected: true,
  };
}

function getLineageType(department: DepartmentRow): LineageFilter {
  if (department.deployedFromTierId) return "TIER";
  if (department.templateId) return "TEMPLATE";
  return "MANUAL";
}

function getLineageBadge(department: DepartmentRow) {
  if (department.deployedFromTierId) {
    return {
      label: department.isFixed ? "Tier Fixed" : "Tier Linked",
      className: department.isFixed
        ? "bg-indigo-950/70 text-indigo-300"
        : "bg-sky-950/70 text-sky-300",
    };
  }

  if (department.templateId) {
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

export default function AdminDepartmentsPage() {
  const user = useAdminAuth();

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);

  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [lineageFilter, setLineageFilter] = useState<LineageFilter>("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editDepartment, setEditDepartment] = useState<DepartmentRow | null>(
    null,
  );
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [formData, setFormData] =
    useState<DepartmentFormState>(createEmptyForm());
  const [tenantDepartments, setTenantDepartments] = useState<DepartmentRow[]>(
    [],
  );
  const [tenantAgents, setTenantAgents] = useState<AgentOption[]>([]);
  const [tierSlots, setTierSlots] = useState<TierDepartmentPoolSlot[]>([]);
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

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/departments", {
        params: {
          tenantId: tenantFilter || undefined,
          limit: PAGE_SIZE,
          scope: tenantFilter ? undefined : "platform",
        },
      });
      setDepartments(unwrapList(res).items as DepartmentRow[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load departments",
      );
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, [tenantFilter]);

  useEffect(() => {
    void fetchDepartments();
  }, [fetchDepartments]);

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
    if (!modalOpen || !formData.tenantId) {
      setTenantDepartments([]);
      setTenantAgents([]);
      setTierSlots([]);
      return;
    }

    const selectedTenant = tenants.find(
      (tenant) => tenant.id === formData.tenantId,
    );

    (async () => {
      try {
        const [departmentRes, agentRes, departmentPool] = await Promise.all([
          api.get("/departments", { params: { tenantId: formData.tenantId } }),
          api.get("/agents", {
            params: { tenantId: formData.tenantId, limit: PAGE_SIZE },
          }),
          selectedTenant?.tier?.id
            ? tierCompositionService.listDepartmentPool(selectedTenant.tier.id)
            : Promise.resolve([] as TierDepartmentPoolSlot[]),
        ]);

        setTenantDepartments(unwrapList(departmentRes).items as DepartmentRow[]);
        setTenantAgents(unwrapList(agentRes).items as AgentOption[]);
        setTierSlots(departmentPool);
      } catch {
        setTenantDepartments([]);
        setTenantAgents([]);
        setTierSlots([]);
      }
    })();
  }, [formData.tenantId, modalOpen, tenants]);

  const visibleDepartments = useMemo(() => {
    return departments.filter((department) => {
      const matchSearch =
        department.name.toLowerCase().includes(search.toLowerCase()) ||
        (department.tenant?.name ?? "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        (department.headAgent?.name ?? "")
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchTier = !tierFilter || department.tenant?.tier?.id === tierFilter;
      const matchStatus =
        statusFilter === "ALL" || department.status === statusFilter;
      const matchLineage =
        lineageFilter === "ALL" || getLineageType(department) === lineageFilter;
      return matchSearch && matchTier && matchStatus && matchLineage;
    });
  }, [departments, lineageFilter, search, statusFilter, tierFilter]);

  function openCreate() {
    setEditDepartment(null);
    setWizardStepIndex(0);
    setFormData(createEmptyForm(tenantFilter));
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(department: DepartmentRow) {
    setEditDepartment(department);
    setWizardStepIndex(0);
    setFormData({
      tenantId: department.tenantId,
      name: department.name,
      description: department.description ?? "",
      status: department.status,
      parentId: department.parentId ?? "",
      headAgentId: department.headAgentId ?? "",
      tierDepartmentPoolId: department.tierDepartmentPoolId ?? "",
      isSelected: department.isSelected ?? true,
    });
    setSaveError(null);
    setModalOpen(true);
  }

  function validateWizardStep(stepIndex: number) {
    const step = DEPARTMENT_WIZARD_STEPS[stepIndex];

    if (step.id === "tenant" && !formData.tenantId) {
      setSaveError("Tenant is required");
      return false;
    }

    if (step.id === "identity" && !formData.name.trim()) {
      setSaveError("Department name is required");
      return false;
    }

    setSaveError(null);
    return true;
  }

  function goToNextWizardStep() {
    if (!validateWizardStep(wizardStepIndex)) return;
    setWizardStepIndex((current) =>
      Math.min(current + 1, DEPARTMENT_WIZARD_STEPS.length - 1),
    );
  }

  function goToPreviousWizardStep() {
    setSaveError(null);
    setWizardStepIndex((current) => Math.max(current - 1, 0));
  }

  function buildDepartmentPayload() {
    return {
      tenantId: formData.tenantId,
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      status: formData.status,
      parentId: formData.parentId || undefined,
      headAgentId: formData.headAgentId || undefined,
      tierDepartmentPoolId: formData.tierDepartmentPoolId || undefined,
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

    const payload = buildDepartmentPayload();

    try {
      if (editDepartment) {
        await api.patch(`/departments/${editDepartment.id}`, payload, {
          params: { tenantId: editDepartment.tenantId },
        });

        if (!formData.parentId && editDepartment.parentId) {
          await api.post(
            `/departments/${editDepartment.id}/unassign-parent`,
            {},
            { params: { tenantId: formData.tenantId } },
          );
        }
      } else {
        await api.post("/departments", payload);
      }

      setModalOpen(false);
      await fetchDepartments();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save department",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(department: DepartmentRow) {
    try {
      await api.delete(`/departments/${department.id}`, {
        params: { tenantId: department.tenantId },
      });
      await fetchDepartments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete department",
      );
    }
  }

  if (!user) return null;

  const currentWizardStep = DEPARTMENT_WIZARD_STEPS[wizardStepIndex];
  const selectedTenant = tenants.find((tenant) => tenant.id === formData.tenantId);
  const selectedParentDepartment = tenantDepartments.find(
    (department) => department.id === formData.parentId,
  );
  const selectedHeadAgent = tenantAgents.find(
    (agent) => agent.id === formData.headAgentId,
  );
  const selectedTierSlot = tierSlots.find(
    (slot) => slot.id === formData.tierDepartmentPoolId,
  );

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">
              Live Departments
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Manage live tenant departments, hierarchy, head agents, and tier
              lineage.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void fetchDepartments()}
              className="px-3 py-2 rounded-lg border border-surface-border text-sm text-zinc-300 hover:bg-surface-overlay transition"
            >
              Refresh
            </button>
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
            >
              + Add Department
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search departments, tenants, or head agents…"
            className="lg:col-span-2 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
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
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              statusFilter === "ALL"
                ? "bg-indigo-600 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay"
            }`}
          >
            ALL
          </button>
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as StatusFilter)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                statusFilter === status
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay"
              }`}
            >
              {status}
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
                <Th>Parent</Th>
                <Th>Head Agent</Th>
                <Th>Members</Th>
                <Th>Lineage</Th>
                <Th>Status</Th>
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
                    Loading departments...
                  </td>
                </tr>
              ) : visibleDepartments.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-zinc-500"
                  >
                    No departments match the current filters.
                  </td>
                </tr>
              ) : (
                visibleDepartments.map((department, index) => {
                  const badge = getLineageBadge(department);

                  return (
                    <tr
                      key={department.id}
                      className={`border-b border-surface-border/50 hover:bg-surface-raised/50 transition ${
                        index % 2 === 0 ? "" : "bg-surface-overlay/20"
                      }`}
                    >
                      <Td>
                        <div className="font-medium text-zinc-100">
                          {department.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {department.description ?? "—"}
                        </div>
                      </Td>
                      <Td>
                        <div className="text-zinc-200">
                          {department.tenant?.name ?? "Unknown"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {department.tenant?.slug ?? "—"}
                        </div>
                      </Td>
                      <Td>
                        <div className="text-zinc-200">
                          {department.tenant?.tier?.name ?? "No tier"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {department.tenant?.tier?.slug ?? "—"}
                        </div>
                      </Td>
                      <Td className="text-zinc-400">
                        {department.parent?.name ?? "Root"}
                      </Td>
                      <Td>
                        <div className="text-zinc-200">
                          {department.headAgent?.name ?? "Unassigned"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {department.headAgent?.type ?? "—"}
                        </div>
                      </Td>
                      <Td>
                        <div className="text-zinc-200">
                          {department._count?.agents ?? 0}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {department.agents
                            ?.slice(0, 2)
                            .map((agent) => agent.name)
                            .join(", ") || "No agents"}
                        </div>
                      </Td>
                      <Td>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </Td>
                      <Td>
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
                          {department.status}
                        </span>
                      </Td>
                      <Td className="text-zinc-500 text-xs">
                        {new Date(department.createdAt).toLocaleDateString()}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openEdit(department)}
                            className="rounded-lg border border-surface-border px-2 py-1 text-xs text-zinc-300 hover:bg-surface-overlay transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void handleDelete(department)}
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
                    {editDepartment
                      ? "Edit Live Department"
                      : "Create Live Department"}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {currentWizardStep.description}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-[0.24em] text-zinc-600">
                    Step {wizardStepIndex + 1} of {DEPARTMENT_WIZARD_STEPS.length}
                  </div>
                  <div className="mt-1 text-sm font-medium text-zinc-300">
                    {currentWizardStep.label}
                  </div>
                </div>
              </div>

              <div className="mb-6 grid gap-2 md:grid-cols-5">
                {DEPARTMENT_WIZARD_STEPS.map((step, index) => {
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
                      <div className="mt-1 text-xs font-medium">{step.label}</div>
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
                            parentId: "",
                            headAgentId: "",
                            tierDepartmentPoolId: "",
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
                        ? `${selectedTenant.name} is on ${selectedTenant.tier?.name ?? "no tier"}. Later steps will use this tenant's live departments, agents, and tier policy slots.`
                        : "Select a tenant first. This wizard provisions a live department directly inside that tenant scope."}
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

              {currentWizardStep.id === "hierarchy" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Parent Department">
                    <select
                      value={formData.parentId}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          parentId: e.target.value,
                        }))
                      }
                      disabled={!formData.tenantId}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
                    >
                      <option value="">Root department</option>
                      {tenantDepartments
                        .filter((department) => department.id !== editDepartment?.id)
                        .map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Tier Slot Lineage">
                    <select
                      value={formData.tierDepartmentPoolId}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          tierDepartmentPoolId: e.target.value,
                        }))
                      }
                      disabled={!formData.tenantId}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
                    >
                      <option value="">No tier slot</option>
                      {tierSlots.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {slot.departmentTemplate.name} ({slot.slotType})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">
                    {selectedTenant
                      ? `${tenantDepartments.length} departments and ${tierSlots.length} tier department slots are available for ${selectedTenant.name}.`
                      : "Choose a tenant first to load hierarchy and tier slot options."}
                  </div>
                </div>
              )}

              {currentWizardStep.id === "staffing" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Head Agent">
                    <select
                      value={formData.headAgentId}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          headAgentId: e.target.value,
                        }))
                      }
                      disabled={!formData.tenantId}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
                    >
                      <option value="">Unassigned</option>
                      {tenantAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} ({agent.type})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
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
                  <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">
                    {selectedTenant
                      ? `${tenantAgents.length} live agents are available to lead this department in ${selectedTenant.name}.`
                      : "Choose a tenant first to load eligible head agents."}
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
                        <div className="text-xs text-zinc-500">Department</div>
                        <div className="mt-1 text-sm font-medium text-zinc-200">
                          {formData.name || "Unnamed live department"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {formData.status}
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <div className="text-xs text-zinc-500">Hierarchy</div>
                        <div className="mt-1 text-sm font-medium text-zinc-200">
                          {selectedParentDepartment?.name || "Root department"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {selectedTierSlot
                            ? `${selectedTierSlot.departmentTemplate.name} (${selectedTierSlot.slotType})`
                            : "No tier slot lineage"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <div className="text-xs text-zinc-500">Leadership</div>
                        <div className="mt-1 text-sm font-medium text-zinc-200">
                          {selectedHeadAgent?.name || "No head agent assigned"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {selectedHeadAgent
                            ? `${selectedHeadAgent.type} • ${selectedHeadAgent.status}`
                            : formData.isSelected
                              ? "Selected in tenant"
                              : "Not selected in tenant"}
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
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        formData.tenantId
                          ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-200"
                          : "border-red-800/60 bg-red-500/10 text-red-200"
                      }`}
                    >
                      {formData.tenantId ? "Tenant selected" : "Tenant missing"}
                    </div>
                    <div
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        formData.name.trim()
                          ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-200"
                          : "border-red-800/60 bg-red-500/10 text-red-200"
                      }`}
                    >
                      {formData.name.trim()
                        ? "Department name set"
                        : "Department name missing"}
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400">
                      Saving will create or update the live department directly
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
                {wizardStepIndex < DEPARTMENT_WIZARD_STEPS.length - 1 ? (
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
                      : editDepartment
                        ? "Save Department"
                        : "Create Department"}
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