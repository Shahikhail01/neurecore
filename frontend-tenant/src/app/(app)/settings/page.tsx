"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Save,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  Zap,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUIPreferencesStore } from "@/shared/stores/uiPreferencesStore";
import { cn } from "@/lib/utils";
import { workspaceProvisioningService } from "@/services/workspace-provisioning.service";
import type {
  ProvisioningStatusDto,
  ProvisioningJobDto,
} from "@/types/onboarding.types";
import { ProvisioningProvider } from "@/types/onboarding.types";

type Tab =
  | "profile"
  | "notifications"
  | "appearance"
  | "security"
  | "workspace";

// ─── Status chip ─────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    PENDING_CONNECT: {
      label: "Pending Connection",
      cls: "bg-amber-900/30 text-amber-400 border-amber-500/30",
    },
    CONNECTED: {
      label: "Connected",
      cls: "bg-green-900/30 text-green-400 border-green-500/30",
    },
    IN_PROGRESS: {
      label: "Provisioning…",
      cls: "bg-blue-900/30 text-blue-400 border-blue-500/30",
    },
    COMPLETED: {
      label: "Completed",
      cls: "bg-green-900/30 text-green-400 border-green-500/30",
    },
    FAILED: {
      label: "Failed",
      cls: "bg-red-900/30 text-red-400 border-red-500/30",
    },
  };
  const { label, cls } = map[status] ?? {
    label: status,
    cls: "bg-zinc-800 text-zinc-400 border-zinc-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {status === "PENDING_CONNECT" && <Clock className="h-3 w-3" />}
      {status === "CONNECTED" && <CheckCircle2 className="h-3 w-3" />}
      {status === "FAILED" && <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

// ─── Job status chip ──────────────────────────────────────────────────────────
function JobStatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-zinc-800 text-zinc-400 border-zinc-700",
    IN_PROGRESS: "bg-blue-900/30 text-blue-400 border-blue-500/30",
    COMPLETED: "bg-green-900/30 text-green-400 border-green-500/30",
    FAILED: "bg-red-900/30 text-red-400 border-red-500/30",
    SKIPPED: "bg-zinc-800 text-zinc-500 border-zinc-700",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${map[status] ?? map.PENDING}`}
    >
      {status.toLowerCase()}
    </span>
  );
}

// ─── Workspace tab content ────────────────────────────────────────────────────
function WorkspaceTabContent() {
  const [provStatus, setProvStatus] = useState<ProvisioningStatusDto | null>(
    null,
  );
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [jobs, setJobs] = useState<ProvisioningJobDto[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  useEffect(() => {
    setLoadingStatus(true);
    Promise.allSettled([
      workspaceProvisioningService.getStatus(),
      workspaceProvisioningService.getConfig(),
      workspaceProvisioningService.listJobs(),
    ]).then(([statusRes, configRes, jobsRes]) => {
      if (statusRes.status === "fulfilled") setProvStatus(statusRes.value);
      if (configRes.status === "fulfilled") setConfig(configRes.value);
      if (jobsRes.status === "fulfilled") setJobs(jobsRes.value);
      setLoadingStatus(false);
    });
  }, []);

  const handleConnect = async () => {
    if (!provStatus?.provider) return;
    setConnectLoading(true);
    try {
      const url =
        provStatus.provider === ProvisioningProvider.GOOGLE_WORKSPACE
          ? await workspaceProvisioningService.getGoogleAuthUrl()
          : await workspaceProvisioningService.getMicrosoftAuthUrl();
      window.location.href = url;
    } catch {
      setConnectLoading(false);
    }
  };

  const handleTrigger = async () => {
    setTriggerLoading(true);
    setTriggerResult(null);
    try {
      const result = await workspaceProvisioningService.triggerProvisioning();
      setTriggerResult(
        `Queued ${result.queued} provisioning job${result.queued !== 1 ? "s" : ""}.`,
      );
      // Refresh jobs list
      const refreshed = await workspaceProvisioningService.listJobs();
      setJobs(refreshed);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Provisioning failed";
      setTriggerResult(`Error: ${message}`);
    } finally {
      setTriggerLoading(false);
    }
  };

  const providerLabel =
    provStatus?.provider === ProvisioningProvider.GOOGLE_WORKSPACE
      ? "Google Workspace"
      : provStatus?.provider === ProvisioningProvider.MICROSOFT_365
        ? "Microsoft 365"
        : null;

  if (loadingStatus) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-8 rounded-md bg-[var(--surface-overlay)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!provStatus?.hasPendingSetup && !provStatus?.status) {
    return (
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-overlay)] p-6 text-center">
        <Building2 className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
        <p className="text-sm text-[var(--text-secondary)]">
          No workspace provisioning configured.
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)] opacity-70">
          Select Google Drive or OneDrive during the wizard and enable
          auto-provisioning to set this up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">
        Workspace Provisioning
      </h2>

      {/* ── Config summary ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-overlay)] divide-y divide-[var(--surface-border)]">
        {[
          { label: "Provider", value: providerLabel ?? "—" },
          {
            label: "Email Domain",
            value: config ? `@${config["emailDomain"] as string}` : "—",
          },
          {
            label: "Email Pattern",
            value: config
              ? String(config["emailPattern"]).replace(/_/g, " ").toLowerCase()
              : "—",
          },
          {
            label: "Folder Structure",
            value: config
              ? String(config["folderStructure"])
                  .replace(/_/g, " ")
                  .toLowerCase()
              : "—",
          },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between px-4 py-2.5">
            <span className="text-xs text-[var(--text-secondary)]">
              {label}
            </span>
            <span className="text-xs text-[var(--text-primary)] font-medium">
              {value}
            </span>
          </div>
        ))}
        <div className="flex justify-between items-center px-4 py-2.5">
          <span className="text-xs text-[var(--text-secondary)]">Status</span>
          <StatusChip status={provStatus?.status ?? null} />
        </div>
      </div>

      {/* ── Connect button ───────────────────────────────────────────── */}
      {provStatus?.status === "PENDING_CONNECT" && providerLabel && (
        <div>
          <p className="mb-2 text-xs text-[var(--text-secondary)]">
            Connect your {providerLabel} admin account to grant NeureCore
            permission to create users and folders on your behalf.
          </p>
          <button
            onClick={handleConnect}
            disabled={connectLoading}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
          >
            {connectLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Connect {providerLabel}
          </button>
        </div>
      )}

      {/* ── Jobs table (shown when connected) ───────────────────────── */}
      {(provStatus?.status === "CONNECTED" ||
        provStatus?.status === "IN_PROGRESS" ||
        provStatus?.status === "COMPLETED") && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              Provisioning Jobs ({jobs.length})
            </p>
            {provStatus.status === "CONNECTED" && (
              <div className="flex items-center gap-2">
                {triggerResult && (
                  <span className="text-xs text-zinc-400">{triggerResult}</span>
                )}
                <button
                  onClick={handleTrigger}
                  disabled={
                    triggerLoading || jobs.every((j) => j.status !== "PENDING")
                  }
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
                >
                  {triggerLoading ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Zap className="h-3 w-3" />
                  )}
                  Provision all pending
                </button>
              </div>
            )}
          </div>

          {jobs.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">
              No provisioning jobs found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--surface-border)]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-overlay)]">
                    {["Name", "Invited Email", "Corporate Email", "Status"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left font-medium text-[var(--text-secondary)]"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b border-[var(--surface-border)] last:border-0"
                    >
                      <td className="px-3 py-2.5 text-[var(--text-primary)]">
                        {job.inviteeFirstName} {job.inviteeLastName}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                        {job.inviteeEmail}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                        {job.provisionedEmail ?? (
                          <span className="text-zinc-600">Pending</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <JobStatusChip status={job.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Settings page inner (must be wrapped in Suspense for useSearchParams) ────
function SettingsPageInner() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useUIPreferencesStore();
  const searchParams = useSearchParams();

  const initialTab = (searchParams.get("tab") ?? "profile") as Tab;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [name, setName] = useState(
    user ? `${user.firstName} ${user.lastName}`.trim() : "",
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "profile",
      label: "Profile",
      icon: <User className="w-3.5 h-3.5" />,
    },
    {
      key: "appearance",
      label: "Appearance",
      icon: <Palette className="w-3.5 h-3.5" />,
    },
    {
      key: "notifications",
      label: "Notifications",
      icon: <Bell className="w-3.5 h-3.5" />,
    },
    {
      key: "security",
      label: "Security",
      icon: <Shield className="w-3.5 h-3.5" />,
    },
    {
      key: "workspace",
      label: "Workspace",
      icon: <Building2 className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)]">
        <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Settings className="w-4 h-4 text-zinc-400" /> Settings
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Manage your account and workspace preferences
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-44 flex-shrink-0 border-r border-[var(--surface-border)] py-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "w-full flex items-center gap-2.5 px-4 py-2 text-sm text-left transition-colors",
                tab === t.key
                  ? "text-[var(--text-primary)] bg-[var(--surface-raised)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-6 max-w-xl">
          {tab === "profile" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Profile Settings
              </h2>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Full Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Email
                </label>
                <input
                  value={user?.email ?? ""}
                  readOnly
                  className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-secondary)] cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Organization
                </label>
                <input
                  value={user?.tenant?.name ?? ""}
                  readOnly
                  className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-secondary)] cursor-not-allowed"
                />
              </div>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {saved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          )}

          {tab === "appearance" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Appearance
              </h2>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Theme
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["dark", "light"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        "py-6 rounded-xl border text-sm font-medium capitalize transition-colors",
                        theme === t
                          ? "border-violet-500 bg-violet-500/10 text-violet-400"
                          : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-violet-500/40",
                      )}
                    >
                      {t === "dark" ? "🌙 Dark" : "☀️ Light"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Notification Preferences
              </h2>
              {[
                {
                  label: "Agent task completed",
                  sub: "Notify when an agent finishes a task",
                },
                {
                  label: "Approval required",
                  sub: "Notify when an agent needs your sign-off",
                },
                {
                  label: "Agent error",
                  sub: "Notify when an agent encounters an error",
                },
                {
                  label: "Weekly summary",
                  sub: "Receive a weekly performance digest",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between py-2 border-b border-[var(--surface-border)]"
                >
                  <div>
                    <p className="text-sm text-[var(--text-primary)]">
                      {item.label}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {item.sub}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-700 rounded-full peer peer-checked:bg-violet-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
              ))}
            </div>
          )}

          {tab === "security" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Security
              </h2>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                />
              </div>
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors">
                <Shield className="w-3.5 h-3.5" /> Update Password
              </button>
            </div>
          )}

          {tab === "workspace" && <WorkspaceTabContent />}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-500" />
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}
