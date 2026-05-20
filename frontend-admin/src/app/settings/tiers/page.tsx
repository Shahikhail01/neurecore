"use client";

import { useState } from "react";
import {
  agentTemplatesService,
  type AgentTemplate,
} from "@/services/agentTemplates.service";
import {
  deptTemplatesService,
  type DepartmentTemplate,
} from "@/services/deptTemplates.service";
import { useTierSettings } from "@/hooks/useTierSettings";
import {
  tierCompositionService,
  type TierAgentPoolSlot,
  type TierChangePreview,
  type TierDepartmentPoolSlot,
  type TierSlotType,
  type TenantListItem,
} from "@/services/tierComposition.service";
import type {
  TenantTier,
  TierLimits,
  TierFeature,
  TierPermission,
} from "@/types/settings.types";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const DEFAULT_LIMITS: TierLimits = {
  maxUsers: 5,
  maxAgents: 10,
  maxStorageGB: 10,
  maxApiCalls: 10000,
  maxConversationMessages: 5000,
  maxFileSizeMB: 50,
  allowCustomBranding: false,
  allowApiAccess: false,
  allowSso: false,
  allowAuditExport: false,
};

const AVAILABLE_FEATURES: {
  id: TierFeatureId;
  name: string;
  description: string;
}[] = [
  {
    id: "custom_branding",
    name: "Custom Branding",
    description: "White-label your instance",
  },
  {
    id: "api_access",
    name: "API Access",
    description: "Programmatic access to your data",
  },
  {
    id: "sso",
    name: "Single Sign-On",
    description: "Integrate with your identity provider",
  },
  {
    id: "audit_export",
    name: "Audit Export",
    description: "Export audit logs",
  },
];

type TierFeatureId = "custom_branding" | "api_access" | "sso" | "audit_export";

const FEATURE_LIMIT_KEY: Record<
  TierFeatureId,
  keyof Pick<
    TierLimits,
    "allowCustomBranding" | "allowApiAccess" | "allowSso" | "allowAuditExport"
  >
> = {
  custom_branding: "allowCustomBranding",
  api_access: "allowApiAccess",
  sso: "allowSso",
  audit_export: "allowAuditExport",
};

const NUMERIC_LIMIT_FIELDS: Array<{
  key: keyof Pick<
    TierLimits,
    | "maxUsers"
    | "maxAgents"
    | "maxStorageGB"
    | "maxApiCalls"
    | "maxConversationMessages"
    | "maxFileSizeMB"
  >;
  label: string;
}> = [
  { key: "maxUsers", label: "Max Users" },
  { key: "maxAgents", label: "Max Agents" },
  { key: "maxStorageGB", label: "Max Storage (GB)" },
  { key: "maxApiCalls", label: "Max API Calls" },
  { key: "maxConversationMessages", label: "Max Conversation Messages" },
  { key: "maxFileSizeMB", label: "Max File Size (MB)" },
];

function buildFeaturesFromLimits(limits: TierLimits): TierFeature[] {
  return AVAILABLE_FEATURES.map((feature) => ({
    id: feature.id,
    name: feature.name,
    description: feature.description,
    enabled: limits[FEATURE_LIMIT_KEY[feature.id]],
  }));
}

function normalizeLimits(limits?: Partial<TierLimits>): TierLimits {
  return {
    ...DEFAULT_LIMITS,
    ...limits,
  };
}

function normalizeFeatures(
  features: TierFeature[] | undefined,
  limits: TierLimits,
): TierFeature[] {
  const featureMap = new Map(
    (features ?? []).map((feature) => [feature.id, feature]),
  );

  return AVAILABLE_FEATURES.map((feature) => {
    const existing = featureMap.get(feature.id);
    return {
      id: feature.id,
      name: feature.name,
      description: feature.description,
      enabled: existing?.enabled ?? limits[FEATURE_LIMIT_KEY[feature.id]],
    };
  });
}

interface AgentSlotFormState {
  templateId: string;
  slot: number;
  slotType: TierSlotType;
  isRequired: boolean;
  isDefaultSelected: boolean;
  defaultBudgetPerDay: string;
  defaultModel: string;
}

interface DepartmentSlotFormState {
  departmentTemplateId: string;
  slot: number;
  slotType: TierSlotType;
  isRequired: boolean;
  isDefaultSelected: boolean;
}

type TierWizardStepId =
  | "identity"
  | "commercial"
  | "features"
  | "security"
  | "agent-pool"
  | "department-pool"
  | "preview"
  | "summary";

const TIER_WIZARD_STEPS: Array<{
  id: TierWizardStepId;
  label: string;
  description: string;
}> = [
  {
    id: "identity",
    label: "Identity",
    description: "Define the tier name, slug, status, and description.",
  },
  {
    id: "commercial",
    label: "Commercial",
    description: "Configure pricing and commercial limits.",
  },
  {
    id: "features",
    label: "Features",
    description: "Choose which product capabilities the tier unlocks.",
  },
  {
    id: "security",
    label: "Access Policy",
    description: "Set the access and operator permissions for this tier.",
  },
  {
    id: "agent-pool",
    label: "Agent Pool",
    description: "Review and manage agent composition for the tier.",
  },
  {
    id: "department-pool",
    label: "Department Pool",
    description: "Review and manage department composition for the tier.",
  },
  {
    id: "preview",
    label: "Preview",
    description: "Dry-run tenant impact before assigning this tier.",
  },
  {
    id: "summary",
    label: "Summary",
    description: "Validate the tier configuration before saving.",
  },
];

function createEmptyAgentSlotForm(nextSlot = 1): AgentSlotFormState {
  return {
    templateId: "",
    slot: nextSlot,
    slotType: "CHOICE",
    isRequired: false,
    isDefaultSelected: true,
    defaultBudgetPerDay: "",
    defaultModel: "",
  };
}

function createEmptyDepartmentSlotForm(nextSlot = 1): DepartmentSlotFormState {
  return {
    departmentTemplateId: "",
    slot: nextSlot,
    slotType: "CHOICE",
    isRequired: false,
    isDefaultSelected: true,
  };
}

export default function TierSettingsPage() {
  const {
    tiers,
    loading,
    error,
    refresh,
    createTier,
    updateTier,
    deleteTier,
    toggleTier,
    setDefaultTier,
  } = useTierSettings();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTier, setEditTier] = useState<TenantTier | null>(null);
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    isActive: true,
    isDefault: false,
    sortOrder: 0,
    pricing: {
      monthlyPrice: 0,
      yearlyPrice: 0,
      currency: "USD",
      billingCycle: "monthly" as "monthly" | "yearly",
    },
    limits: DEFAULT_LIMITS,
    features: [] as TierFeature[],
    permissions: [] as TierPermission[],
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TenantTier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [compositionTier, setCompositionTier] = useState<TenantTier | null>(
    null,
  );
  const [compositionOpen, setCompositionOpen] = useState(false);
  const [compositionLoading, setCompositionLoading] = useState(false);
  const [compositionError, setCompositionError] = useState<string | null>(null);
  const [agentPoolSlots, setAgentPoolSlots] = useState<TierAgentPoolSlot[]>([]);
  const [departmentPoolSlots, setDepartmentPoolSlots] = useState<
    TierDepartmentPoolSlot[]
  >([]);
  const [agentTemplates, setAgentTemplates] = useState<AgentTemplate[]>([]);
  const [departmentTemplates, setDepartmentTemplates] = useState<
    DepartmentTemplate[]
  >([]);
  const [agentSlotForm, setAgentSlotForm] = useState<AgentSlotFormState>(
    createEmptyAgentSlotForm(),
  );
  const [departmentSlotForm, setDepartmentSlotForm] =
    useState<DepartmentSlotFormState>(createEmptyDepartmentSlotForm());
  const [editingAgentSlotId, setEditingAgentSlotId] = useState<string | null>(
    null,
  );
  const [editingDepartmentSlotId, setEditingDepartmentSlotId] = useState<
    string | null
  >(null);
  const [agentSlotSaving, setAgentSlotSaving] = useState(false);
  const [departmentSlotSaving, setDepartmentSlotSaving] = useState(false);
  const [reorderingAgentPool, setReorderingAgentPool] = useState(false);
  const [reorderingDepartmentPool, setReorderingDepartmentPool] =
    useState(false);
  const [previewTenants, setPreviewTenants] = useState<TenantListItem[]>([]);
  const [selectedPreviewTenantId, setSelectedPreviewTenantId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<TierChangePreview | null>(
    null,
  );

  function slugify(s: string) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function openCreate() {
    setEditTier(null);
    setWizardStepIndex(0);
    const limits = normalizeLimits(DEFAULT_LIMITS);
    const nextSortOrder = (Array.isArray(tiers) ? tiers.length : 0) + 1;
    const permissions: TierPermission[] = [
      {
        id: "manage_users",
        name: "Manage Users",
        description: "Create and manage users",
        enabled: true,
      },
      {
        id: "manage_agents",
        name: "Manage Agents",
        description: "Create and manage agents",
        enabled: true,
      },
      {
        id: "view_analytics",
        name: "View Analytics",
        description: "View analytics dashboards",
        enabled: true,
      },
      {
        id: "manage_billing",
        name: "Manage Billing",
        description: "Manage subscription",
        enabled: false,
      },
    ];

    setFormData({
      name: "",
      slug: "",
      description: "",
      isActive: true,
      isDefault: false,
      sortOrder: nextSortOrder,
      pricing: {
        monthlyPrice: 0,
        yearlyPrice: 0,
        currency: "USD",
        billingCycle: "monthly",
      },
      limits,
      features: buildFeaturesFromLimits(limits),
      permissions,
    });
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(t: TenantTier) {
    const limits = normalizeLimits(t.limits);
    setEditTier(t);
    setWizardStepIndex(0);
    setFormData({
      name: t.name,
      slug: t.slug,
      description: t.description ?? "",
      isActive: t.isActive,
      isDefault: t.isDefault,
      sortOrder: t.sortOrder,
      pricing: t.pricing,
      limits,
      features: normalizeFeatures(t.features, limits),
      permissions: t.permissions,
    });
    setSaveError(null);
    setModalOpen(true);
  }

  function resetAgentSlotForm(nextSlot = agentPoolSlots.length + 1) {
    setEditingAgentSlotId(null);
    setAgentSlotForm(createEmptyAgentSlotForm(nextSlot));
  }

  function resetDepartmentSlotForm(nextSlot = departmentPoolSlots.length + 1) {
    setEditingDepartmentSlotId(null);
    setDepartmentSlotForm(createEmptyDepartmentSlotForm(nextSlot));
  }

  async function loadTierComposition(tierId: string) {
    const [
      agentSlots,
      deptSlots,
      agentTemplateResult,
      departmentTemplateResult,
      tenantResult,
    ] = await Promise.all([
      tierCompositionService.listAgentPool(tierId),
      tierCompositionService.listDepartmentPool(tierId),
      agentTemplatesService.list({ limit: 100 }),
      deptTemplatesService.list({ limit: 100 }),
      tierCompositionService.listTenants(100),
    ]);

    setAgentPoolSlots(agentSlots);
    setDepartmentPoolSlots(deptSlots);
    setAgentTemplates(agentTemplateResult.items);
    setDepartmentTemplates(departmentTemplateResult.items);
    setPreviewTenants(tenantResult);
    resetAgentSlotForm(agentSlots.length + 1);
    resetDepartmentSlotForm(deptSlots.length + 1);
  }

  async function openComposition(tier: TenantTier) {
    setCompositionTier(tier);
    setCompositionOpen(true);
    setCompositionLoading(true);
    setCompositionError(null);
    setSelectedPreviewTenantId("");
    setPreviewError(null);
    setPreviewResult(null);

    try {
      await loadTierComposition(tier.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load tier composition";
      setCompositionError(message);
      toast.error(message);
    } finally {
      setCompositionLoading(false);
    }
  }

  async function refreshComposition() {
    if (!compositionTier) return;
    setCompositionLoading(true);
    setCompositionError(null);
    setPreviewError(null);
    setPreviewResult(null);
    try {
      await loadTierComposition(compositionTier.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to refresh composition";
      setCompositionError(message);
      toast.error(message);
    } finally {
      setCompositionLoading(false);
    }
  }

  function startEditAgentSlot(slot: TierAgentPoolSlot) {
    setEditingAgentSlotId(slot.id);
    setAgentSlotForm({
      templateId: slot.templateId,
      slot: slot.slot,
      slotType: slot.slotType,
      isRequired: slot.isRequired,
      isDefaultSelected: slot.isDefaultSelected,
      defaultBudgetPerDay:
        slot.defaultBudgetPerDay !== undefined
          ? String(slot.defaultBudgetPerDay)
          : "",
      defaultModel: slot.defaultModel ?? "",
    });
  }

  function startEditDepartmentSlot(slot: TierDepartmentPoolSlot) {
    setEditingDepartmentSlotId(slot.id);
    setDepartmentSlotForm({
      departmentTemplateId: slot.departmentTemplateId,
      slot: slot.slot,
      slotType: slot.slotType,
      isRequired: slot.isRequired,
      isDefaultSelected: slot.isDefaultSelected,
    });
  }

  async function handleSaveAgentSlot() {
    if (!compositionTier) return;
    if (!agentSlotForm.templateId) {
      toast.error("Select an agent template first");
      return;
    }

    setAgentSlotSaving(true);
    try {
      const payload = {
        templateId: agentSlotForm.templateId,
        slot: agentSlotForm.slot,
        slotType: agentSlotForm.slotType,
        isRequired: agentSlotForm.isRequired,
        isDefaultSelected: agentSlotForm.isDefaultSelected,
        defaultBudgetPerDay: agentSlotForm.defaultBudgetPerDay
          ? Number(agentSlotForm.defaultBudgetPerDay)
          : undefined,
        defaultModel: agentSlotForm.defaultModel || undefined,
      };

      if (editingAgentSlotId) {
        await tierCompositionService.updateAgentPoolSlot(
          compositionTier.id,
          editingAgentSlotId,
          payload,
        );
        toast.success("Agent pool slot updated");
      } else {
        await tierCompositionService.createAgentPoolSlot(
          compositionTier.id,
          payload,
        );
        toast.success("Agent pool slot added");
      }

      await refreshComposition();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save agent slot",
      );
    } finally {
      setAgentSlotSaving(false);
    }
  }

  async function handleDeleteAgentSlot(slotId: string) {
    if (!compositionTier) return;
    try {
      await tierCompositionService.deleteAgentPoolSlot(
        compositionTier.id,
        slotId,
      );
      toast.success("Agent pool slot removed");
      await refreshComposition();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove agent slot",
      );
    }
  }

  async function handleReorderAgentSlot(slotId: string, direction: -1 | 1) {
    if (!compositionTier || reorderingAgentPool) return;

    const currentIndex = agentPoolSlots.findIndex((slot) => slot.id === slotId);
    const targetIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= agentPoolSlots.length
    ) {
      return;
    }

    const reordered = [...agentPoolSlots];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setReorderingAgentPool(true);
    try {
      await tierCompositionService.reorderAgentPool(
        compositionTier.id,
        reordered.map((slot) => slot.id),
      );
      toast.success("Agent pool order updated");
      await refreshComposition();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reorder agent pool",
      );
    } finally {
      setReorderingAgentPool(false);
    }
  }

  async function handleSaveDepartmentSlot() {
    if (!compositionTier) return;
    if (!departmentSlotForm.departmentTemplateId) {
      toast.error("Select a department template first");
      return;
    }

    setDepartmentSlotSaving(true);
    try {
      const payload = {
        departmentTemplateId: departmentSlotForm.departmentTemplateId,
        slot: departmentSlotForm.slot,
        slotType: departmentSlotForm.slotType,
        isRequired: departmentSlotForm.isRequired,
        isDefaultSelected: departmentSlotForm.isDefaultSelected,
      };

      if (editingDepartmentSlotId) {
        await tierCompositionService.updateDepartmentPoolSlot(
          compositionTier.id,
          editingDepartmentSlotId,
          payload,
        );
        toast.success("Department pool slot updated");
      } else {
        await tierCompositionService.createDepartmentPoolSlot(
          compositionTier.id,
          payload,
        );
        toast.success("Department pool slot added");
      }

      await refreshComposition();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save department slot",
      );
    } finally {
      setDepartmentSlotSaving(false);
    }
  }

  async function handleDeleteDepartmentSlot(slotId: string) {
    if (!compositionTier) return;
    try {
      await tierCompositionService.deleteDepartmentPoolSlot(
        compositionTier.id,
        slotId,
      );
      toast.success("Department pool slot removed");
      await refreshComposition();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove department slot",
      );
    }
  }

  async function handleReorderDepartmentSlot(
    slotId: string,
    direction: -1 | 1,
  ) {
    if (!compositionTier || reorderingDepartmentPool) return;

    const currentIndex = departmentPoolSlots.findIndex(
      (slot) => slot.id === slotId,
    );
    const targetIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= departmentPoolSlots.length
    ) {
      return;
    }

    const reordered = [...departmentPoolSlots];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setReorderingDepartmentPool(true);
    try {
      await tierCompositionService.reorderDepartmentPool(
        compositionTier.id,
        reordered.map((slot) => slot.id),
      );
      toast.success("Department pool order updated");
      await refreshComposition();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to reorder department pool",
      );
    } finally {
      setReorderingDepartmentPool(false);
    }
  }

  async function handlePreviewTenantImpact() {
    if (!compositionTier) return;
    if (!selectedPreviewTenantId) {
      setPreviewError("Select a tenant to preview tier deployment impact");
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const preview = await tierCompositionService.previewTenantTierDeployment(
        selectedPreviewTenantId,
        compositionTier.id,
      );
      setPreviewResult(preview);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load preview";
      setPreviewError(message);
      setPreviewResult(null);
      toast.error(message);
    } finally {
      setPreviewLoading(false);
    }
  }

  function buildTierPayload() {
    return {
      name: formData.name,
      slug: editTier ? formData.slug : formData.slug.trim(),
      description: formData.description,
      isActive: formData.isActive,
      isDefault: formData.isDefault,
      sortOrder: formData.sortOrder,
      pricing: formData.pricing,
      limits: formData.limits,
      features: formData.features,
      permissions: formData.permissions,
    };
  }

  async function loadWizardTierResources(tier: TenantTier) {
    setCompositionTier(tier);
    setCompositionLoading(true);
    setCompositionError(null);
    try {
      await loadTierComposition(tier.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load tier composition";
      setCompositionError(message);
      toast.error(message);
      throw err;
    } finally {
      setCompositionLoading(false);
    }
  }

  async function createTierDraft() {
    if (editTier) return editTier;

    const createdTier = await createTier(buildTierPayload());
    const limits = normalizeLimits(createdTier.limits);

    setEditTier(createdTier);
    setFormData((current) => ({
      ...current,
      slug: createdTier.slug,
      features: normalizeFeatures(createdTier.features, limits),
      permissions: createdTier.permissions,
      limits,
      pricing: createdTier.pricing,
    }));
    await loadWizardTierResources(createdTier);
    toast.success(
      `Tier "${createdTier.name}" created. Continue configuring composition.`,
    );
    return createdTier;
  }

  function validateWizardStep(stepIndex: number) {
    if (!formData.name.trim()) {
      setSaveError("Name is required");
      return false;
    }

    if (!editTier && !formData.slug.trim()) {
      setSaveError("Slug is required");
      return false;
    }

    if (stepIndex === 1) {
      const numericFields = NUMERIC_LIMIT_FIELDS.map((field) => field.key);
      const invalidLimit = numericFields.some((key) =>
        Number.isNaN(Number(formData.limits[key])),
      );
      if (invalidLimit) {
        setSaveError("All limits must be valid numbers");
        return false;
      }
    }

    setSaveError(null);
    return true;
  }

  async function handleWizardNext() {
    if (!validateWizardStep(wizardStepIndex)) return;

    try {
      if (wizardStepIndex === 3) {
        if (editTier) {
          await loadWizardTierResources(editTier);
        } else {
          await createTierDraft();
        }
      }

      setWizardStepIndex((current) =>
        Math.min(current + 1, TIER_WIZARD_STEPS.length - 1),
      );
    } catch {
      return;
    }
  }

  function handleWizardBack() {
    setSaveError(null);
    setWizardStepIndex((current) => Math.max(current - 1, 0));
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setSaveError("Name is required");
      return;
    }
    if (!editTier && !formData.slug.trim()) {
      setSaveError("Slug is required");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const payload = buildTierPayload();

      if (editTier) {
        await updateTier(editTier.id, payload);
        toast.success(`Tier "${formData.name}" updated successfully`);
      } else {
        await createTier(payload);
        toast.success(`Tier "${formData.name}" created successfully`);
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Save failed";
      setSaveError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTier(deleteTarget.id);
      toast.success(`Tier "${deleteTarget.name}" deleted successfully`);
      setDeleteTarget(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Delete failed";
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  }

  function toggleFeature(featureId: TierFeatureId) {
    setFormData((f) => ({
      ...f,
      limits: {
        ...f.limits,
        [FEATURE_LIMIT_KEY[featureId]]: !f.limits[FEATURE_LIMIT_KEY[featureId]],
      },
      features: f.features.map((feat) =>
        feat.id === featureId ? { ...feat, enabled: !feat.enabled } : feat,
      ),
    }));
  }

  function updateLimit<K extends keyof TierLimits>(
    key: K,
    value: TierLimits[K],
  ) {
    setFormData((f) => {
      const limits = {
        ...f.limits,
        [key]: value,
      };

      return {
        ...f,
        limits,
        features: normalizeFeatures(f.features, limits),
      };
    });
  }

  function togglePermission(permId: string) {
    setFormData((f) => ({
      ...f,
      permissions: f.permissions.map((perm) =>
        perm.id === permId ? { ...perm, enabled: !perm.enabled } : perm,
      ),
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Loading tiers...</div>
      </div>
    );
  }

  const safeTiers = Array.isArray(tiers) ? tiers : [];
  const availableAgentTemplates = agentTemplates.filter((template) =>
    editingAgentSlotId
      ? !agentPoolSlots.some(
          (slot) =>
            slot.templateId === template.id && slot.id !== editingAgentSlotId,
        )
      : !agentPoolSlots.some((slot) => slot.templateId === template.id),
  );
  const availableDepartmentTemplates = departmentTemplates.filter((template) =>
    editingDepartmentSlotId
      ? !departmentPoolSlots.some(
          (slot) =>
            slot.departmentTemplateId === template.id &&
            slot.id !== editingDepartmentSlotId,
        )
      : !departmentPoolSlots.some(
          (slot) => slot.departmentTemplateId === template.id,
        ),
  );
  const currentWizardStep = TIER_WIZARD_STEPS[wizardStepIndex];
  const enabledFeatures = formData.features.filter(
    (feature) => feature.enabled,
  );
  const enabledPermissions = formData.permissions.filter(
    (permission) => permission.enabled,
  );
  const wizardTier = editTier;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Tenant Tiers</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Configure subscription tiers with custom limits and features
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="px-3 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
          >
            + Add Tier
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-950 border border-red-800 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Tier Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {safeTiers.length === 0 ? (
            <div className="col-span-full text-center py-12 text-zinc-500">
              <p>No tiers configured</p>
              <p className="text-sm mt-1">Add a tier to get started</p>
            </div>
          ) : (
            safeTiers
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((tier) => {
                const safeFeatures = Array.isArray(tier.features)
                  ? tier.features
                  : [];
                return (
                  <motion.div
                    key={tier.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-zinc-100">
                            {tier.name}
                          </h3>
                          {tier.isDefault && (
                            <span className="rounded-full bg-indigo-900 text-indigo-300 text-xs px-2 py-0.5">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-500 mt-0.5 line-clamp-2">
                          {tier.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                          <span className="rounded-full border border-zinc-800 px-2 py-0.5">
                            Slug: {tier.slug}
                          </span>
                          <span className="rounded-full border border-zinc-800 px-2 py-0.5">
                            Sort #{tier.sortOrder}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          tier.isActive
                            ? "bg-green-900 text-green-300"
                            : "bg-zinc-700 text-zinc-400"
                        }`}
                      >
                        {tier.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {/* Pricing */}
                    <div className="mb-3 p-2 rounded-lg bg-zinc-800/50">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-semibold text-zinc-100">
                          ${tier.pricing?.monthlyPrice ?? 0}
                        </span>
                        <span className="text-xs text-zinc-500">/month</span>
                      </div>
                      {(tier.pricing?.yearlyPrice ?? 0) > 0 && (
                        <div className="text-xs text-zinc-500">
                          or ${tier.pricing?.yearlyPrice ?? 0}/year
                        </div>
                      )}
                    </div>

                    {/* Limits Summary */}
                    <div className="mb-3 rounded-lg bg-zinc-800/30 p-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Limits
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                        <div>Users: {tier.limits?.maxUsers ?? 0}</div>
                        <div>Agents: {tier.limits?.maxAgents ?? 0}</div>
                        <div>Storage: {tier.limits?.maxStorageGB ?? 0} GB</div>
                        <div>Files: {tier.limits?.maxFileSizeMB ?? 0} MB</div>
                        <div>API Calls: {tier.limits?.maxApiCalls ?? 0}</div>
                        <div>
                          Messages: {tier.limits?.maxConversationMessages ?? 0}
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="mb-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Features
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {safeFeatures
                          .filter((f) => f.enabled)
                          .slice(0, 4)
                          .map((feature) => (
                            <span
                              key={feature.id}
                              className="rounded-full bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5"
                            >
                              {feature.name}
                            </span>
                          ))}
                        {safeFeatures.filter((f) => f.enabled).length > 4 && (
                          <span className="text-xs text-zinc-500">
                            +{safeFeatures.filter((f) => f.enabled).length - 4}{" "}
                            more
                          </span>
                        )}
                        {safeFeatures.filter((f) => f.enabled).length === 0 && (
                          <span className="text-xs text-zinc-500">
                            No optional features enabled
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-auto pt-3 border-t border-zinc-800">
                      <button
                        onClick={() => void openComposition(tier)}
                        className="flex-1 py-1.5 rounded-lg border border-indigo-800 bg-indigo-950/40 text-xs text-indigo-300 hover:bg-indigo-900/50 transition"
                      >
                        Composition
                      </button>
                      {!tier.isDefault && (
                        <button
                          onClick={() => setDefaultTier(tier.id)}
                          className="flex-1 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:bg-zinc-800 transition"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => toggleTier(tier.id, !tier.isActive)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          tier.isActive
                            ? "bg-yellow-900 text-yellow-300 hover:bg-yellow-800"
                            : "bg-green-900 text-green-300 hover:bg-green-800"
                        }`}
                      >
                        {tier.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => openEdit(tier)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:bg-zinc-800 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(tier)}
                        className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                );
              })
          )}
        </AnimatePresence>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 overflow-y-auto py-8"
            onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-5xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    {wizardTier
                      ? `Tier Wizard: ${wizardTier.name}`
                      : "Tier Wizard"}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {currentWizardStep.description}
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition"
                >
                  Close
                </button>
              </div>

              <div className="mb-6 grid gap-3 md:grid-cols-4">
                {TIER_WIZARD_STEPS.map((step, index) => {
                  const isActive = index === wizardStepIndex;
                  const isComplete = index < wizardStepIndex;

                  return (
                    <div
                      key={step.id}
                      className={`rounded-xl border px-4 py-3 ${
                        isActive
                          ? "border-indigo-500 bg-indigo-950/40"
                          : isComplete
                            ? "border-emerald-800 bg-emerald-950/20"
                            : "border-zinc-800 bg-zinc-950/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          Step {index + 1}
                        </span>
                        <span
                          className={`text-xs ${
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

              <div className="max-h-[70vh] overflow-y-auto pr-2">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
                  {currentWizardStep.id === "identity" && (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            Name *
                          </label>
                          <input
                            value={formData.name}
                            onChange={(e) =>
                              setFormData((f) => ({
                                ...f,
                                name: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                            placeholder="Enterprise"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            Slug{" "}
                            {wizardTier && (
                              <span className="text-zinc-600">(locked)</span>
                            )}
                          </label>
                          <input
                            value={formData.slug}
                            onChange={(e) =>
                              !wizardTier &&
                              setFormData((f) => ({
                                ...f,
                                slug: slugify(e.target.value),
                              }))
                            }
                            readOnly={!!wizardTier}
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            placeholder="tier-enterprise"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <label className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-3 text-sm text-zinc-300">
                          <span className="mb-2 block text-xs text-zinc-500">
                            Active
                          </span>
                          <input
                            type="checkbox"
                            checked={formData.isActive}
                            onChange={(e) =>
                              setFormData((f) => ({
                                ...f,
                                isActive: e.target.checked,
                              }))
                            }
                            className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500"
                          />
                        </label>
                        <label className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-3 text-sm text-zinc-300">
                          <span className="mb-2 block text-xs text-zinc-500">
                            Default
                          </span>
                          <input
                            type="checkbox"
                            checked={formData.isDefault}
                            onChange={(e) =>
                              setFormData((f) => ({
                                ...f,
                                isDefault: e.target.checked,
                              }))
                            }
                            className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500"
                          />
                        </label>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            Sort Order
                          </label>
                          <input
                            type="number"
                            value={formData.sortOrder}
                            onChange={(e) =>
                              setFormData((f) => ({
                                ...f,
                                sortOrder: parseInt(e.target.value) || 0,
                              }))
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-zinc-400">
                          Description
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) =>
                            setFormData((f) => ({
                              ...f,
                              description: e.target.value,
                            }))
                          }
                          rows={4}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                          placeholder="Full-featured tier for large organizations"
                        />
                      </div>
                    </div>
                  )}

                  {currentWizardStep.id === "commercial" && (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            Monthly Price
                          </label>
                          <input
                            type="number"
                            value={formData.pricing.monthlyPrice}
                            onChange={(e) =>
                              setFormData((f) => ({
                                ...f,
                                pricing: {
                                  ...f.pricing,
                                  monthlyPrice: parseFloat(e.target.value) || 0,
                                },
                              }))
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            Yearly Price
                          </label>
                          <input
                            type="number"
                            value={formData.pricing.yearlyPrice}
                            onChange={(e) =>
                              setFormData((f) => ({
                                ...f,
                                pricing: {
                                  ...f.pricing,
                                  yearlyPrice: parseFloat(e.target.value) || 0,
                                },
                              }))
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            Currency
                          </label>
                          <select
                            value={formData.pricing.currency}
                            onChange={(e) =>
                              setFormData((f) => ({
                                ...f,
                                pricing: {
                                  ...f.pricing,
                                  currency: e.target.value,
                                },
                              }))
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {NUMERIC_LIMIT_FIELDS.map((field) => (
                          <div key={field.key}>
                            <label className="mb-1 block text-xs text-zinc-400">
                              {field.label}
                            </label>
                            <input
                              type="number"
                              value={formData.limits[field.key]}
                              onChange={(e) =>
                                updateLimit(
                                  field.key,
                                  (parseInt(e.target.value) ||
                                    0) as TierLimits[typeof field.key],
                                )
                              }
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentWizardStep.id === "features" && (
                    <div className="space-y-3">
                      {formData.features.map((feature) => (
                        <label
                          key={feature.id}
                          className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={feature.enabled}
                            onChange={() => toggleFeature(feature.id)}
                            className="mt-1 rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500"
                          />
                          <div>
                            <div className="text-sm font-medium text-zinc-200">
                              {feature.name}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {feature.description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {currentWizardStep.id === "security" && (
                    <div className="space-y-3">
                      {formData.permissions.map((permission) => (
                        <label
                          key={permission.id}
                          className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={permission.enabled}
                            onChange={() => togglePermission(permission.id)}
                            className="mt-1 rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500"
                          />
                          <div>
                            <div className="text-sm font-medium text-zinc-200">
                              {permission.name}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {permission.description}
                            </div>
                          </div>
                        </label>
                      ))}

                      {!wizardTier && (
                        <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                          The base tier record will be created when you continue
                          into composition so agent pools, department pools, and
                          tenant preview can target a real tier id.
                        </div>
                      )}
                    </div>
                  )}

                  {currentWizardStep.id === "agent-pool" && (
                    <div className="space-y-4">
                      {compositionLoading ? (
                        <div className="rounded-xl border border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                          Loading agent composition...
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                              <div className="text-xs text-zinc-500">
                                Total Slots
                              </div>
                              <div className="mt-1 text-lg font-semibold text-zinc-100">
                                {agentPoolSlots.length}
                              </div>
                            </div>
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                              <div className="text-xs text-zinc-500">
                                Fixed Slots
                              </div>
                              <div className="mt-1 text-lg font-semibold text-zinc-100">
                                {
                                  agentPoolSlots.filter(
                                    (slot) => slot.slotType === "FIXED",
                                  ).length
                                }
                              </div>
                            </div>
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                              <div className="text-xs text-zinc-500">
                                Choice Slots
                              </div>
                              <div className="mt-1 text-lg font-semibold text-zinc-100">
                                {
                                  agentPoolSlots.filter(
                                    (slot) => slot.slotType === "CHOICE",
                                  ).length
                                }
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-zinc-100">
                                  Agent Composition
                                </div>
                                <div className="text-xs text-zinc-500">
                                  Manage detailed slot creation, editing, and
                                  reorder in the composition manager.
                                </div>
                              </div>
                              {wizardTier && (
                                <button
                                  onClick={() =>
                                    void openComposition(wizardTier)
                                  }
                                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                                >
                                  Open Composition Manager
                                </button>
                              )}
                            </div>

                            {agentPoolSlots.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                                No agent pool slots configured yet.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {agentPoolSlots.map((slot) => (
                                  <div
                                    key={slot.id}
                                    className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium text-zinc-100">
                                        {slot.templateName}
                                      </span>
                                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                                        Slot {slot.slot}
                                      </span>
                                      <span className="rounded-full bg-indigo-950/60 px-2 py-0.5 text-[11px] text-indigo-300">
                                        {slot.slotType}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {currentWizardStep.id === "department-pool" && (
                    <div className="space-y-4">
                      {compositionLoading ? (
                        <div className="rounded-xl border border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                          Loading department composition...
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                              <div className="text-xs text-zinc-500">
                                Total Slots
                              </div>
                              <div className="mt-1 text-lg font-semibold text-zinc-100">
                                {departmentPoolSlots.length}
                              </div>
                            </div>
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                              <div className="text-xs text-zinc-500">
                                Fixed Slots
                              </div>
                              <div className="mt-1 text-lg font-semibold text-zinc-100">
                                {
                                  departmentPoolSlots.filter(
                                    (slot) => slot.slotType === "FIXED",
                                  ).length
                                }
                              </div>
                            </div>
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                              <div className="text-xs text-zinc-500">
                                Choice Slots
                              </div>
                              <div className="mt-1 text-lg font-semibold text-zinc-100">
                                {
                                  departmentPoolSlots.filter(
                                    (slot) => slot.slotType === "CHOICE",
                                  ).length
                                }
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-zinc-100">
                                  Department Composition
                                </div>
                                <div className="text-xs text-zinc-500">
                                  Manage detailed department slot policies in
                                  the composition manager.
                                </div>
                              </div>
                              {wizardTier && (
                                <button
                                  onClick={() =>
                                    void openComposition(wizardTier)
                                  }
                                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                                >
                                  Open Composition Manager
                                </button>
                              )}
                            </div>

                            {departmentPoolSlots.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                                No department pool slots configured yet.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {departmentPoolSlots.map((slot) => (
                                  <div
                                    key={slot.id}
                                    className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium text-zinc-100">
                                        {slot.departmentTemplate.name}
                                      </span>
                                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                                        Slot {slot.slot}
                                      </span>
                                      <span className="rounded-full bg-indigo-950/60 px-2 py-0.5 text-[11px] text-indigo-300">
                                        {slot.slotType}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {currentWizardStep.id === "preview" && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-100">
                            Dry-Run Tenant Impact
                          </h3>
                          <p className="text-xs text-zinc-500">
                            Preview what this tier would add, preserve, or push
                            out of policy for a specific tenant.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={selectedPreviewTenantId}
                            onChange={(e) => {
                              setSelectedPreviewTenantId(e.target.value);
                              setPreviewError(null);
                              setPreviewResult(null);
                            }}
                            className="min-w-[240px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                          >
                            <option value="">Select tenant</option>
                            {previewTenants.map((tenant) => (
                              <option key={tenant.id} value={tenant.id}>
                                {tenant.name}
                                {tenant.tier ? ` (${tenant.tier.name})` : ""}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => void handlePreviewTenantImpact()}
                            disabled={previewLoading || !wizardTier}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                          >
                            {previewLoading ? "Previewing..." : "Run Preview"}
                          </button>
                        </div>
                      </div>

                      {previewError && (
                        <div className="rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
                          {previewError}
                        </div>
                      )}

                      {previewResult ? (
                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                            <div className="text-xs text-zinc-500">Tenant</div>
                            <div className="mt-1 text-sm font-medium text-zinc-100">
                              {previewResult.tenantName}
                            </div>
                          </div>
                          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                            <div className="text-xs text-zinc-500">
                              Tier Change
                            </div>
                            <div className="mt-1 text-sm font-medium text-zinc-100">
                              {previewResult.currentTier.name} -&gt;{" "}
                              {previewResult.targetTier.name}
                            </div>
                          </div>
                          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                            <div className="text-xs text-zinc-500">
                              Selected Agents
                            </div>
                            <div className="mt-1 text-sm font-medium text-zinc-100">
                              {previewResult.usage.selectedAgents} /{" "}
                              {previewResult.targetTier.maxAgents}
                            </div>
                          </div>
                          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                            <div className="text-xs text-zinc-500">
                              Compatibility
                            </div>
                            <div
                              className={`mt-1 text-sm font-medium ${
                                previewResult.compatibility.canChange
                                  ? "text-emerald-300"
                                  : "text-red-300"
                              }`}
                            >
                              {previewResult.compatibility.canChange
                                ? "Can change tier"
                                : "Blocked"}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                          Select a tenant and run a preview to inspect tier
                          deployment impact.
                        </div>
                      )}
                    </div>
                  )}

                  {currentWizardStep.id === "summary" && (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                          <div className="text-xs text-zinc-500">Tier</div>
                          <div className="mt-1 text-sm font-semibold text-zinc-100">
                            {formData.name || "Unnamed tier"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                          <div className="text-xs text-zinc-500">
                            Enabled Features
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-100">
                            {enabledFeatures.length}
                          </div>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                          <div className="text-xs text-zinc-500">
                            Permissions
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-100">
                            {enabledPermissions.length}
                          </div>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                          <div className="text-xs text-zinc-500">
                            Composition
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-100">
                            {agentPoolSlots.length} agents /{" "}
                            {departmentPoolSlots.length} departments
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
                        <div className="mb-2 font-medium text-zinc-100">
                          Validation Summary
                        </div>
                        <ul className="space-y-2 text-sm text-zinc-400">
                          <li>Name: {formData.name || "Missing"}</li>
                          <li>Slug: {formData.slug || "Missing"}</li>
                          <li>
                            Monthly price: {formData.pricing.currency}{" "}
                            {formData.pricing.monthlyPrice}
                          </li>
                          <li>
                            Preview run: {previewResult ? "Yes" : "Not yet"}
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {compositionError &&
                  (currentWizardStep.id === "agent-pool" ||
                    currentWizardStep.id === "department-pool") && (
                    <div className="mt-4 rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
                      {compositionError}
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
                        : handleWizardBack()
                    }
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition"
                  >
                    {wizardStepIndex === 0 ? "Cancel" : "Back"}
                  </button>
                  <div className="flex items-center gap-3">
                    {wizardTier && (
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save Draft"}
                      </button>
                    )}
                    {wizardStepIndex < TIER_WIZARD_STEPS.length - 1 ? (
                      <button
                        onClick={() => void handleWizardNext()}
                        disabled={saving}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition disabled:opacity-50"
                      >
                        {!wizardTier && currentWizardStep.id === "security"
                          ? "Create Draft and Continue"
                          : "Continue"}
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition disabled:opacity-50"
                      >
                        {saving
                          ? "Saving..."
                          : wizardTier
                            ? "Save Tier"
                            : "Create Tier"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composition Modal */}
      <AnimatePresence>
        {compositionOpen && compositionTier && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-8"
            onClick={(e) =>
              e.target === e.currentTarget && setCompositionOpen(false)
            }
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-6xl rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    Tier Composition: {compositionTier.name}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Manage agent and department pool slots for this tier.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void refreshComposition()}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={() => setCompositionOpen(false)}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition"
                  >
                    Close
                  </button>
                </div>
              </div>

              {compositionError && (
                <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
                  {compositionError}
                </div>
              )}

              {compositionLoading ? (
                <div className="flex h-64 items-center justify-center text-zinc-500">
                  Loading composition...
                </div>
              ) : (
                <div className="space-y-6">
                  <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100">
                          Dry-Run Tenant Impact
                        </h3>
                        <p className="text-xs text-zinc-500">
                          Preview what this tier would add, preserve, or push
                          out of policy for a specific tenant before changing
                          tiers.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={selectedPreviewTenantId}
                          onChange={(e) => {
                            setSelectedPreviewTenantId(e.target.value);
                            setPreviewError(null);
                            setPreviewResult(null);
                          }}
                          className="min-w-[240px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                        >
                          <option value="">Select tenant</option>
                          {previewTenants.map((tenant) => (
                            <option key={tenant.id} value={tenant.id}>
                              {tenant.name}
                              {tenant.tier ? ` (${tenant.tier.name})` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => void handlePreviewTenantImpact()}
                          disabled={previewLoading}
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                          {previewLoading ? "Previewing..." : "Run Preview"}
                        </button>
                      </div>
                    </div>

                    {previewError && (
                      <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
                        {previewError}
                      </div>
                    )}

                    {previewResult ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                            <div className="text-xs text-zinc-500">Tenant</div>
                            <div className="mt-1 text-sm font-medium text-zinc-100">
                              {previewResult.tenantName}
                            </div>
                          </div>
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                            <div className="text-xs text-zinc-500">
                              Tier Change
                            </div>
                            <div className="mt-1 text-sm font-medium text-zinc-100">
                              {previewResult.currentTier.name} -&gt;{" "}
                              {previewResult.targetTier.name}
                            </div>
                          </div>
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                            <div className="text-xs text-zinc-500">
                              Selected Agents
                            </div>
                            <div className="mt-1 text-sm font-medium text-zinc-100">
                              {previewResult.usage.selectedAgents} /{" "}
                              {previewResult.targetTier.maxAgents}
                            </div>
                          </div>
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                            <div className="text-xs text-zinc-500">
                              Compatibility
                            </div>
                            <div
                              className={`mt-1 text-sm font-medium ${
                                previewResult.compatibility.canChange
                                  ? "text-emerald-300"
                                  : "text-red-300"
                              }`}
                            >
                              {previewResult.compatibility.canChange
                                ? "Can change tier"
                                : "Blocked"}
                            </div>
                          </div>
                        </div>

                        {!previewResult.compatibility.canChange && (
                          <div className="rounded-lg border border-red-800 bg-red-950/60 p-3 text-sm text-red-300">
                            {previewResult.compatibility.blockingReasons.join(
                              " ",
                            )}
                          </div>
                        )}

                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                            <div className="mb-2 text-sm font-medium text-zinc-100">
                              Would Provision
                            </div>
                            <div className="space-y-3 text-sm text-zinc-300">
                              <div>
                                <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                                  Agents
                                </div>
                                {previewResult.impact.agentsToProvision
                                  .length === 0 ? (
                                  <div className="text-zinc-500">
                                    No fixed agent templates would be added.
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {previewResult.impact.agentsToProvision.map(
                                      (item) => (
                                        <div
                                          key={item.templateId}
                                          className="rounded border border-zinc-800 px-2 py-1"
                                        >
                                          {item.templateName} ({item.slotType})
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                                  Departments
                                </div>
                                {previewResult.impact.departmentsToProvision
                                  .length === 0 ? (
                                  <div className="text-zinc-500">
                                    No fixed department templates would be
                                    added.
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {previewResult.impact.departmentsToProvision.map(
                                      (item) => (
                                        <div
                                          key={item.templateId}
                                          className="rounded border border-zinc-800 px-2 py-1"
                                        >
                                          {item.templateName} ({item.slotType})
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                            <div className="mb-2 text-sm font-medium text-zinc-100">
                              Outside Target Policy
                            </div>
                            <div className="space-y-3 text-sm text-zinc-300">
                              <div>
                                <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                                  Tier-linked Agents
                                </div>
                                {previewResult.impact
                                  .tierLinkedAgentsOutsideTargetPolicy
                                  .length === 0 ? (
                                  <div className="text-zinc-500">
                                    No tier-linked agents would fall out of
                                    policy.
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {previewResult.impact.tierLinkedAgentsOutsideTargetPolicy.map(
                                      (item) => (
                                        <div
                                          key={item.id}
                                          className="rounded border border-zinc-800 px-2 py-1"
                                        >
                                          {item.name}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                                  Tier-linked Departments
                                </div>
                                {previewResult.impact
                                  .tierLinkedDepartmentsOutsideTargetPolicy
                                  .length === 0 ? (
                                  <div className="text-zinc-500">
                                    No tier-linked departments would fall out of
                                    policy.
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {previewResult.impact.tierLinkedDepartmentsOutsideTargetPolicy.map(
                                      (item) => (
                                        <div
                                          key={item.id}
                                          className="rounded border border-zinc-800 px-2 py-1"
                                        >
                                          {item.name}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                        Select a tenant and run a preview to inspect tier
                        deployment impact.
                      </div>
                    )}
                  </section>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-100">
                            Agent Pool Slots
                          </h3>
                          <p className="text-xs text-zinc-500">
                            Fixed and choice agent templates available in this
                            tier.
                          </p>
                        </div>
                        <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
                          {agentPoolSlots.length} slots
                        </span>
                      </div>

                      <div className="mb-4 space-y-3">
                        {agentPoolSlots.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                            No agent pool slots configured yet.
                          </div>
                        ) : (
                          agentPoolSlots.map((slot, index) => (
                            <div
                              key={slot.id}
                              className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-zinc-100">
                                      {slot.templateName}
                                    </span>
                                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                                      Slot {slot.slot}
                                    </span>
                                    <span className="rounded-full bg-indigo-950/60 px-2 py-0.5 text-[11px] text-indigo-300">
                                      {slot.slotType}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                                    <span>
                                      Required: {slot.isRequired ? "Yes" : "No"}
                                    </span>
                                    <span>
                                      Default:{" "}
                                      {slot.isDefaultSelected ? "Yes" : "No"}
                                    </span>
                                    {slot.defaultBudgetPerDay !== undefined && (
                                      <span>
                                        Budget/day: {slot.defaultBudgetPerDay}
                                      </span>
                                    )}
                                    {slot.defaultModel && (
                                      <span>Model: {slot.defaultModel}</span>
                                    )}
                                    {slot.filledAgentName && (
                                      <span>
                                        Filled: {slot.filledAgentName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      void handleReorderAgentSlot(slot.id, -1)
                                    }
                                    disabled={
                                      reorderingAgentPool || index === 0
                                    }
                                    className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-40"
                                  >
                                    Up
                                  </button>
                                  <button
                                    onClick={() =>
                                      void handleReorderAgentSlot(slot.id, 1)
                                    }
                                    disabled={
                                      reorderingAgentPool ||
                                      index === agentPoolSlots.length - 1
                                    }
                                    className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-40"
                                  >
                                    Down
                                  </button>
                                  <button
                                    onClick={() => startEditAgentSlot(slot)}
                                    className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 transition"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() =>
                                      void handleDeleteAgentSlot(slot.id)
                                    }
                                    className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-950/60 transition"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-zinc-100">
                            {editingAgentSlotId
                              ? "Edit Agent Slot"
                              : "Add Agent Slot"}
                          </h4>
                          {editingAgentSlotId && (
                            <button
                              onClick={() => resetAgentSlotForm()}
                              className="text-xs text-zinc-500 hover:text-zinc-300"
                            >
                              Cancel edit
                            </button>
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <label className="mb-1 block text-xs text-zinc-500">
                              Agent Template
                            </label>
                            <select
                              value={agentSlotForm.templateId}
                              onChange={(e) =>
                                setAgentSlotForm((current) => ({
                                  ...current,
                                  templateId: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                            >
                              <option value="">Select template</option>
                              {availableAgentTemplates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">
                              Slot
                            </label>
                            <input
                              type="number"
                              value={agentSlotForm.slot}
                              onChange={(e) =>
                                setAgentSlotForm((current) => ({
                                  ...current,
                                  slot: parseInt(e.target.value) || 1,
                                }))
                              }
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">
                              Slot Type
                            </label>
                            <select
                              value={agentSlotForm.slotType}
                              onChange={(e) =>
                                setAgentSlotForm((current) => ({
                                  ...current,
                                  slotType: e.target.value as TierSlotType,
                                }))
                              }
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                            >
                              <option value="CHOICE">CHOICE</option>
                              <option value="FIXED">FIXED</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">
                              Default Budget / Day
                            </label>
                            <input
                              type="number"
                              value={agentSlotForm.defaultBudgetPerDay}
                              onChange={(e) =>
                                setAgentSlotForm((current) => ({
                                  ...current,
                                  defaultBudgetPerDay: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">
                              Default Model
                            </label>
                            <input
                              value={agentSlotForm.defaultModel}
                              onChange={(e) =>
                                setAgentSlotForm((current) => ({
                                  ...current,
                                  defaultModel: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                              placeholder="gpt-4o-mini"
                            />
                          </div>
                          <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
                            <input
                              type="checkbox"
                              checked={agentSlotForm.isRequired}
                              onChange={(e) =>
                                setAgentSlotForm((current) => ({
                                  ...current,
                                  isRequired: e.target.checked,
                                }))
                              }
                              className="rounded border-zinc-600 bg-zinc-800 text-indigo-500"
                            />
                            Required
                          </label>
                          <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
                            <input
                              type="checkbox"
                              checked={agentSlotForm.isDefaultSelected}
                              onChange={(e) =>
                                setAgentSlotForm((current) => ({
                                  ...current,
                                  isDefaultSelected: e.target.checked,
                                }))
                              }
                              className="rounded border-zinc-600 bg-zinc-800 text-indigo-500"
                            />
                            Default selected
                          </label>
                        </div>
                        <div className="mt-4 flex gap-3">
                          <button
                            onClick={() => void handleSaveAgentSlot()}
                            disabled={agentSlotSaving}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                          >
                            {agentSlotSaving
                              ? "Saving..."
                              : editingAgentSlotId
                                ? "Save Agent Slot"
                                : "Add Agent Slot"}
                          </button>
                          <button
                            onClick={() => resetAgentSlotForm()}
                            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-100">
                            Department Pool Slots
                          </h3>
                          <p className="text-xs text-zinc-500">
                            Fixed and choice department templates available in
                            this tier.
                          </p>
                        </div>
                        <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
                          {departmentPoolSlots.length} slots
                        </span>
                      </div>

                      <div className="mb-4 space-y-3">
                        {departmentPoolSlots.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                            No department pool slots configured yet.
                          </div>
                        ) : (
                          departmentPoolSlots.map((slot, index) => (
                            <div
                              key={slot.id}
                              className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-zinc-100">
                                      {slot.departmentTemplate.name}
                                    </span>
                                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                                      Slot {slot.slot}
                                    </span>
                                    <span className="rounded-full bg-indigo-950/60 px-2 py-0.5 text-[11px] text-indigo-300">
                                      {slot.slotType}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                                    <span>
                                      Required: {slot.isRequired ? "Yes" : "No"}
                                    </span>
                                    <span>
                                      Default:{" "}
                                      {slot.isDefaultSelected ? "Yes" : "No"}
                                    </span>
                                    {slot.departmentTemplate.slug && (
                                      <span>
                                        Slug: {slot.departmentTemplate.slug}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      void handleReorderDepartmentSlot(
                                        slot.id,
                                        -1,
                                      )
                                    }
                                    disabled={
                                      reorderingDepartmentPool || index === 0
                                    }
                                    className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-40"
                                  >
                                    Up
                                  </button>
                                  <button
                                    onClick={() =>
                                      void handleReorderDepartmentSlot(
                                        slot.id,
                                        1,
                                      )
                                    }
                                    disabled={
                                      reorderingDepartmentPool ||
                                      index === departmentPoolSlots.length - 1
                                    }
                                    className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-40"
                                  >
                                    Down
                                  </button>
                                  <button
                                    onClick={() =>
                                      startEditDepartmentSlot(slot)
                                    }
                                    className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 transition"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() =>
                                      void handleDeleteDepartmentSlot(slot.id)
                                    }
                                    className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-950/60 transition"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-zinc-100">
                            {editingDepartmentSlotId
                              ? "Edit Department Slot"
                              : "Add Department Slot"}
                          </h4>
                          {editingDepartmentSlotId && (
                            <button
                              onClick={() => resetDepartmentSlotForm()}
                              className="text-xs text-zinc-500 hover:text-zinc-300"
                            >
                              Cancel edit
                            </button>
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <label className="mb-1 block text-xs text-zinc-500">
                              Department Template
                            </label>
                            <select
                              value={departmentSlotForm.departmentTemplateId}
                              onChange={(e) =>
                                setDepartmentSlotForm((current) => ({
                                  ...current,
                                  departmentTemplateId: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                            >
                              <option value="">Select template</option>
                              {availableDepartmentTemplates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">
                              Slot
                            </label>
                            <input
                              type="number"
                              value={departmentSlotForm.slot}
                              onChange={(e) =>
                                setDepartmentSlotForm((current) => ({
                                  ...current,
                                  slot: parseInt(e.target.value) || 1,
                                }))
                              }
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">
                              Slot Type
                            </label>
                            <select
                              value={departmentSlotForm.slotType}
                              onChange={(e) =>
                                setDepartmentSlotForm((current) => ({
                                  ...current,
                                  slotType: e.target.value as TierSlotType,
                                }))
                              }
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                            >
                              <option value="CHOICE">CHOICE</option>
                              <option value="FIXED">FIXED</option>
                            </select>
                          </div>
                          <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
                            <input
                              type="checkbox"
                              checked={departmentSlotForm.isRequired}
                              onChange={(e) =>
                                setDepartmentSlotForm((current) => ({
                                  ...current,
                                  isRequired: e.target.checked,
                                }))
                              }
                              className="rounded border-zinc-600 bg-zinc-800 text-indigo-500"
                            />
                            Required
                          </label>
                          <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
                            <input
                              type="checkbox"
                              checked={departmentSlotForm.isDefaultSelected}
                              onChange={(e) =>
                                setDepartmentSlotForm((current) => ({
                                  ...current,
                                  isDefaultSelected: e.target.checked,
                                }))
                              }
                              className="rounded border-zinc-600 bg-zinc-800 text-indigo-500"
                            />
                            Default selected
                          </label>
                        </div>
                        <div className="mt-4 flex gap-3">
                          <button
                            onClick={() => void handleSaveDepartmentSlot()}
                            disabled={departmentSlotSaving}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                          >
                            {departmentSlotSaving
                              ? "Saving..."
                              : editingDepartmentSlotId
                                ? "Save Department Slot"
                                : "Add Department Slot"}
                          </button>
                          <button
                            onClick={() => resetDepartmentSlotForm()}
                            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
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
              className="w-full max-w-sm rounded-2xl border border-red-800/40 bg-zinc-900 p-6 shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                Delete Tier?
              </h3>
              <p className="text-sm text-zinc-400 mb-5">
                "
                <span className="text-zinc-200 font-medium">
                  {deleteTarget.name}
                </span>
                " will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
