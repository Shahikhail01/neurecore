"use client";

/**
 * /dept-templates
 *
 * SuperAdmin library for managing platform-wide Department Templates.
 * Each template is an org blueprint (list of departments + hierarchy)
 * that can be deployed to any tenant in one click.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminShell from "@/components/AdminShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useTierSettings } from "@/hooks/useTierSettings";
import {
  deptTemplatesService,
  type DepartmentTemplate,
  type DeptStructureItem,
  type CreateDeptTemplatePayload,
} from "@/services/deptTemplates.service";
import api from "@/services/api";
import {
  tierCompositionService,
  type TierSlotType,
} from "@/services/tierComposition.service";
import { unwrapList } from "@/services/unwrap";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  status: string;
}

const CATEGORIES = [
  "general",
  "startup",
  "scaleup",
  "ecommerce",
  "saas",
  "enterprise",
];

type DepartmentTemplateWizardStepId =
  | "identity"
  | "hierarchy"
  | "leadership"
  | "resources"
  | "policy"
  | "staffing"
  | "compatibility"
  | "review";

const DEPARTMENT_TEMPLATE_WIZARD_STEPS: Array<{
  id: DepartmentTemplateWizardStepId;
  label: string;
  description: string;
}> = [
  {
    id: "identity",
    label: "Identity",
    description: "Define the template identity and organizational purpose.",
  },
  {
    id: "hierarchy",
    label: "Hierarchy",
    description: "Map the department tree and parent placement.",
  },
  {
    id: "leadership",
    label: "Leadership",
    description: "Describe default head agent roles for each department.",
  },
  {
    id: "resources",
    label: "Child Resources",
    description: "Specify required or optional child agent resources.",
  },
  {
    id: "policy",
    label: "Policy",
    description: "Set policy metadata, category, tags, and visibility.",
  },
  {
    id: "staffing",
    label: "Staffing",
    description: "Document the default staffing pattern for this template.",
  },
  {
    id: "compatibility",
    label: "Compatibility",
    description: "Declare which tiers this structure is intended for.",
  },
  {
    id: "review",
    label: "Review",
    description: "Validate the template before saving.",
  },
];

function extractPrefixedTags(tags: string[] | undefined, prefix: string) {
  return (tags ?? [])
    .filter((tag) => tag.startsWith(prefix))
    .map((tag) => tag.slice(prefix.length))
    .filter(Boolean);
}

function removePrefixedTags(tags: string[] | undefined, prefixes: string[]) {
  return (tags ?? []).filter(
    (tag) => !prefixes.some((prefix) => tag.startsWith(prefix)),
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const EMPTY_STRUCTURE: DeptStructureItem[] = [
  { name: "", description: "", headAgentType: "", parentName: "" },
];

const EMPTY_FORM: CreateDeptTemplatePayload = {
  name: "",
  slug: "",
  description: "",
  category: "general",
  tags: [],
  structure: EMPTY_STRUCTURE,
  isPublic: true,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeptTemplatesPage() {
  const user = useAdminAuth();
  const { tiers } = useTierSettings();
  const [templates, setTemplates] = useState<DepartmentTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const limit = 20;

  // CRUD modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DepartmentTemplate | null>(null);
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [form, setForm] = useState<CreateDeptTemplatePayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [policyTagsInput, setPolicyTagsInput] = useState("");
  const [staffingPattern, setStaffingPattern] = useState("");
  const [compatibleTierIds, setCompatibleTierIds] = useState<string[]>([]);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<DepartmentTemplate | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  // Deploy modal
  const [deployTarget, setDeployTarget] = useState<DepartmentTemplate | null>(
    null,
  );
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [withAgents, setWithAgents] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{
    departments: number;
    agents: number;
  } | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

  // Add-to-tier modal
  const [tierTarget, setTierTarget] = useState<DepartmentTemplate | null>(null);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [slotType, setSlotType] = useState<TierSlotType>("CHOICE");
  const [isRequired, setIsRequired] = useState(false);
  const [isDefaultSelected, setIsDefaultSelected] = useState(true);
  const [addingToTier, setAddingToTier] = useState(false);
  const [tierActionError, setTierActionError] = useState<string | null>(null);
  const [tierActionNotice, setTierActionNotice] = useState<string | null>(null);

  // ─── Fetch templates ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await deptTemplatesService.list({
        category: catFilter === "ALL" ? undefined : catFilter,
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
  }, [catFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // ─── Fetch tenants for deploy dropdown ─────────────────────────────────────

  const loadTenants = useCallback(async () => {
    try {
      const res = await api.get("/tenants?limit=100");
      setTenants((unwrapList(res).items ?? []) as TenantOption[]);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    if (deployTarget) void loadTenants();
  }, [deployTarget, loadTenants]);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const visible = search
    ? templates.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.description ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : templates;

  const nonTier = visible.filter(
    (t) =>
      !(
        t.slug?.startsWith("tier-") ||
        (t.tags ?? []).includes("tier") ||
        t.name.startsWith("Tier:")
      ),
  );

  // ─── Modal helpers ─────────────────────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setWizardStepIndex(0);
    setForm({
      ...EMPTY_FORM,
      structure: [
        { name: "", description: "", headAgentType: "", parentName: "" },
      ],
    });
    setPolicyTagsInput("");
    setStaffingPattern("");
    setCompatibleTierIds([]);
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(t: DepartmentTemplate) {
    const nonMetaTags = removePrefixedTags(t.tags, [
      "policy:",
      "staffing:",
      "tier:",
    ]);
    setEditTarget(t);
    setWizardStepIndex(0);
    setForm({
      name: t.name,
      slug: t.slug,
      description: t.description ?? "",
      category: t.category,
      tags: [...nonMetaTags],
      structure:
        t.structure.length > 0
          ? [...t.structure]
          : [{ name: "", description: "", headAgentType: "", parentName: "" }],
      isPublic: t.isPublic,
    });
    setPolicyTagsInput(extractPrefixedTags(t.tags, "policy:").join(", "));
    setStaffingPattern(extractPrefixedTags(t.tags, "staffing:")[0] ?? "");
    setCompatibleTierIds(extractPrefixedTags(t.tags, "tier:"));
    setSaveError(null);
    setModalOpen(true);
  }

  // Structure row helpers
  function addRow() {
    setForm((f) => ({
      ...f,
      structure: [
        ...f.structure,
        { name: "", description: "", headAgentType: "", parentName: "" },
      ],
    }));
  }

  function removeRow(i: number) {
    setForm((f) => ({
      ...f,
      structure: f.structure.filter((_, idx) => idx !== i),
    }));
  }

  function updateRow(i: number, field: keyof DeptStructureItem, val: string) {
    setForm((f) => {
      const s = [...f.structure];
      s[i] = { ...s[i], [field]: val };
      return { ...f, structure: s };
    });
  }

  function updateRowAgentTemplateNames(i: number, value: string) {
    setForm((f) => {
      const structure = [...f.structure];
      structure[i] = {
        ...structure[i],
        agentTemplateNames: value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      return { ...f, structure };
    });
  }

  function buildDepartmentTemplatePayload(): CreateDeptTemplatePayload {
    const validRows = form.structure
      .filter((row) => row.name.trim())
      .map((row) => ({
        ...row,
        name: row.name.trim(),
        description: row.description?.trim() || undefined,
        headAgentType: row.headAgentType?.trim() || undefined,
        parentName: row.parentName?.trim() || undefined,
        agentTemplateNames:
          row.agentTemplateNames?.map((item) => item.trim()).filter(Boolean) ??
          undefined,
      }));

    const policyTags = policyTagsInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => `policy:${item}`);

    const compatibilityTags = compatibleTierIds.map(
      (tierId) => `tier:${tierId}`,
    );
    const staffingTags = staffingPattern.trim()
      ? [`staffing:${staffingPattern.trim()}`]
      : [];

    return {
      ...form,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description?.trim() || undefined,
      tags: [
        ...(form.tags ?? []),
        ...policyTags,
        ...staffingTags,
        ...compatibilityTags,
      ],
      structure: validRows,
    };
  }

  function validateWizardStep(stepIndex: number) {
    const step = DEPARTMENT_TEMPLATE_WIZARD_STEPS[stepIndex];

    if (step.id === "identity") {
      if (!form.name.trim()) {
        setSaveError("Name is required");
        return false;
      }
      if (!form.slug.trim()) {
        setSaveError("Slug is required");
        return false;
      }
    }

    if (step.id === "hierarchy") {
      if (!form.structure.some((row) => row.name.trim())) {
        setSaveError("Add at least one department to the structure");
        return false;
      }
    }

    setSaveError(null);
    return true;
  }

  function goToNextWizardStep() {
    if (!validateWizardStep(wizardStepIndex)) return;
    setWizardStepIndex((current) =>
      Math.min(current + 1, DEPARTMENT_TEMPLATE_WIZARD_STEPS.length - 1),
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
    if (!form.slug.trim()) {
      setSaveError("Slug is required");
      return;
    }
    const validRows = form.structure.filter((r) => r.name.trim());
    if (validRows.length === 0) {
      setSaveError("Add at least one department to the structure");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = buildDepartmentTemplatePayload();
      if (editTarget) {
        const { slug: _s, ...updatePayload } = payload; // slug not updatable
        await deptTemplatesService.update(editTarget.id, updatePayload);
      } else {
        await deptTemplatesService.create(payload);
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
      await deptTemplatesService.remove(deleteTarget.id);
      setDeleteTarget(null);
      void load();
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeploy() {
    if (!deployTarget || !selectedTenant) return;
    setDeploying(true);
    setDeployError(null);
    setDeployResult(null);
    try {
      const result = await deptTemplatesService.deployToTenant(
        selectedTenant,
        deployTarget.id,
        withAgents,
      );
      setDeployResult(result);
    } catch (err: unknown) {
      setDeployError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setDeploying(false);
    }
  }

  function openAddToTier(target: DepartmentTemplate) {
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
      const slots =
        await tierCompositionService.listDepartmentPool(selectedTierId);
      const nextSlot =
        slots.reduce((maxSlot, current) => Math.max(maxSlot, current.slot), 0) +
        1;

      await tierCompositionService.createDepartmentPoolSlot(selectedTierId, {
        departmentTemplateId: tierTarget.id,
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

  const currentWizardStep = DEPARTMENT_TEMPLATE_WIZARD_STEPS[wizardStepIndex];
  const compatibleTierNames = tiers
    .filter((tier) => compatibleTierIds.includes(tier.id))
    .map((tier) => tier.name);

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">
              Department Template Library
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Org structure blueprints. Deploy any template to a tenant to
              instantly create their departments.
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
            placeholder="Search templates…"
            className="flex-1 min-w-56 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
          />
          <div className="flex gap-1 flex-wrap">
            {["ALL", ...CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCatFilter(c);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
                  catFilter === c
                    ? "bg-indigo-600 text-white"
                    : "border border-surface-border text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <span className="text-xs text-zinc-600 ml-auto">
            {nonTier.length} templates
          </span>
        </div>

        {/* ── Cards ── */}
        {tierActionNotice && (
          <div className="rounded-lg border border-emerald-800 bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
            {tierActionNotice}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-52 rounded-xl bg-surface-raised animate-pulse"
              />
            ))}
          </div>
        ) : nonTier.length === 0 ? (
          <div className="py-20 text-center text-zinc-500 text-sm">
            No templates found.
            {user.role === "SUPER_ADMIN" && (
              <>
                {" "}
                <button
                  onClick={openCreate}
                  className="text-indigo-400 hover:underline"
                >
                  Create one.
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {nonTier.map((tmpl) => (
                <motion.div
                  key={tmpl.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col gap-3 hover:border-indigo-700/50 transition"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-zinc-100 truncate">
                        {tmpl.name}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                        {tmpl.description}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-300 capitalize">
                      {tmpl.category}
                    </span>
                  </div>

                  {/* Structure preview */}
                  <div className="rounded-lg bg-surface-overlay border border-surface-border/50 p-2.5 space-y-1 max-h-28 overflow-y-auto">
                    {tmpl.structure.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <span className="text-zinc-600">
                          {item.parentName ? "  └" : "◆"}
                        </span>
                        <span className="text-zinc-300 truncate">
                          {item.name}
                        </span>
                        {item.headAgentType && (
                          <span className="text-zinc-600 text-[10px]">
                            ({item.headAgentType})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Tags */}
                  {tmpl.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {tmpl.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-zinc-800 text-zinc-400 px-2 py-0.5 text-[10px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto pt-2 border-t border-surface-border/50">
                    {user.role === "SUPER_ADMIN" && (
                      <button
                        onClick={() => {
                          setDeployTarget(tmpl);
                          setDeployResult(null);
                          setDeployError(null);
                          setSelectedTenant("");
                        }}
                        className="flex-1 py-1.5 rounded-lg text-xs bg-indigo-700 hover:bg-indigo-600 text-white font-medium transition"
                      >
                        Deploy →
                      </button>
                    )}
                    {user.role === "SUPER_ADMIN" && (
                      <button
                        onClick={() => openAddToTier(tmpl)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-sky-700 hover:bg-sky-600 text-white font-medium transition"
                      >
                        Add to Tier
                      </button>
                    )}
                    {user.role === "SUPER_ADMIN" && (
                      <button
                        onClick={() => openEdit(tmpl)}
                        className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 transition"
                      >
                        Edit
                      </button>
                    )}
                    {user.role === "SUPER_ADMIN" && (
                      <button
                        onClick={() => setDeleteTarget(tmpl)}
                        className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-600 hover:text-red-400 hover:border-red-700 transition"
                      >
                        ✕
                      </button>
                    )}
                    {user.role !== "SUPER_ADMIN" && (
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

        {/* Pagination */}
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

      {/* ═══════════════ Create / Edit Modal ═══════════════ */}
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
                Add Department Template to Tier
              </h2>
              <p className="text-sm text-zinc-500 mb-5">
                Assign{" "}
                <span className="text-zinc-300 font-medium">
                  {tierTarget.name}
                </span>{" "}
                directly into a tier department pool.
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

                <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-surface-border bg-surface-overlay px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={() => setIsRequired((current) => !current)}
                    className="rounded border-zinc-600 bg-surface-overlay accent-indigo-500"
                  />
                  <div>
                    <div className="text-sm text-zinc-200">Required slot</div>
                    <div className="text-xs text-zinc-500">
                      Keep this department in policy for the selected tier.
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-surface-border bg-surface-overlay px-3 py-2">
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
                      Preselect this structure when the tier is assigned or
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
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
            >
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-100 mb-1">
                      {editTarget
                        ? `Edit: ${editTarget.name}`
                        : "Create Department Template"}
                    </h2>
                    <p className="text-sm text-zinc-500 max-w-2xl">
                      {currentWizardStep.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-[0.24em] text-zinc-600">
                      Step {wizardStepIndex + 1} of{" "}
                      {DEPARTMENT_TEMPLATE_WIZARD_STEPS.length}
                    </div>
                    <div className="text-sm font-medium text-zinc-300 mt-1">
                      {currentWizardStep.label}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
                  {DEPARTMENT_TEMPLATE_WIZARD_STEPS.map((step, index) => {
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
                              : "border-surface-border bg-surface-overlay text-zinc-500 hover:text-zinc-300"
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

                {currentWizardStep.id === "identity" && (
                  <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
                    <div className="space-y-4 rounded-2xl border border-surface-border bg-surface-overlay p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs text-zinc-400 mb-1 block">
                            Name *
                          </label>
                          <input
                            value={form.name}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                name: e.target.value,
                                slug: editTarget
                                  ? f.slug
                                  : slugify(e.target.value),
                              }))
                            }
                            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                            placeholder="e.g. Global Services Operating Model"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400 mb-1 block">
                            Slug{" "}
                            {editTarget && (
                              <span className="text-zinc-600">(locked)</span>
                            )}
                          </label>
                          <input
                            value={form.slug}
                            onChange={(e) =>
                              !editTarget &&
                              setForm((f) => ({
                                ...f,
                                slug: slugify(e.target.value),
                              }))
                            }
                            readOnly={!!editTarget}
                            className={`w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 ${editTarget ? "text-zinc-500 cursor-not-allowed" : "text-zinc-200"}`}
                            placeholder="global-services-operating-model"
                          />
                        </div>
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
                          rows={5}
                          className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                          placeholder="Describe the operating model, business stage, and what this structure is optimized for."
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-surface-border bg-surface-overlay p-4 space-y-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-zinc-600">
                          Wizard Outcome
                        </div>
                        <div className="mt-2 text-sm text-zinc-300">
                          This wizard produces a reusable platform department
                          blueprint that can be deployed directly to tenants or
                          attached to tier pools.
                        </div>
                      </div>
                      <div className="rounded-xl border border-surface-border bg-surface p-3 text-sm text-zinc-400">
                        Use the next steps to define hierarchy, leadership
                        defaults, optional child agents, policy markers,
                        staffing posture, and tier fit.
                      </div>
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "hierarchy" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-zinc-200">
                          Department Structure
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          Define each department and its parent placement inside
                          the org tree.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addRow}
                        className="rounded-lg border border-indigo-500/40 px-3 py-2 text-xs font-medium text-indigo-300 hover:border-indigo-400 hover:text-indigo-200 transition"
                      >
                        + Add Department
                      </button>
                    </div>
                    <div className="rounded-2xl border border-surface-border bg-surface-overlay p-3 space-y-2 max-h-[28rem] overflow-y-auto">
                      <div className="grid grid-cols-[1.4fr_2fr_1.1fr_auto] gap-2 text-[10px] text-zinc-600 uppercase tracking-[0.24em] px-1">
                        <span>Name *</span>
                        <span>Description</span>
                        <span>Parent Name</span>
                        <span></span>
                      </div>
                      {form.structure.map((row, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[1.4fr_2fr_1.1fr_auto] gap-2 items-center"
                        >
                          <input
                            value={row.name}
                            onChange={(e) =>
                              updateRow(i, "name", e.target.value)
                            }
                            className="rounded border border-surface-border bg-surface text-zinc-200 text-xs px-2 py-2 focus:outline-none focus:border-indigo-500"
                            placeholder="Finance"
                          />
                          <input
                            value={row.description ?? ""}
                            onChange={(e) =>
                              updateRow(i, "description", e.target.value)
                            }
                            className="rounded border border-surface-border bg-surface text-zinc-400 text-xs px-2 py-2 focus:outline-none focus:border-indigo-500"
                            placeholder="Mission, scope, or charter"
                          />
                          <input
                            value={row.parentName ?? ""}
                            onChange={(e) =>
                              updateRow(i, "parentName", e.target.value)
                            }
                            className="rounded border border-surface-border bg-surface text-zinc-400 text-xs px-2 py-2 focus:outline-none focus:border-indigo-500"
                            placeholder="Executive"
                          />
                          <button
                            type="button"
                            onClick={() => removeRow(i)}
                            className="text-zinc-600 hover:text-red-400 transition text-xs px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "leadership" && (
                  <div className="space-y-4 rounded-2xl border border-surface-border bg-surface-overlay p-4">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">
                        Default Leadership Roles
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Assign the default head agent type used to lead each
                        department when deployed.
                      </div>
                    </div>
                    <div className="space-y-3 max-h-[28rem] overflow-y-auto">
                      {form.structure.map((row, i) => (
                        <div
                          key={i}
                          className="grid gap-3 rounded-xl border border-surface-border bg-surface p-3 md:grid-cols-[1.1fr_1fr]"
                        >
                          <div>
                            <div className="text-sm font-medium text-zinc-200">
                              {row.name || `Department ${i + 1}`}
                            </div>
                            <div className="text-xs text-zinc-500 mt-1">
                              {row.parentName
                                ? `Reports to ${row.parentName}`
                                : "Top-level department"}
                            </div>
                          </div>
                          <input
                            value={row.headAgentType ?? ""}
                            onChange={(e) =>
                              updateRow(i, "headAgentType", e.target.value)
                            }
                            className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                            placeholder="EXECUTIVE"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "resources" && (
                  <div className="space-y-4 rounded-2xl border border-surface-border bg-surface-overlay p-4">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">
                        Child Agent Resources
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        List the platform agent templates commonly provisioned
                        under each department.
                      </div>
                    </div>
                    <div className="space-y-3 max-h-[28rem] overflow-y-auto">
                      {form.structure.map((row, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-surface-border bg-surface p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-zinc-200">
                                {row.name || `Department ${i + 1}`}
                              </div>
                              <div className="text-xs text-zinc-500 mt-1">
                                Comma-separated agent template names. Leave
                                blank if the department deploys empty.
                              </div>
                            </div>
                          </div>
                          <input
                            value={(row.agentTemplateNames ?? []).join(", ")}
                            onChange={(e) =>
                              updateRowAgentTemplateNames(i, e.target.value)
                            }
                            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                            placeholder="Executive Copilot, Financial Analyst, Revenue Operator"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "policy" && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-surface-border bg-surface-overlay p-4 space-y-4">
                      <div>
                        <label className="text-xs text-zinc-400 mb-1 block">
                          Category
                        </label>
                        <select
                          value={form.category}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, category: e.target.value }))
                          }
                          className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c} className="capitalize">
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-400 mb-1 block">
                          Business Tags
                        </label>
                        <input
                          value={(form.tags ?? []).join(", ")}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              tags: e.target.value
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean),
                            }))
                          }
                          className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                          placeholder="startup, lean, b2b"
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-surface-border bg-surface-overlay p-4 space-y-4">
                      <div>
                        <label className="text-xs text-zinc-400 mb-1 block">
                          Policy Metadata
                        </label>
                        <input
                          value={policyTagsInput}
                          onChange={(e) => setPolicyTagsInput(e.target.value)}
                          className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                          placeholder="regulated, approval-gated, finance-reviewed"
                        />
                        <div className="mt-2 text-xs text-zinc-500">
                          Stored alongside the template as policy-qualified
                          tags.
                        </div>
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-surface-border bg-surface px-3 py-3">
                        <input
                          type="checkbox"
                          checked={form.isPublic ?? true}
                          onChange={() =>
                            setForm((f) => ({ ...f, isPublic: !f.isPublic }))
                          }
                          className="rounded border-zinc-600 bg-surface accent-indigo-500"
                        />
                        <div>
                          <div className="text-sm text-zinc-200">
                            Public template
                          </div>
                          <div className="text-xs text-zinc-500">
                            Keep this blueprint available for broad Super Admin
                            use and tier composition.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "staffing" && (
                  <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                    <div className="rounded-2xl border border-surface-border bg-surface-overlay p-4 space-y-4">
                      <div>
                        <label className="text-xs text-zinc-400 mb-1 block">
                          Default Staffing Pattern
                        </label>
                        <input
                          value={staffingPattern}
                          onChange={(e) => setStaffingPattern(e.target.value)}
                          className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                          placeholder="hub-and-spoke, lean-core, distributed-specialists"
                        />
                      </div>
                      <div className="rounded-xl border border-surface-border bg-surface p-3 text-sm text-zinc-400">
                        Use a concise label that describes how staffing should
                        scale when tenants deploy this department model.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-surface-border bg-surface-overlay p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-zinc-600">
                        Current Structure
                      </div>
                      <div className="mt-3 space-y-2">
                        {form.structure
                          .filter((row) => row.name.trim())
                          .map((row, index) => (
                            <div
                              key={`${row.name}-${index}`}
                              className="rounded-xl border border-surface-border bg-surface px-3 py-2"
                            >
                              <div className="text-sm font-medium text-zinc-200">
                                {row.name}
                              </div>
                              <div className="text-xs text-zinc-500 mt-1">
                                {row.headAgentType || "No head role set yet"}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "compatibility" && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">
                        Deployment Compatibility by Tier
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Select the tiers this template is best suited for. This
                        metadata is stored with the template for future
                        governance and curation.
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {tiers.map((tier) => {
                        const isSelected = compatibleTierIds.includes(tier.id);
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            onClick={() =>
                              setCompatibleTierIds((current) =>
                                current.includes(tier.id)
                                  ? current.filter((id) => id !== tier.id)
                                  : [...current, tier.id],
                              )
                            }
                            className={`rounded-2xl border p-4 text-left transition ${
                              isSelected
                                ? "border-indigo-500 bg-indigo-500/10"
                                : "border-surface-border bg-surface-overlay hover:border-indigo-500/40"
                            }`}
                          >
                            <div className="text-sm font-medium text-zinc-200">
                              {tier.name}
                            </div>
                            <div className="text-xs text-zinc-500 mt-1">
                              {tier.description ||
                                "Tier metadata available for compatible deployment."}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {currentWizardStep.id === "review" && (
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-surface-border bg-surface-overlay p-4 space-y-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-zinc-600">
                          Summary
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-surface-border bg-surface p-3">
                            <div className="text-xs text-zinc-500">
                              Template
                            </div>
                            <div className="mt-1 text-sm font-medium text-zinc-200">
                              {form.name || "Untitled template"}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {form.slug || "slug-pending"}
                            </div>
                          </div>
                          <div className="rounded-xl border border-surface-border bg-surface p-3">
                            <div className="text-xs text-zinc-500">
                              Structure Size
                            </div>
                            <div className="mt-1 text-sm font-medium text-zinc-200">
                              {
                                form.structure.filter((row) => row.name.trim())
                                  .length
                              }{" "}
                              departments
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {compatibleTierNames.length > 0
                                ? compatibleTierNames.join(", ")
                                : "No tier compatibility declared"}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-surface-border bg-surface p-3 space-y-2 max-h-[24rem] overflow-y-auto">
                        {form.structure
                          .filter((row) => row.name.trim())
                          .map((row, index) => (
                            <div
                              key={`${row.name}-${index}`}
                              className="rounded-lg border border-surface-border/60 bg-surface-overlay px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium text-zinc-200">
                                    {row.name}
                                  </div>
                                  <div className="text-xs text-zinc-500 mt-1">
                                    {row.parentName
                                      ? `Parent: ${row.parentName}`
                                      : "Top-level department"}
                                  </div>
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {row.headAgentType || "No head role"}
                                </div>
                              </div>
                              {!!row.agentTemplateNames?.length && (
                                <div className="mt-2 text-xs text-zinc-400">
                                  Agents: {row.agentTemplateNames.join(", ")}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-surface-border bg-surface-overlay p-4 space-y-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-zinc-600">
                          Validation
                        </div>
                        <div className="mt-3 space-y-2 text-sm">
                          <div
                            className={`rounded-xl border px-3 py-2 ${form.name.trim() ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-200" : "border-red-800/60 bg-red-500/10 text-red-200"}`}
                          >
                            {form.name.trim() ? "Name set" : "Name missing"}
                          </div>
                          <div
                            className={`rounded-xl border px-3 py-2 ${form.slug.trim() ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-200" : "border-red-800/60 bg-red-500/10 text-red-200"}`}
                          >
                            {form.slug.trim() ? "Slug set" : "Slug missing"}
                          </div>
                          <div
                            className={`rounded-xl border px-3 py-2 ${form.structure.some((row) => row.name.trim()) ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-200" : "border-red-800/60 bg-red-500/10 text-red-200"}`}
                          >
                            {form.structure.some((row) => row.name.trim())
                              ? "Structure ready"
                              : "Add at least one department"}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-surface-border bg-surface p-3 text-sm text-zinc-400">
                        Saving will persist the structure plus wizard metadata
                        for policy tags, staffing pattern, and compatible tiers.
                      </div>
                    </div>
                  </div>
                )}

                {saveError && (
                  <div className="rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
                    {saveError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStepIndex === 0) {
                        setModalOpen(false);
                        return;
                      }
                      goToPreviousWizardStep();
                    }}
                    className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
                  >
                    {wizardStepIndex === 0 ? "Cancel" : "Back"}
                  </button>
                  {wizardStepIndex <
                  DEPARTMENT_TEMPLATE_WIZARD_STEPS.length - 1 ? (
                    <button
                      type="button"
                      onClick={goToNextWizardStep}
                      className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50"
                    >
                      {saving
                        ? "Saving…"
                        : editTarget
                          ? "Save Changes"
                          : "Create Template"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ Delete Confirm ═══════════════ */}
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
                "
                <span className="text-zinc-200 font-medium">
                  {deleteTarget.name}
                </span>
                " will be permanently removed. Departments already deployed from
                this template will not be affected.
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

      {/* ═══════════════ Deploy Modal ═══════════════ */}
      <AnimatePresence>
        {deployTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) =>
              e.target === e.currentTarget &&
              !deploying &&
              setDeployTarget(null)
            }
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
            >
              <h2 className="text-base font-semibold text-zinc-100 mb-1">
                Deploy Department Template
              </h2>
              <p className="text-sm text-zinc-500 mb-5">
                This will create real Department records for the selected tenant
                based on{" "}
                <span className="text-zinc-300 font-medium">
                  "{deployTarget.name}"
                </span>
                .
              </p>

              {/* Template structure preview */}
              <div className="rounded-lg bg-surface-overlay border border-surface-border/50 p-3 mb-5 space-y-1 max-h-36 overflow-y-auto">
                {deployTarget.structure.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <span className="text-zinc-600">
                      {item.parentName ? " └" : "◆"}
                    </span>
                    <span className="text-zinc-300">{item.name}</span>
                    {item.headAgentType && (
                      <span className="text-zinc-600">
                        ({item.headAgentType})
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {!deployResult ? (
                <>
                  {/* Tenant selector */}
                  <div className="mb-4">
                    <label className="text-xs text-zinc-400 mb-1.5 block">
                      Select Target Tenant *
                    </label>
                    <select
                      value={selectedTenant}
                      onChange={(e) => setSelectedTenant(e.target.value)}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">— choose a tenant —</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.slug}) — {t.status}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* With agents toggle */}
                  <label className="flex items-center gap-3 cursor-pointer mb-5">
                    <div
                      onClick={() => setWithAgents((v) => !v)}
                      className={`relative w-10 h-5 rounded-full transition ${withAgents ? "bg-indigo-600" : "bg-zinc-700"}`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${withAgents ? "translate-x-5" : "translate-x-0.5"}`}
                      />
                    </div>
                    <div>
                      <div className="text-sm text-zinc-200">
                        Auto-create head agents
                      </div>
                      <div className="text-xs text-zinc-500">
                        Spawns a lead agent for each department using a matching
                        platform template.
                      </div>
                    </div>
                  </label>

                  {deployError && (
                    <div className="mb-4 rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
                      {deployError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeployTarget(null)}
                      disabled={deploying}
                      className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeploy}
                      disabled={!selectedTenant || deploying}
                      className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50"
                    >
                      {deploying ? "Deploying…" : "Deploy Now"}
                    </button>
                  </div>
                </>
              ) : (
                /* Success state */
                <div className="text-center py-4">
                  <div className="text-green-400 text-3xl mb-3">✓</div>
                  <div className="text-zinc-100 font-semibold mb-1">
                    Deployment Successful
                  </div>
                  <div className="text-sm text-zinc-400 mb-5">
                    Created{" "}
                    <span className="text-zinc-200 font-medium">
                      {deployResult.departments} departments
                    </span>
                    {deployResult.agents > 0 && (
                      <>
                        {" "}
                        and{" "}
                        <span className="text-zinc-200 font-medium">
                          {deployResult.agents} agents
                        </span>
                      </>
                    )}{" "}
                    for the selected tenant.
                  </div>
                  <button
                    onClick={() => setDeployTarget(null)}
                    className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminShell>
  );
}
