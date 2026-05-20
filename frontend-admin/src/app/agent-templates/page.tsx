"use client";

/**
 * /agent-templates
 *
 * SuperAdmin library for managing platform-wide prebuilt Business AI Agent templates.
 * S — renders the template library list + modals; delegates API calls to agentTemplatesService.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminShell from "@/components/AdminShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useTierSettings } from "@/hooks/useTierSettings";
import {
  agentTemplatesService,
  type AgentTemplate,
  type CreateAgentTemplatePayload,
} from "@/services/agentTemplates.service";
import {
  tierCompositionService,
  type TierSlotType,
} from "@/services/tierComposition.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_TYPES = ["CORE", "FUNCTIONAL", "EXECUTIVE", "META"] as const;
const MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "claude-3-5-sonnet-20241022",
  "claude-3-haiku-20240307",
];

const TYPE_COLOR: Record<string, string> = {
  EXECUTIVE: "bg-purple-900 text-purple-300",
  CORE: "bg-blue-900 text-blue-300",
  FUNCTIONAL: "bg-indigo-900 text-indigo-300",
  META: "bg-amber-900 text-amber-300",
};

const PERMISSION_OPTIONS = [
  "read_all",
  "read_financials",
  "read_crm",
  "read_hr_data",
  "read_contracts",
  "read_audit_logs",
  "read_agent_metrics",
  "read_analytics",
  "create_reports",
  "create_tasks",
  "create_purchase_orders",
  "send_emails",
  "update_crm",
  "update_tickets",
  "orchestrate_agents",
  "manage_workflows",
  "assign_tasks",
  "approve_decisions",
  "approve_expenses",
  "flag_anomalies",
  "flag_issues",
  "flag_risks",
  "flag_violations",
  "access_billing",
  "access_calendar",
  "access_governance",
  "access_analytics",
  "access_knowledge_base",
  "access_vendor_db",
  "access_scheduling",
  "web_search",
  "manage_campaigns",
  "create_content",
];

type AgentTemplateWizardStepId =
  | "identity"
  | "role"
  | "runtime"
  | "prompts"
  | "permissions"
  | "budget"
  | "observability"
  | "compatibility"
  | "review";

interface AgentTemplateWizardConfig {
  allowTenantEditing: boolean;
  capabilityClass: string;
  budgetPerDay: string;
  maxRequestsPerMinute: string;
  maxConcurrentTasks: string;
  auditLevel: "standard" | "verbose" | "strict";
  enableAuditTrail: boolean;
  enableExecutionMetrics: boolean;
  enableCostTracking: boolean;
  compatibleTierIds: string[];
  deploymentNotes: string;
}

const AGENT_TEMPLATE_WIZARD_STEPS: Array<{
  id: AgentTemplateWizardStepId;
  label: string;
  description: string;
}> = [
  {
    id: "identity",
    label: "Identity",
    description: "Define the template name and business purpose.",
  },
  {
    id: "role",
    label: "Role",
    description: "Set the role type and capability class.",
  },
  {
    id: "runtime",
    label: "Runtime",
    description: "Choose model defaults and runtime edit policy.",
  },
  {
    id: "prompts",
    label: "Prompts",
    description: "Author the system prompt and execution instructions.",
  },
  {
    id: "permissions",
    label: "Permissions",
    description: "Select the permissions and tool access envelope.",
  },
  {
    id: "budget",
    label: "Budget",
    description: "Configure budget and rate control defaults.",
  },
  {
    id: "observability",
    label: "Observability",
    description: "Set audit and execution visibility defaults.",
  },
  {
    id: "compatibility",
    label: "Compatibility",
    description: "Declare which tiers this template is compatible with.",
  },
  {
    id: "review",
    label: "Review",
    description: "Validate the template before saving.",
  },
];

const DEFAULT_AGENT_TEMPLATE_CONFIG: AgentTemplateWizardConfig = {
  allowTenantEditing: true,
  capabilityClass: "general-operations",
  budgetPerDay: "",
  maxRequestsPerMinute: "",
  maxConcurrentTasks: "",
  auditLevel: "standard",
  enableAuditTrail: true,
  enableExecutionMetrics: true,
  enableCostTracking: false,
  compatibleTierIds: [],
  deploymentNotes: "",
};

function normalizeAgentTemplateConfig(
  config?: Record<string, unknown>,
): AgentTemplateWizardConfig {
  const source = config ?? {};
  return {
    allowTenantEditing:
      typeof source.allowTenantEditing === "boolean"
        ? source.allowTenantEditing
        : DEFAULT_AGENT_TEMPLATE_CONFIG.allowTenantEditing,
    capabilityClass:
      typeof source.capabilityClass === "string"
        ? source.capabilityClass
        : DEFAULT_AGENT_TEMPLATE_CONFIG.capabilityClass,
    budgetPerDay:
      typeof source.budgetPerDay === "number"
        ? String(source.budgetPerDay)
        : typeof source.budgetPerDay === "string"
          ? source.budgetPerDay
          : DEFAULT_AGENT_TEMPLATE_CONFIG.budgetPerDay,
    maxRequestsPerMinute:
      typeof source.maxRequestsPerMinute === "number"
        ? String(source.maxRequestsPerMinute)
        : typeof source.maxRequestsPerMinute === "string"
          ? source.maxRequestsPerMinute
          : DEFAULT_AGENT_TEMPLATE_CONFIG.maxRequestsPerMinute,
    maxConcurrentTasks:
      typeof source.maxConcurrentTasks === "number"
        ? String(source.maxConcurrentTasks)
        : typeof source.maxConcurrentTasks === "string"
          ? source.maxConcurrentTasks
          : DEFAULT_AGENT_TEMPLATE_CONFIG.maxConcurrentTasks,
    auditLevel:
      source.auditLevel === "verbose" || source.auditLevel === "strict"
        ? source.auditLevel
        : DEFAULT_AGENT_TEMPLATE_CONFIG.auditLevel,
    enableAuditTrail:
      typeof source.enableAuditTrail === "boolean"
        ? source.enableAuditTrail
        : DEFAULT_AGENT_TEMPLATE_CONFIG.enableAuditTrail,
    enableExecutionMetrics:
      typeof source.enableExecutionMetrics === "boolean"
        ? source.enableExecutionMetrics
        : DEFAULT_AGENT_TEMPLATE_CONFIG.enableExecutionMetrics,
    enableCostTracking:
      typeof source.enableCostTracking === "boolean"
        ? source.enableCostTracking
        : DEFAULT_AGENT_TEMPLATE_CONFIG.enableCostTracking,
    compatibleTierIds: Array.isArray(source.compatibleTierIds)
      ? source.compatibleTierIds.filter(
          (value): value is string => typeof value === "string",
        )
      : DEFAULT_AGENT_TEMPLATE_CONFIG.compatibleTierIds,
    deploymentNotes:
      typeof source.deploymentNotes === "string"
        ? source.deploymentNotes
        : DEFAULT_AGENT_TEMPLATE_CONFIG.deploymentNotes,
  };
}

// ─── Form state ───────────────────────────────────────────────────────────────

const EMPTY_FORM: CreateAgentTemplatePayload = {
  name: "",
  description: "",
  type: "FUNCTIONAL",
  model: "gpt-4o-mini",
  systemPrompt: "",
  instructions: "",
  permissions: [],
  config: { ...DEFAULT_AGENT_TEMPLATE_CONFIG },
  version: "1.0.0",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentTemplatesPage() {
  const user = useAdminAuth();
  const { tiers } = useTierSettings();
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AgentTemplate | null>(null);
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [form, setForm] = useState<CreateAgentTemplatePayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<AgentTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add-to-tier modal
  const [tierTarget, setTierTarget] = useState<AgentTemplate | null>(null);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [slotType, setSlotType] = useState<TierSlotType>("CHOICE");
  const [isRequired, setIsRequired] = useState(false);
  const [isDefaultSelected, setIsDefaultSelected] = useState(true);
  const [addingToTier, setAddingToTier] = useState(false);
  const [tierActionError, setTierActionError] = useState<string | null>(null);
  const [tierActionNotice, setTierActionNotice] = useState<string | null>(null);

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentTemplatesService.list({
        type: typeFilter === "ALL" ? undefined : typeFilter,
        page,
        limit,
      });
      setTemplates(res.items);
      setTotal(res.total);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const visible = search
    ? templates.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.description ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : templates;

  // ─── Modal helpers ─────────────────────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setWizardStepIndex(0);
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(t: AgentTemplate) {
    setEditTarget(t);
    setForm({
      name: t.name,
      description: t.description ?? "",
      type: t.type,
      model: t.model,
      systemPrompt: t.systemPrompt ?? "",
      instructions: t.instructions ?? "",
      permissions: [...t.permissions],
      config: {
        ...DEFAULT_AGENT_TEMPLATE_CONFIG,
        ...normalizeAgentTemplateConfig(t.config),
      },
      version: t.version,
    });
    setWizardStepIndex(0);
    setSaveError(null);
    setModalOpen(true);
  }

  function updateTemplateConfig(patch: Partial<AgentTemplateWizardConfig>) {
    setForm((current) => ({
      ...current,
      config: {
        ...normalizeAgentTemplateConfig(
          current.config as Record<string, unknown>,
        ),
        ...patch,
      },
    }));
  }

  function buildTemplatePayload(): CreateAgentTemplatePayload {
    const config = normalizeAgentTemplateConfig(
      form.config as Record<string, unknown>,
    );

    return {
      ...form,
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      systemPrompt: form.systemPrompt?.trim() || undefined,
      instructions: form.instructions?.trim() || undefined,
      version: form.version?.trim() || undefined,
      permissions: form.permissions ?? [],
      config: {
        ...config,
        budgetPerDay: config.budgetPerDay ? Number(config.budgetPerDay) : null,
        maxRequestsPerMinute: config.maxRequestsPerMinute
          ? Number(config.maxRequestsPerMinute)
          : null,
        maxConcurrentTasks: config.maxConcurrentTasks
          ? Number(config.maxConcurrentTasks)
          : null,
      },
    };
  }

  function validateWizardStep(stepIndex: number) {
    const config = normalizeAgentTemplateConfig(
      form.config as Record<string, unknown>,
    );
    const step = AGENT_TEMPLATE_WIZARD_STEPS[stepIndex];

    if (step.id === "identity" && !form.name.trim()) {
      setSaveError("Template name is required");
      return false;
    }

    if (step.id === "role" && !config.capabilityClass.trim()) {
      setSaveError("Capability class is required");
      return false;
    }

    if (step.id === "runtime" && !form.version?.trim()) {
      setSaveError("Version is required");
      return false;
    }

    if (step.id === "budget") {
      const numericValues = [
        config.budgetPerDay,
        config.maxRequestsPerMinute,
        config.maxConcurrentTasks,
      ].filter(Boolean);
      const hasInvalidNumber = numericValues.some((value) =>
        Number.isNaN(Number(value)),
      );

      if (hasInvalidNumber) {
        setSaveError("Budget and rate controls must be valid numbers");
        return false;
      }
    }

    setSaveError(null);
    return true;
  }

  function goToNextWizardStep() {
    if (!validateWizardStep(wizardStepIndex)) return;
    setWizardStepIndex((current) =>
      Math.min(current + 1, AGENT_TEMPLATE_WIZARD_STEPS.length - 1),
    );
  }

  function goToPreviousWizardStep() {
    setSaveError(null);
    setWizardStepIndex((current) => Math.max(current - 1, 0));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setSaveError("Name is required");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = buildTemplatePayload();
      if (editTarget) {
        await agentTemplatesService.update(editTarget.id, payload);
      } else {
        await agentTemplatesService.create(payload);
      }
      setModalOpen(false);
      void load();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await agentTemplatesService.remove(deleteTarget.id);
      setDeleteTarget(null);
      void load();
    } finally {
      setDeleting(false);
    }
  }

  function togglePermission(perm: string) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions?.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...(prev.permissions ?? []), perm],
    }));
  }

  function openAddToTier(target: AgentTemplate) {
    setTierTarget(target);
    setSelectedTierId(
      tiers.find((tier) => tier.isDefault)?.id ?? tiers[0]?.id ?? "",
    );
    setSlotType("CHOICE");
    setIsRequired(false);
    setIsDefaultSelected(true);
    setTierActionError(null);
  }

  async function handleAddToTier() {
    if (!tierTarget || !selectedTierId) {
      setTierActionError("Select a tier first");
      return;
    }

    setAddingToTier(true);
    setTierActionError(null);

    try {
      const slots = await tierCompositionService.listAgentPool(selectedTierId);
      const nextSlot =
        slots.reduce((maxSlot, current) => Math.max(maxSlot, current.slot), 0) +
        1;

      await tierCompositionService.createAgentPoolSlot(selectedTierId, {
        templateId: tierTarget.id,
        slot: nextSlot,
        slotType,
        isRequired,
        isDefaultSelected,
      });

      const tierName =
        tiers.find((tier) => tier.id === selectedTierId)?.name ?? "tier";
      setTierActionNotice(`${tierTarget.name} added to ${tierName}`);
      setTierTarget(null);
    } catch (err: unknown) {
      setTierActionError(
        err instanceof Error ? err.message : "Failed to add template to tier",
      );
    } finally {
      setAddingToTier(false);
    }
  }

  if (!user) return null;

  const templateConfig = normalizeAgentTemplateConfig(
    form.config as Record<string, unknown>,
  );
  const currentWizardStep = AGENT_TEMPLATE_WIZARD_STEPS[wizardStepIndex];
  const compatibleTierNames = tiers
    .filter((tier) => templateConfig.compatibleTierIds.includes(tier.id))
    .map((tier) => tier.name);

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">
              Agent Template Library
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Platform-wide prebuilt Business AI Agents. Tenants deploy
              instances from these.
            </p>
          </div>
          {user.role === "SUPER_ADMIN" && (
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
            >
              + New Template
            </button>
          )}
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or description…"
            className="flex-1 min-w-56 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
          />
          <div className="flex gap-1">
            {(["ALL", ...AGENT_TYPES] as string[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTypeFilter(t);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  typeFilter === t
                    ? "bg-indigo-600 text-white"
                    : "border border-surface-border text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="text-xs text-zinc-600 ml-auto">
            {total} templates
          </span>
        </div>

        {/* ── Grid ── */}
        {tierActionNotice && (
          <div className="rounded-lg border border-emerald-800 bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
            {tierActionNotice}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-xl bg-surface-raised animate-pulse"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center text-zinc-500 text-sm">
            No templates found.
            {user.role === "SUPER_ADMIN" && (
              <>
                {" "}
                <button
                  onClick={openCreate}
                  className="text-indigo-400 hover:underline"
                >
                  Create the first one.
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {visible.map((tmpl) => (
                <motion.div
                  key={tmpl.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col gap-3 hover:border-indigo-700/50 transition group"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-zinc-100 truncate">
                        {tmpl.name}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                        {tmpl.description}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[tmpl.type] ?? "bg-zinc-800 text-zinc-300"}`}
                    >
                      {tmpl.type}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex gap-3 text-xs text-zinc-500">
                    <span className="truncate">⬡ {tmpl.model}</span>
                    <span>v{tmpl.version}</span>
                    <span>{tmpl.permissions.length} perms</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto pt-2 border-t border-surface-border/50">
                    {user.role === "SUPER_ADMIN" ? (
                      <>
                        <button
                          onClick={() => openAddToTier(tmpl)}
                          className="flex-1 py-1.5 rounded-lg text-xs bg-sky-700 hover:bg-sky-600 text-white font-medium transition"
                        >
                          Add to Tier
                        </button>
                        <button
                          onClick={() => openEdit(tmpl)}
                          className="py-1.5 px-3 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-indigo-500 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(tmpl)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-600 hover:text-red-400 hover:border-red-700 transition"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <div className="text-xs text-zinc-600 py-1.5">
                        Read-only
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Pagination ── */}
        {total > limit && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition"
            >
              ← Prev
            </button>
            <span className="text-xs text-zinc-500">
              Page {page} of {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / limit)}
              className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════ Create / Edit Modal ═══════════════════════ */}
      <AnimatePresence>
        {tierTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) =>
              e.target === e.currentTarget &&
              !addingToTier &&
              setTierTarget(null)
            }
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
            >
              <h2 className="text-base font-semibold text-zinc-100 mb-1">
                Add Agent Template to Tier
              </h2>
              <p className="text-sm text-zinc-500 mb-5">
                Assign{" "}
                <span className="text-zinc-300 font-medium">
                  {tierTarget.name}
                </span>{" "}
                directly into a tier composition slot.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">
                    Tier *
                  </label>
                  <select
                    value={selectedTierId}
                    onChange={(e) => setSelectedTierId(e.target.value)}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select tier</option>
                    {tiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">
                      Slot Type
                    </label>
                    <select
                      value={slotType}
                      onChange={(e) =>
                        setSlotType(e.target.value as TierSlotType)
                      }
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="CHOICE">Choice</option>
                      <option value="FIXED">Fixed</option>
                    </select>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-xs text-zinc-500 flex items-center">
                    New slots are appended to the end of the selected tier pool.
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer select-none rounded-lg border border-surface-border bg-surface-overlay px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={() => setIsRequired((current) => !current)}
                    className="rounded border-zinc-600 bg-surface-overlay accent-indigo-500"
                  />
                  <div>
                    <div className="text-sm text-zinc-200">Required slot</div>
                    <div className="text-xs text-zinc-500">
                      Provision or retain this agent by policy for the tier.
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none rounded-lg border border-surface-border bg-surface-overlay px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isDefaultSelected}
                    onChange={() => setIsDefaultSelected((current) => !current)}
                    className="rounded border-zinc-600 bg-surface-overlay accent-indigo-500"
                  />
                  <div>
                    <div className="text-sm text-zinc-200">
                      Default selected
                    </div>
                    <div className="text-xs text-zinc-500">
                      Preselect this slot when the tier is assigned or
                      previewed.
                    </div>
                  </div>
                </label>

                {tierActionError && (
                  <div className="rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
                    {tierActionError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setTierTarget(null)}
                    disabled={addingToTier}
                    className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddToTier}
                    disabled={!selectedTierId || addingToTier}
                    className="flex-1 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    {addingToTier ? "Adding…" : "Add to Tier"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">
                    {editTarget
                      ? `Agent Template Wizard: ${editTarget.name}`
                      : "Agent Template Wizard"}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Guided setup for template identity, runtime defaults,
                    permissions, and deployment compatibility.
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-surface-border px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
                >
                  Close
                </button>
              </div>

              <div className="mb-6 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                {AGENT_TEMPLATE_WIZARD_STEPS.map((step, index) => {
                  const isActive = index === wizardStepIndex;
                  const isComplete = index < wizardStepIndex;
                  return (
                    <div
                      key={step.id}
                      className={`rounded-xl border px-4 py-3 ${
                        isActive
                          ? "border-indigo-500 bg-indigo-950/30"
                          : isComplete
                            ? "border-emerald-800 bg-emerald-950/20"
                            : "border-surface-border bg-surface-overlay"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          Step {index + 1}
                        </span>
                        <span
                          className={`text-[11px] ${
                            isActive
                              ? "text-indigo-300"
                              : isComplete
                                ? "text-emerald-300"
                                : "text-zinc-500"
                          }`}
                        >
                          {isComplete
                            ? "Done"
                            : isActive
                              ? "Current"
                              : "Pending"}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-100">
                        {step.label}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {step.description}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-surface-border bg-surface-overlay/60 p-6">
                <div className="mb-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    {currentWizardStep.label}
                  </div>
                  <div className="mt-2 text-sm text-zinc-400">
                    {currentWizardStep.description}
                  </div>
                </div>

                {currentWizardStep.id === "identity" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">
                        Name *
                      </label>
                      <input
                        value={form.name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, name: e.target.value }))
                        }
                        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                        placeholder="e.g. Sales Manager"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">
                        Description
                      </label>
                      <textarea
                        value={form.description}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        rows={4}
                        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                        placeholder="Describe the business purpose, operating context, and ownership expectations for this template."
                      />
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "role" && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">
                        Role Type
                      </label>
                      <select
                        value={form.type}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            type: e.target.value as AgentTemplate["type"],
                          }))
                        }
                        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      >
                        {AGENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">
                        Capability Class
                      </label>
                      <input
                        value={templateConfig.capabilityClass}
                        onChange={(e) =>
                          updateTemplateConfig({
                            capabilityClass: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                        placeholder="customer-ops, finance-analysis, executive-review"
                      />
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "runtime" && (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-xs text-zinc-400 mb-1 block">
                          Model
                        </label>
                        <select
                          value={form.model}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, model: e.target.value }))
                          }
                          className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                        >
                          {MODELS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-400 mb-1 block">
                          Version
                        </label>
                        <input
                          value={form.version}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, version: e.target.value }))
                          }
                          className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                          placeholder="1.0.0"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-surface-border bg-surface-overlay px-4 py-3">
                      <input
                        type="checkbox"
                        checked={templateConfig.allowTenantEditing}
                        onChange={() =>
                          updateTemplateConfig({
                            allowTenantEditing:
                              !templateConfig.allowTenantEditing,
                          })
                        }
                        className="rounded border-zinc-600 bg-surface-overlay accent-indigo-500"
                      />
                      <div>
                        <div className="text-sm text-zinc-200">
                          Allow tenant editing (clone)
                        </div>
                        <div className="text-xs text-zinc-500">
                          Tenant admins can clone this template and safely
                          adjust runtime fields without mutating the platform
                          definition.
                        </div>
                      </div>
                    </label>
                  </div>
                )}

                {currentWizardStep.id === "prompts" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">
                        System Prompt
                      </label>
                      <textarea
                        value={form.systemPrompt}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            systemPrompt: e.target.value,
                          }))
                        }
                        rows={8}
                        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-indigo-500 resize-y"
                        placeholder="You are the [role]. Your responsibilities include..."
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">
                        Instructions
                      </label>
                      <textarea
                        value={form.instructions}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            instructions: e.target.value,
                          }))
                        }
                        rows={4}
                        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                        placeholder="Behavioral guidelines, escalation rules, and expected collaboration style..."
                      />
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "permissions" && (
                  <div>
                    <label className="text-xs text-zinc-400 mb-2 block">
                      Permissions and Tool Access (
                      {form.permissions?.length ?? 0} selected)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-72 overflow-y-auto rounded-lg border border-surface-border bg-surface-overlay p-3">
                      {PERMISSION_OPTIONS.map((perm) => (
                        <label
                          key={perm}
                          className="flex items-center gap-1.5 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={form.permissions?.includes(perm) ?? false}
                            onChange={() => togglePermission(perm)}
                            className="rounded border-zinc-600 bg-surface-overlay accent-indigo-500"
                          />
                          <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition truncate">
                            {perm}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "budget" && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">
                        Budget Per Day
                      </label>
                      <input
                        value={templateConfig.budgetPerDay}
                        onChange={(e) =>
                          updateTemplateConfig({ budgetPerDay: e.target.value })
                        }
                        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                        placeholder="250"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">
                        Max Requests / Minute
                      </label>
                      <input
                        value={templateConfig.maxRequestsPerMinute}
                        onChange={(e) =>
                          updateTemplateConfig({
                            maxRequestsPerMinute: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                        placeholder="60"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">
                        Max Concurrent Tasks
                      </label>
                      <input
                        value={templateConfig.maxConcurrentTasks}
                        onChange={(e) =>
                          updateTemplateConfig({
                            maxConcurrentTasks: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                        placeholder="5"
                      />
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "observability" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">
                        Audit Level
                      </label>
                      <select
                        value={templateConfig.auditLevel}
                        onChange={(e) =>
                          updateTemplateConfig({
                            auditLevel: e.target
                              .value as AgentTemplateWizardConfig["auditLevel"],
                          })
                        }
                        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="standard">Standard</option>
                        <option value="verbose">Verbose</option>
                        <option value="strict">Strict</option>
                      </select>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        {
                          key: "enableAuditTrail",
                          label: "Audit Trail",
                          description: "Persist action-level audit events.",
                          value: templateConfig.enableAuditTrail,
                        },
                        {
                          key: "enableExecutionMetrics",
                          label: "Execution Metrics",
                          description:
                            "Capture runtime timings and throughput.",
                          value: templateConfig.enableExecutionMetrics,
                        },
                        {
                          key: "enableCostTracking",
                          label: "Cost Tracking",
                          description: "Track spend against budget defaults.",
                          value: templateConfig.enableCostTracking,
                        },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-overlay px-4 py-3"
                        >
                          <input
                            type="checkbox"
                            checked={item.value}
                            onChange={() =>
                              updateTemplateConfig({
                                [item.key]: !item.value,
                              } as Partial<AgentTemplateWizardConfig>)
                            }
                            className="mt-1 rounded border-zinc-600 bg-surface-overlay accent-indigo-500"
                          />
                          <div>
                            <div className="text-sm text-zinc-200">
                              {item.label}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {item.description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "compatibility" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-zinc-400 mb-2 block">
                        Compatible Tiers
                      </label>
                      <div className="grid gap-2 md:grid-cols-2">
                        {tiers.map((tier) => {
                          const isChecked =
                            templateConfig.compatibleTierIds.includes(tier.id);
                          return (
                            <label
                              key={tier.id}
                              className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-overlay px-4 py-3"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() =>
                                  updateTemplateConfig({
                                    compatibleTierIds: isChecked
                                      ? templateConfig.compatibleTierIds.filter(
                                          (id) => id !== tier.id,
                                        )
                                      : [
                                          ...templateConfig.compatibleTierIds,
                                          tier.id,
                                        ],
                                  })
                                }
                                className="mt-1 rounded border-zinc-600 bg-surface-overlay accent-indigo-500"
                              />
                              <div>
                                <div className="text-sm text-zinc-200">
                                  {tier.name}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {tier.description ||
                                    "No description provided."}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">
                        Deployment Notes
                      </label>
                      <textarea
                        value={templateConfig.deploymentNotes}
                        onChange={(e) =>
                          updateTemplateConfig({
                            deploymentNotes: e.target.value,
                          })
                        }
                        rows={4}
                        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                        placeholder="Document rollout constraints, recommended tiers, and operator notes for this template."
                      />
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "review" && (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-xl border border-surface-border bg-surface-overlay px-4 py-3">
                        <div className="text-xs text-zinc-500">Template</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">
                          {form.name || "Unnamed template"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-surface-border bg-surface-overlay px-4 py-3">
                        <div className="text-xs text-zinc-500">Role Type</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">
                          {form.type}
                        </div>
                      </div>
                      <div className="rounded-xl border border-surface-border bg-surface-overlay px-4 py-3">
                        <div className="text-xs text-zinc-500">Permissions</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">
                          {form.permissions?.length ?? 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-surface-border bg-surface-overlay px-4 py-3">
                        <div className="text-xs text-zinc-500">
                          Compatible Tiers
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">
                          {compatibleTierNames.length}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl border border-surface-border bg-surface-overlay px-4 py-4 text-sm text-zinc-300">
                        <div className="mb-2 font-medium text-zinc-100">
                          Runtime Summary
                        </div>
                        <div>Model: {form.model}</div>
                        <div>Version: {form.version || "Missing"}</div>
                        <div>
                          Capability class: {templateConfig.capabilityClass}
                        </div>
                        <div>
                          Tenant editing:{" "}
                          {templateConfig.allowTenantEditing
                            ? "Allowed"
                            : "Disabled"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-surface-border bg-surface-overlay px-4 py-4 text-sm text-zinc-300">
                        <div className="mb-2 font-medium text-zinc-100">
                          Policy Summary
                        </div>
                        <div>Audit level: {templateConfig.auditLevel}</div>
                        <div>
                          Audit trail:{" "}
                          {templateConfig.enableAuditTrail ? "On" : "Off"}
                        </div>
                        <div>
                          Execution metrics:{" "}
                          {templateConfig.enableExecutionMetrics ? "On" : "Off"}
                        </div>
                        <div>
                          Cost tracking:{" "}
                          {templateConfig.enableCostTracking ? "On" : "Off"}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-surface-border bg-surface-overlay px-4 py-4 text-sm text-zinc-300">
                      <div className="mb-2 font-medium text-zinc-100">
                        Deployment Compatibility
                      </div>
                      {compatibleTierNames.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {compatibleTierNames.map((tierName) => (
                            <span
                              key={tierName}
                              className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                            >
                              {tierName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-zinc-500">
                          No compatible tiers selected yet.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {saveError && (
                  <div className="mt-4 rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
                    {saveError}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    onClick={() =>
                      wizardStepIndex === 0
                        ? setModalOpen(false)
                        : goToPreviousWizardStep()
                    }
                    className="rounded-lg border border-surface-border px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
                  >
                    {wizardStepIndex === 0 ? "Cancel" : "Back"}
                  </button>
                  {wizardStepIndex < AGENT_TEMPLATE_WIZARD_STEPS.length - 1 ? (
                    <button
                      onClick={goToNextWizardStep}
                      className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition px-4 py-2"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50 px-4 py-2"
                    >
                      {saving
                        ? "Saving…"
                        : editTarget
                          ? "Save Template"
                          : "Create Template"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════ Delete Confirm ═══════════════════════ */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              className="w-full max-w-sm rounded-2xl border border-red-800/40 bg-surface-raised p-6 shadow-2xl"
            >
              <h3 className="text-base font-semibold text-zinc-100 mb-2">
                Delete Template?
              </h3>
              <p className="text-sm text-zinc-400 mb-5">
                <span className="text-zinc-200 font-medium">
                  "{deleteTarget.name}"
                </span>{" "}
                will be permanently deleted. Agents already deployed from this
                template will not be affected.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminShell>
  );
}
