"use client";

import { useState } from "react";
import { useEmailSettings } from "@/hooks/useEmailSettings";
import type {
  EmailConfig,
  EmailProvider,
  EmailTemplate,
  EmailLog,
  PaginatedAuditLogs,
} from "@/types/settings.types";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const EMAIL_PROVIDERS: { value: EmailProvider; label: string; icon: string }[] =
  [
    { value: "smtp", label: "SMTP", icon: "📧" },
    { value: "ses", label: "Amazon SES", icon: "☁️" },
    { value: "sendgrid", label: "SendGrid", icon: "📤" },
    { value: "mailgun", label: "Mailgun", icon: "📬" },
    { value: "resend", label: "Resend", icon: "📨" },
  ];

const EMAIL_TYPES: { value: EmailTemplate["type"]; label: string }[] = [
  { value: "welcome", label: "Welcome Email" },
  { value: "password_reset", label: "Password Reset" },
  { value: "email_verification", label: "Email Verification" },
  { value: "tier_upgrade", label: "Tier Upgrade" },
  { value: "tier_downgrade", label: "Tier Downgrade" },
  { value: "payment_failed", label: "Payment Failed" },
  { value: "payment_success", label: "Payment Success" },
  { value: "subscription_expiring", label: "Subscription Expiring" },
  { value: "user_invite", label: "User Invite" },
  { value: "custom", label: "Custom" },
];

export default function EmailSettingsPage() {
  const {
    configs,
    templates,
    loading,
    error,
    refresh,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleConfig,
    setDefaultConfig,
    testConfig,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    toggleTemplate,
    getLogs,
  } = useEmailSettings();

  const [activeTab, setActiveTab] = useState<"configs" | "templates" | "logs">(
    "configs",
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<EmailConfig | null>(null);
  const [formData, setFormData] = useState({
    provider: "smtp" as EmailProvider,
    isEnabled: true,
    isDefault: false,
    settings: {
      fromEmail: "",
      fromName: "",
      replyToEmail: "",
    },
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    subject: "",
    body: "",
    type: "custom" as EmailTemplate["type"],
    isActive: true,
  });

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);

  function openCreateConfig() {
    setEditConfig(null);
    setFormData({
      provider: "smtp",
      isEnabled: true,
      isDefault: false,
      settings: { fromEmail: "", fromName: "", replyToEmail: "" },
    });
    setSaveError(null);
    setModalOpen(true);
  }

  function openEditConfig(c: EmailConfig) {
    setEditConfig(c);
    setFormData({
      provider: c.provider,
      isEnabled: c.isEnabled,
      isDefault: c.isDefault,
      settings: {
        fromEmail: c.settings.fromEmail,
        fromName: c.settings.fromName,
        replyToEmail: c.settings.replyToEmail ?? "",
      },
    });
    setSaveError(null);
    setModalOpen(true);
  }

  async function handleSaveConfig() {
    if (!formData.settings.fromEmail.trim()) {
      setSaveError("From Email is required");
      return;
    }
    if (!formData.settings.fromName.trim()) {
      setSaveError("From Name is required");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      if (editConfig) {
        await updateConfig(editConfig.id, formData);
        toast.success("Email provider updated successfully");
      } else {
        await createConfig(formData);
        toast.success("Email provider created successfully");
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

  async function handleDeleteConfig() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteConfig(deleteTarget.id);
      toast.success("Email provider deleted successfully");
      setDeleteTarget(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Delete failed";
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  }

  async function handleTestConfig(id: string) {
    setTestingId(id);
    try {
      await testConfig(id, "test@example.com");
    } finally {
      setTestingId(null);
    }
  }

  function openCreateTemplate() {
    setEditTemplate(null);
    setTemplateForm({
      name: "",
      subject: "",
      body: "",
      type: "custom",
      isActive: true,
    });
    setTemplateModalOpen(true);
  }

  function openEditTemplate(t: EmailTemplate) {
    setEditTemplate(t);
    setTemplateForm({
      name: t.name,
      subject: t.subject,
      body: t.body,
      type: t.type,
      isActive: t.isActive,
    });
    setTemplateModalOpen(true);
  }

  async function handleSaveTemplate() {
    if (!templateForm.name.trim()) {
      setSaveError("Name is required");
      return;
    }
    if (!templateForm.subject.trim()) {
      setSaveError("Subject is required");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      if (editTemplate) {
        await updateTemplate(editTemplate.id, templateForm);
        toast.success("Template updated successfully");
      } else {
        await createTemplate(templateForm);
        toast.success("Template created successfully");
      }
      setTemplateModalOpen(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Save failed";
      setSaveError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    await deleteTemplate(id);
  }

  async function loadLogs(page = 1) {
    setLogsLoading(true);
    try {
      const data = await getLogs({ page, limit: 20 });
      setLogs(data.items as unknown as EmailLog[]);
      setLogsTotal(data.total);
      setLogsPage(page);
    } finally {
      setLogsLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Loading email settings...</div>
      </div>
    );
  }

  const safeConfigs = Array.isArray(configs) ? configs : [];
  const safeTemplates = Array.isArray(templates) ? templates : [];
  const safeLogs = Array.isArray(logs) ? logs : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Email System</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Configure email providers, templates, and view delivery logs
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <nav className="flex gap-4">
          {[
            { id: "configs", label: "Providers" },
            { id: "templates", label: "Templates" },
            { id: "logs", label: "Logs" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as typeof activeTab);
                if (tab.id === "logs" && logs.length === 0) loadLogs();
              }}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? "border-[color:var(--accent-500)] text-[color:var(--accent-400)]"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Configs Tab */}
      {activeTab === "configs" && (
        <div className="space-y-4">
          <div className="flex justify-end items-center gap-2">
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="px-3 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={openCreateConfig}
              className="px-4 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition"
            >
              + Add Provider
            </button>
          </div>

          <div className="grid gap-4">
            {safeConfigs.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <p>No email providers configured</p>
              </div>
            ) : (
              safeConfigs.map((config) => (
                <motion.div
                  key={config.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-zinc-100">
                          {
                            EMAIL_PROVIDERS.find(
                              (p) => p.value === config.provider,
                            )?.icon
                          }{" "}
                          {
                            EMAIL_PROVIDERS.find(
                              (p) => p.value === config.provider,
                            )?.label
                          }
                        </h3>
                        {config.isDefault && (
                          <span className="rounded-full bg-[color:var(--accent-500)] text-indigo-300 text-xs px-2 py-0.5">
                            Default
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            config.isEnabled
                              ? "bg-[color:var(--state-success)] text-green-300"
                              : "bg-zinc-700 text-zinc-400"
                          }`}
                        >
                          {config.isEnabled ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500 mt-1">
                        From: {config.settings.fromName} {"<"}
                        {config.settings.fromEmail}
                        {">"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestConfig(config.id)}
                        disabled={testingId === config.id}
                        className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-50"
                      >
                        {testingId === config.id ? "Testing..." : "Test"}
                      </button>
                      {!config.isDefault && (
                        <button
                          onClick={() => setDefaultConfig(config.id)}
                          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 transition"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() =>
                          toggleConfig(config.id, !config.isEnabled)
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          config.isEnabled
                            ? "bg-yellow-900 text-yellow-300 hover:bg-yellow-800"
                            : "bg-[color:var(--state-success)] text-green-300 hover:bg-green-800"
                        }`}
                      >
                        {config.isEnabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => openEditConfig(config)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(config)}
                        className="px-3 py-1.5 rounded-lg text-xs text-[color:var(--state-danger)] hover:text-red-300 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <div className="flex items-center gap-2">
              <button
                onClick={() => void refresh()}
                disabled={loading}
                className="px-3 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-50"
              >
                Refresh
              </button>
              <button
                onClick={openCreateTemplate}
                className="px-4 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition"
              >
                + Add Template
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {safeTemplates.length === 0 ? (
              <div className="col-span-full text-center py-12 text-zinc-500">
                <p>No email templates configured</p>
              </div>
            ) : (
              safeTemplates.map((template) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-zinc-100">
                          {template.name}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            template.isActive
                              ? "bg-[color:var(--state-success)] text-green-300"
                              : "bg-zinc-700 text-zinc-400"
                          }`}
                        >
                          {template.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500 mt-1">
                        {
                          EMAIL_TYPES.find((t) => t.value === template.type)
                            ?.label
                        }
                      </p>
                      <p className="text-xs text-zinc-600 mt-2 truncate">
                        {template.subject}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          toggleTemplate(template.id, !template.isActive)
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          template.isActive
                            ? "bg-yellow-900 text-yellow-300 hover:bg-yellow-800"
                            : "bg-[color:var(--state-success)] text-green-300 hover:bg-green-800"
                        }`}
                      >
                        {template.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => openEditTemplate(template)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="px-3 py-1.5 rounded-lg text-xs text-[color:var(--state-danger)] hover:text-red-300 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <button
              onClick={() => void loadLogs(logsPage)}
              disabled={logsLoading}
              className="px-3 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">To</th>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {logsLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-zinc-500"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : safeLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-zinc-500"
                    >
                      No logs found
                    </td>
                  </tr>
                ) : (
                  safeLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-zinc-900/50 transition"
                    >
                      <td className="px-4 py-3 text-zinc-300 truncate max-w-[200px]">
                        {log.to}
                      </td>
                      <td className="px-4 py-3 text-zinc-300 truncate max-w-[250px]">
                        {log.subject}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {EMAIL_TYPES.find((t) => t.value === log.type)?.label ||
                          log.type}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            log.status === "sent" ||
                            log.status === "delivered" ||
                            log.status === "opened"
                              ? "bg-[color:var(--state-success)] text-green-300"
                              : log.status === "failed" ||
                                  log.status === "bounced"
                                ? "bg-[color:var(--state-danger)] text-red-300"
                                : "bg-yellow-900 text-yellow-300"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {new Date(log.sentAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Config Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="button"
            tabIndex={0}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setModalOpen(false); } }}
            onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6"
            >
              <h2 className="text-lg font-semibold text-zinc-100 mb-5">
                {editConfig ? "Edit Provider" : "Add Email Provider"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="email-provider" className="text-xs text-zinc-400 mb-1 block">
                    Provider
                  </label>
                  <select
                    id="email-provider"
                    value={formData.provider}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        provider: e.target.value as EmailProvider,
                      }))
                    }
                    disabled={!!editConfig}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50"
                  >
                    {EMAIL_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.icon} {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="email-from-name" className="text-xs text-zinc-400 mb-1 block">
                    From Name *
                  </label>
                  <input
                    id="email-from-name"
                    value={formData.settings.fromName}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        settings: { ...f.settings, fromName: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                    placeholder="NeureCore"
                  />
                </div>

                <div>
                  <label htmlFor="email-from-email" className="text-xs text-zinc-400 mb-1 block">
                    From Email *
                  </label>
                  <input
                    id="email-from-email"
                    type="email"
                    value={formData.settings.fromEmail}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        settings: { ...f.settings, fromEmail: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                    placeholder="noreply@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="email-reply-to" className="text-xs text-zinc-400 mb-1 block">
                    Reply To
                  </label>
                  <input
                    id="email-reply-to"
                    type="email"
                    value={formData.settings.replyToEmail}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        settings: {
                          ...f.settings,
                          replyToEmail: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                    placeholder="support@example.com"
                  />
                </div>

                {saveError && (
                  <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-3 py-2 text-sm text-red-300">
                    {saveError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={saving}
                    className="flex-1 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : editConfig
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          >
            <motion.div className="w-full max-w-sm rounded-2xl border border-red-800/40 bg-zinc-900 p-6">
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                Delete Provider?
              </h3>
              <p className="text-sm text-zinc-400 mb-5">
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfig}
                  disabled={deleting}
                  className="flex-1 py-2 rounded-lg bg-red-700 text-white text-sm disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Template Modal */}
      <AnimatePresence>
        {templateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="button"
            tabIndex={0}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setTemplateModalOpen(false); } }}
            onClick={(e) =>
              e.target === e.currentTarget && setTemplateModalOpen(false)
            }
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6"
            >
              <h2 className="text-lg font-semibold text-zinc-100 mb-5">
                {editTemplate ? "Edit Template" : "Add Template"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="tmpl-name" className="text-xs text-zinc-400 mb-1 block">
                    Name *
                  </label>
                  <input
                    id="tmpl-name"
                    value={templateForm.name}
                    onChange={(e) =>
                      setTemplateForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                    placeholder="Welcome Email"
                  />
                </div>

                <div>
                  <label htmlFor="tmpl-type" className="text-xs text-zinc-400 mb-1 block">
                    Type
                  </label>
                  <select
                    id="tmpl-type"
                    value={templateForm.type}
                    onChange={(e) =>
                      setTemplateForm((f) => ({
                        ...f,
                        type: e.target.value as EmailTemplate["type"],
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                  >
                    {EMAIL_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="tmpl-subject" className="text-xs text-zinc-400 mb-1 block">
                    Subject *
                  </label>
                  <input
                    id="tmpl-subject"
                    value={templateForm.subject}
                    onChange={(e) =>
                      setTemplateForm((f) => ({
                        ...f,
                        subject: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                    placeholder="Welcome to NeureCore!"
                  />
                </div>

                <div>
                  <label htmlFor="tmpl-body" className="text-xs text-zinc-400 mb-1 block">
                    Body
                  </label>
                  <textarea
                    id="tmpl-body"
                    value={templateForm.body}
                    onChange={(e) =>
                      setTemplateForm((f) => ({ ...f, body: e.target.value }))
                    }
                    rows={6}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 resize-none"
                    placeholder="Hello {{name}}, welcome to NeureCore..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setTemplateModalOpen(false)}
                    className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={saving}
                    className="flex-1 py-2 rounded-lg bg-[color:var(--accent-500)] text-white text-sm disabled:opacity-50"
                  >
                    {saving ? "Saving..." : editTemplate ? "Save" : "Create"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
