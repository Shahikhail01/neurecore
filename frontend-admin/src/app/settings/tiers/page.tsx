"use client";

import { useState } from "react";
import { useTierSettings } from "@/hooks/useTierSettings";
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

const AVAILABLE_FEATURES: { id: string; name: string; description: string }[] =
  [
    {
      id: "advanced_analytics",
      name: "Advanced Analytics",
      description: "Detailed analytics and reporting",
    },
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
    {
      id: "priority_support",
      name: "Priority Support",
      description: "Get help faster",
    },
    {
      id: "custom_integrations",
      name: "Custom Integrations",
      description: "Build custom integrations",
    },
    {
      id: "dedicated_infrastructure",
      name: "Dedicated Infrastructure",
      description: "Isolated resources",
    },
  ];

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
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    isActive: true,
    isDefault: false,
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

  function slugify(s: string) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function openCreate() {
    setEditTier(null);
    const features = AVAILABLE_FEATURES.map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      enabled: false,
    }));
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
      pricing: {
        monthlyPrice: 0,
        yearlyPrice: 0,
        currency: "USD",
        billingCycle: "monthly",
      },
      limits: DEFAULT_LIMITS,
      features,
      permissions,
    });
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(t: TenantTier) {
    setEditTier(t);
    setFormData({
      name: t.name,
      slug: t.slug,
      description: t.description ?? "",
      isActive: t.isActive,
      isDefault: t.isDefault,
      pricing: t.pricing,
      limits: t.limits,
      features: t.features,
      permissions: t.permissions,
    });
    setSaveError(null);
    setModalOpen(true);
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
      const payload = {
        name: formData.name,
        slug: editTier ? formData.slug : `tier-${slugify(formData.name)}`,
        description: formData.description,
        isActive: formData.isActive,
        isDefault: formData.isDefault,
        pricing: formData.pricing,
        limits: formData.limits,
        features: formData.features,
        permissions: formData.permissions,
      };

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

  function toggleFeature(featureId: string) {
    setFormData((f) => ({
      ...f,
      features: f.features.map((feat) =>
        feat.id === featureId ? { ...feat, enabled: !feat.enabled } : feat,
      ),
    }));
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
            className="px-4 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition"
          >
            + Add Tier
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 p-3 text-sm text-red-300">
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
                            <span className="rounded-full bg-[color:var(--accent-500)] text-indigo-300 text-xs px-2 py-0.5">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-500 mt-0.5 line-clamp-2">
                          {tier.description}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          tier.isActive
                            ? "bg-[color:var(--state-success)] text-green-300"
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
                    <div className="space-y-1 text-xs text-zinc-400 mb-3">
                      <div>👤 {tier.limits?.maxUsers ?? 0} users</div>
                      <div>🤖 {tier.limits?.maxAgents ?? 0} agents</div>
                      <div>💾 {tier.limits?.maxStorageGB ?? 0}GB storage</div>
                    </div>

                    {/* Features */}
                    <div className="flex flex-wrap gap-1 mb-3">
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
                    </div>

                    <div className="flex gap-2 mt-auto pt-3 border-t border-zinc-800">
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
                            : "bg-[color:var(--state-success)] text-green-300 hover:bg-green-800"
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
                        className="px-3 py-1.5 rounded-lg text-xs text-[color:var(--state-danger)] hover:text-red-300 transition"
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
              className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
            >
              <h2 className="text-lg font-semibold text-zinc-100 mb-5">
                {editTier ? `Edit: ${editTier.name}` : "Create Tier"}
              </h2>

              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {/* Name & Slug */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">
                      Name *
                    </label>
                    <input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, name: e.target.value }))
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"
                      placeholder="Enterprise"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">
                      Slug{" "}
                      {editTier && (
                        <span className="text-zinc-600">(locked)</span>
                      )}
                    </label>
                    <input
                      value={formData.slug}
                      onChange={(e) =>
                        !editTier &&
                        setFormData((f) => ({
                          ...f,
                          slug: slugify(e.target.value),
                        }))
                      }
                      readOnly={!!editTier}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)] disabled:opacity-50"
                      placeholder="tier-enterprise"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">
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
                    rows={2}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)] resize-none"
                    placeholder="Full-featured tier for large organizations"
                  />
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">
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
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">
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
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">
                      Currency
                    </label>
                    <select
                      value={formData.pricing.currency}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          pricing: { ...f.pricing, currency: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                {/* Limits */}
                <div>
                  <label className="text-xs text-zinc-400 mb-2 block">
                    Limits
                  </label>
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-zinc-800/50">
                    <div>
                      <label className="text-xs text-zinc-500">Max Users</label>
                      <input
                        type="number"
                        value={formData.limits.maxUsers}
                        onChange={(e) =>
                          setFormData((f) => ({
                            ...f,
                            limits: {
                              ...f.limits,
                              maxUsers: parseInt(e.target.value) || 0,
                            },
                          }))
                        }
                        className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">
                        Max Agents
                      </label>
                      <input
                        type="number"
                        value={formData.limits.maxAgents}
                        onChange={(e) =>
                          setFormData((f) => ({
                            ...f,
                            limits: {
                              ...f.limits,
                              maxAgents: parseInt(e.target.value) || 0,
                            },
                          }))
                        }
                        className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">
                        Max Storage (GB)
                      </label>
                      <input
                        type="number"
                        value={formData.limits.maxStorageGB}
                        onChange={(e) =>
                          setFormData((f) => ({
                            ...f,
                            limits: {
                              ...f.limits,
                              maxStorageGB: parseInt(e.target.value) || 0,
                            },
                          }))
                        }
                        className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">
                        Max API Calls
                      </label>
                      <input
                        type="number"
                        value={formData.limits.maxApiCalls}
                        onChange={(e) =>
                          setFormData((f) => ({
                            ...f,
                            limits: {
                              ...f.limits,
                              maxApiCalls: parseInt(e.target.value) || 0,
                            },
                          }))
                        }
                        className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <label className="text-xs text-zinc-400 mb-2 block">
                    Features
                  </label>
                  <div className="space-y-2 p-3 rounded-lg bg-zinc-800/50">
                    {formData.features.map((feature) => (
                      <label
                        key={feature.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={feature.enabled}
                          onChange={() => toggleFeature(feature.id)}
                          className="rounded border-zinc-600 bg-zinc-800 text-[color:var(--accent-400)] focus:ring-indigo-500"
                        />
                        <span className="text-sm text-zinc-300">
                          {feature.name}
                        </span>
                        <span className="text-xs text-zinc-500">
                          - {feature.description}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {saveError && (
                  <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-3 py-2 text-sm text-red-300">
                    {saveError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : editTier
                        ? "Save Changes"
                        : "Create Tier"}
                  </button>
                </div>
              </div>
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
                  className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-[color:var(--state-danger)] text-white text-sm font-medium transition disabled:opacity-50"
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
