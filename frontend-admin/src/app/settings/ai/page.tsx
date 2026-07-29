"use client";

import { useMemo, useState } from "react";
import { useAISettings } from "@/hooks/useAISettings";
import type {
  AIProvider,
  AIProviderConfig,
  AIModel,
  AIRoutingConfig,
} from "@/types/settings.types";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const PROVIDER_INFO: Record<string, { name: string; icon: string; description: string }> = {
  deepseek: {
    name: "DeepSeek",
    icon: "🔮",
    description: "High-performance reasoning models",
  },
  gemini: {
    name: "Google Gemini",
    icon: "🌟",
    description: "Google's multimodal AI model",
  },
  openrouter: {
    name: "OpenRouter",
    icon: "🔗",
    description: "Unified API for multiple providers",
  },
  minimax: {
    name: "MiniMax",
    icon: "🤖",
    description: "MiniMax AI large language model",
  },
  openai: {
    name: "OpenAI",
    icon: "🧠",
    description: "GPT-4o, GPT-4o-mini, and embedding models",
  },
  anthropic: {
    name: "Anthropic",
    icon: "🎭",
    description: "Claude 3.5 Sonnet and Claude 3 Haiku",
  },
  mimo: {
    name: "Xiaomi MiMo",
    icon: "📡",
    description: "MiMo 72B Instruct language model",
  },
};

const DEFAULT_AI_SETTINGS = {
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 4096,
  timeout: 30000,
  retryAttempts: 3,
};

export default function AISettingsPage() {
  const {
    providers,
    routing,
    loading,
    error,
    refresh,
    createProvider,
    updateProvider,
    deleteProvider,
    toggleProvider,
    setDefaultProvider,
    testConnection,
    discoverProviderModels,
    toggleModel,
    setDefaultModel,
    updateRouting,
    resetRouting,
  } = useAISettings();

  const [modalOpen, setModalOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<AIProviderConfig | null>(
    null,
  );
  // Phase 2.8: row id of the model whose default-flag is being set
  // right now (used to disable + show an ellipsis on the badge).
  const [settingDefaultModelId, setSettingDefaultModelId] = useState<
    string | null
  >(null);
  const [formData, setFormData] = useState({
    provider: "deepseek" as AIProvider,
    name: "",
    apiKey: "",
    apiEndpoint: "",
    isEnabled: true,
    settings: DEFAULT_AI_SETTINGS,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; latency: number; error?: string }>
  >({});

  // Phase 2.8: discover-models step that appears after a successful
  // create/edit, letting admin pick which discovered models to enable
  // and which should be default.
  const [discoverStep, setDiscoverStep] = useState<{
    providerId: string;
    providerName: string;
    candidates: Array<{
      id: string;
      modelId: string;
      displayName: string;
      capabilities: string[];
    }>;
    selected: Record<string, boolean>;
    defaultModelId: string | null;
    busy: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AIProviderConfig | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditProvider(null);
    setFormData({
      provider: "deepseek",
      name: "",
      apiKey: "",
      apiEndpoint: "",
      isEnabled: true,
      settings: DEFAULT_AI_SETTINGS,
    });
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(p: AIProviderConfig) {
    setEditProvider(p);
    setFormData({
      provider: p.provider,
      name: p.name,
      apiKey: "", // Don't pre-fill API key for security
      apiEndpoint: p.apiEndpoint ?? "",
      isEnabled: p.isEnabled,
      settings: p.settings,
    });
    setSaveError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setSaveError("Name is required");
      return;
    }
    if (!editProvider && !formData.apiKey.trim()) {
      setSaveError("API Key is required");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        provider: formData.provider,
        name: formData.name,
        apiKey: formData.apiKey || undefined,
        apiEndpoint: formData.apiEndpoint || undefined,
        isEnabled: formData.isEnabled,
        settings: formData.settings,
        isDefault: editProvider?.isDefault ?? false,
      };

      let savedId: string | undefined;
      if (editProvider) {
        // Phase 2.8: when the user leaves apiKey blank, omit the
        // field entirely so the backend keeps the stored encrypted
        // value (controller's updateProvider treats `apiKey: ''` as
        // "clear it" and `apiKey` undefined as "leave untouched").
        const updatePayload: Record<string, unknown> = { ...payload };
        if (!formData.apiKey) delete updatePayload.apiKey;
        const updated = await updateProvider(editProvider.id, updatePayload);
        savedId = updated.id;
        toast.success(`Provider "${formData.name}" updated successfully`);
      } else {
        const created = await createProvider(payload);
        savedId = created.id;
        toast.success(`Provider "${formData.name}" created successfully`);
      }

      // Phase 2.8: when a key was just provided, immediately try to
      // fetch the provider's available models so admin can pick
      // which to enable + default.
      if (formData.apiKey && savedId) {
        setModalOpen(false);
        await openDiscoverStep(savedId, formData.name);
      } else {
        setModalOpen(false);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Save failed";
      setSaveError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function openDiscoverStep(providerId: string, providerName: string) {
    setDiscoverStep({
      providerId,
      providerName,
      candidates: [],
      selected: {},
      defaultModelId: null,
      busy: true,
    });
    const res = await discoverProviderModels(providerId);
    setDiscoverStep((cur) => {
      if (!cur) return cur;
      if (!res.ok) {
        return { ...cur, busy: false, error: res.error ?? "Discovery failed" };
      }
      const selected: Record<string, boolean> = {};
      const candidates = res.inserted ?? [];
      for (const c of candidates) selected[c.id] = true;
      return {
        ...cur,
        busy: false,
        candidates,
        selected,
        message:
          res.message ??
          (candidates.length === 0
            ? "Provider returned 0 new models"
            : `Found ${candidates.length} model(s)`),
      };
    });
  }

  async function handleApplyDiscover() {
    if (!discoverStep) return;
    setDiscoverStep((cur) => (cur ? { ...cur, busy: true } : cur));
    try {
      // Enable selected models + mark one as default.
      for (const c of discoverStep.candidates) {
        if (!discoverStep.selected[c.id]) continue;
        await toggleModel(discoverStep.providerId, c.id, true);
        if (c.id === discoverStep.defaultModelId) {
          await setDefaultModel(discoverStep.providerId, c.id);
        }
      }
      toast.success("Models enabled");
      setDiscoverStep(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      setDiscoverStep((cur) => (cur ? { ...cur, busy: false } : cur));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProvider(deleteTarget.id);
      toast.success(`Provider "${deleteTarget.name}" deleted successfully`);
      setDeleteTarget(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Delete failed";
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const result = await testConnection(id);
      setTestResults((prev) => ({ ...prev, [id]: result }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const res = await setDefaultProvider(id);
      if (res.ok) {
        toast.success(
          `Default routing updated → model: ${res.modelId ?? 'n/a'}`,
        );
      } else {
        toast.error(res.error ?? 'Failed to set default');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set default');
    }
  }

  /**
   * Phase 2.8: click on an available-model badge to promote that
   * model to the global default for every capability it advertises.
   * The backend's `setDefaultModel` already clears isDefault on all
   * sibling models that share those capabilities, so no client-side
   * iteration is needed.
   */
  async function handleSetDefaultModel(
    providerId: string,
    modelRowId: string,
    modelName: string,
  ) {
    setSettingDefaultModelId(modelRowId);
    try {
      await setDefaultModel(providerId, modelRowId);
      toast.success(`"${modelName}" is now the default model`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set default');
    } finally {
      setSettingDefaultModelId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Loading AI providers...</div>
      </div>
    );
  }

  const safeProviders = Array.isArray(providers) ? providers : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">AI Providers</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Configure AI model providers (DeepSeek, Gemini, OpenRouter)
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
            + Add Provider
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Provider Cards */}
      <div className="grid gap-4">
        <AnimatePresence>
          {safeProviders.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <p>No AI providers configured</p>
              <p className="text-sm mt-1">Add a provider to get started</p>
            </div>
          ) : (
            safeProviders.map((provider) => {
              const info = PROVIDER_INFO[provider.provider] ?? {
                name: provider.name ?? provider.provider,
                icon: "🔌",
                description: provider.provider,
              };
              const testResult = testResults[provider.id];

              return (
                <motion.div
                  key={provider.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{info.icon}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-zinc-100">
                            {provider.name}
                          </h3>
                          {provider.isDefault && (
                            <span className="rounded-full bg-[color:var(--accent-500)] text-indigo-300 text-xs px-2 py-0.5">
                              Default
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              provider.isEnabled
                                ? "bg-[color:var(--state-success)] text-green-300"
                                : "bg-zinc-700 text-zinc-400"
                            }`}
                          >
                            {provider.isEnabled ? "Active" : "Disabled"}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 mt-0.5">
                          {info.description}
                        </p>
                        {provider.apiEndpoint && (
                          <p className="text-xs text-zinc-600 mt-1">
                            Endpoint: {provider.apiEndpoint}
                          </p>
                        )}
                        {provider.keyPreview && (
                          <p className="text-xs text-zinc-600 mt-1 font-mono">
                            Key: {provider.keyPreview}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTest(provider.id)}
                        disabled={testingId === provider.id}
                        className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-50"
                      >
                        {testingId === provider.id ? "Testing..." : "Test"}
                      </button>
                      {!provider.isDefault && (
                        <button
                          onClick={() => handleSetDefault(provider.id)}
                          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 transition"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() =>
                          toggleProvider(provider.id, !provider.isEnabled)
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          provider.isEnabled
                            ? "bg-yellow-900 text-yellow-300 hover:bg-yellow-800"
                            : "bg-[color:var(--state-success)] text-green-300 hover:bg-green-800"
                        }`}
                      >
                        {provider.isEnabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => openEdit(provider)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(provider)}
                        className="px-3 py-1.5 rounded-lg text-xs text-[color:var(--state-danger)] hover:text-red-300 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Test Result */}
                  {testResult && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className={`mt-3 p-2 rounded-lg text-sm ${
                        testResult.success
                          ? "bg-[color:var(--state-success)] border border-green-800 text-green-300"
                          : "bg-[color:var(--state-danger)] border border-red-800 text-red-300"
                      }`}
                    >
                      {testResult.success
                        ? `✓ Connection successful (${testResult.latency}ms)`
                        : `✕ ${testResult.error || "Connection failed"}`}
                    </motion.div>
                  )}

                  {/* Models */}
                  {Array.isArray(provider.models) &&
                    provider.models.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-zinc-800">
                        <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                          Available Models
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {provider.models!.map((model) => (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() =>
                                model.isEnabled &&
                                handleSetDefaultModel(provider.id, model.id, model.name)
                              }
                              disabled={!model.isEnabled || settingDefaultModelId === model.id}
                              title={
                                model.isEnabled
                                  ? `Make "${model.name}" the default model`
                                  : `Enable "${model.name}" first`
                              }
                              className={`rounded-full px-2 py-1 text-xs transition disabled:cursor-not-allowed ${
                                model.isDefault
                                  ? "bg-[color:var(--accent-500)] text-white font-medium ring-1 ring-indigo-400/50"
                                  : model.isEnabled
                                  ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white cursor-pointer"
                                  : "bg-zinc-800 text-zinc-500 opacity-60"
                              }`}
                            >
                              {model.name}
                              {model.isDefault && (
                                <span className="ml-1 text-[10px]">★</span>
                              )}
                              {settingDefaultModelId === model.id && (
                                <span className="ml-1 text-[10px]">…</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* AI Model Routing Section */}
      <AIRoutingSection />

      {/* Create/Edit Modal */}
      <AnimatePresence>
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
              className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
            >
              <h2 className="text-lg font-semibold text-zinc-100 mb-5">
                {editProvider
                  ? `Edit: ${editProvider.name}`
                  : "Add AI Provider"}
              </h2>

              <div className="space-y-4">
                {/* Provider Type */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">
                    Provider *
                  </label>
                  <select
                    value={formData.provider}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        provider: e.target.value as AIProvider,
                      }))
                    }
                    disabled={!!editProvider}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)] disabled:opacity-50"
                  >
                    {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.icon} {info.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">
                    Display Name *
                  </label>
                  <input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"
                    placeholder="My DeepSeek Provider"
                  />
                </div>

                {/* API Key */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">
                    API Key{" "}
                    {editProvider && (
                      <span className="text-zinc-600">
                        (leave empty to keep current)
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, apiKey: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"
                    placeholder={
                      editProvider
                        ? (editProvider.keyPreview ?? "••••••••••••")
                        : "sk-..."
                    }
                  />
                  {editProvider?.keyPreview && (
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Current: <span className="font-mono">{editProvider.keyPreview}</span>
                      {" · stored encrypted in DB"}
                    </p>
                  )}
                </div>

                {/* API Endpoint (optional) */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">
                    Custom Endpoint{" "}
                    <span className="text-zinc-600">(optional)</span>
                  </label>
                  <input
                    value={formData.apiEndpoint}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        apiEndpoint: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"
                    placeholder="https://api.example.com/v1"
                  />
                </div>

                {/* Settings */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">
                      Temperature
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={formData.settings.temperature}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          settings: {
                            ...f.settings,
                            temperature: parseFloat(e.target.value),
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      value={formData.settings.maxTokens}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          settings: {
                            ...f.settings,
                            maxTokens: parseInt(e.target.value),
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)]"
                    />
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
                      : editProvider
                        ? "Save Changes"
                        : "Add Provider"}
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
                Delete Provider?
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

      {/* Discover Models (Phase 2.8) */}
      <AnimatePresence>
        {discoverStep && (
          <DiscoverModelsModal
            state={discoverStep}
            onToggle={(id, v) =>
              setDiscoverStep((cur) =>
                cur ? { ...cur, selected: { ...cur.selected, [id]: v } } : cur,
              )
            }
            onDefault={(id) =>
              setDiscoverStep((cur) => (cur ? { ...cur, defaultModelId: id } : cur))
            }
            onApply={handleApplyDiscover}
            onClose={() => setDiscoverStep(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const TASK_TYPES = [
  { key: 'planning', label: 'Planning', description: 'Task decomposition and planning' },
  { key: 'execution', label: 'Execution', description: 'Agent task execution' },
  { key: 'evaluation', label: 'Evaluation', description: 'Task result evaluation' },
  { key: 'conversation', label: 'Conversation', description: 'Chat and Q&A interactions' },
  { key: 'coding', label: 'Coding', description: 'Code generation and modification' },
  { key: 'reasoning', label: 'Reasoning', description: 'Complex reasoning tasks' },
] as const;

function AIRoutingSection() {
  const { providers, routing, updateRouting, resetRouting } = useAISettings();
  const [saving, setSaving] = useState(false);
  const [localRouting, setLocalRouting] = useState<AIRoutingConfig | null>(routing);

  useState(() => {
    if (routing) {
      setLocalRouting(routing);
    }
  });

  // Phase 2.8: flatten enabled models across all providers so the
  // dropdown reflects reality instead of the hard-coded list.
  const routingModels = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [];
    for (const p of providers ?? []) {
      for (const m of p.models ?? []) {
        if (!m.isEnabled) continue;
        out.push({
          id: m.modelId,
          label: `${m.name} (${p.provider})`,
        });
      }
    }
    return out;
  }, [providers]);

  if (!localRouting) {
    return null;
  }

  async function handleSave() {
    if (!localRouting) return;
    setSaving(true);
    try {
      await updateRouting(localRouting);
      toast.success('AI routing settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    try {
      await resetRouting();
      toast.success('AI routing reset to defaults');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset');
    }
  }

  function handleModelChange(taskType: keyof AIRoutingConfig, modelId: string) {
    setLocalRouting(prev => prev ? { ...prev, [taskType]: modelId } : null);
  }

  return (
    <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">AI Model Routing</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Configure which AI model to use for each task type
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition"
          >
            Reset to Default
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Routing'}
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {TASK_TYPES.map(({ key, label, description }) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
            <div className="flex-1">
              <div className="font-medium text-zinc-200">{label}</div>
              <div className="text-xs text-zinc-500">{description}</div>
            </div>
            <select
              value={localRouting[key]}
              onChange={(e) => handleModelChange(key, e.target.value)}
              className="rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[color:var(--accent-500)] min-w-[200px]"
            >
              {routingModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

type DiscoverState = {
  providerId: string;
  providerName: string;
  candidates: Array<{
    id: string;
    modelId: string;
    displayName: string;
    capabilities: string[];
  }>;
  selected: Record<string, boolean>;
  defaultModelId: string | null;
  busy: boolean;
  message?: string;
  error?: string;
};

function DiscoverModelsModal({
  state,
  onToggle,
  onDefault,
  onApply,
  onClose,
}: {
  state: DiscoverState | null;
  onToggle: (id: string, v: boolean) => void;
  onDefault: (id: string | null) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  if (!state) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-zinc-100 mb-1">
          Discover Models — {state.providerName}
        </h2>
        <p className="text-xs text-zinc-500 mb-4">
          Choose which discovered models to enable, and pick a default.
        </p>

        {state.busy && state.candidates.length === 0 ? (
          <div className="text-center py-10 text-zinc-500 text-sm">Discovering…</div>
        ) : state.error ? (
          <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 p-3 text-sm text-red-300">
            {state.error}
          </div>
        ) : state.candidates.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-sm">
            {state.message ?? 'No new models found.'}
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {state.candidates.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/40 transition"
              >
                <input
                  type="checkbox"
                  checked={!!state.selected[c.id]}
                  onChange={(e) => onToggle(c.id, e.target.checked)}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <div className="font-medium text-zinc-200">{c.displayName}</div>
                  <div className="text-xs text-zinc-500">
                    capabilities: {c.capabilities.join(', ')}
                  </div>
                </div>
                <label className="flex items-center gap-1 text-xs text-zinc-400">
                  <input
                    type="radio"
                    name="discover-default"
                    checked={state.defaultModelId === c.id}
                    onChange={() => onDefault(c.id)}
                    disabled={!state.selected[c.id]}
                  />
                  Default
                </label>
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-4 mt-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition"
          >
            Skip
          </button>
          <button
            onClick={onApply}
            disabled={state.busy || state.candidates.length === 0}
            className="flex-1 py-2 rounded-lg bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
          >
            {state.busy ? 'Applying…' : 'Enable selected'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
