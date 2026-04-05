"use client";

import {
  useState,
  useEffect,
  useCallback,
  type FormEvent,
  type ReactNode,
  Suspense,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  ExternalLink,
  Zap,
  Plug,
  PlugZap,
  PlayCircle,
  Globe,
  Mail,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUIPreferencesStore } from "@/shared/stores/uiPreferencesStore";
import { cn } from "@/lib/utils";
import { workspaceProvisioningService } from "@/services/workspace-provisioning.service";
import type {
  ProvisioningStatusDto,
  ProvisioningJobDto,
  WorkspaceProvisioningConfig,
} from "@/types/onboarding.types";
import {
  ProvisioningProvider,
  EmailPattern,
  FolderStructure,
} from "@/types/onboarding.types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab =
  | "profile"
  | "notifications"
  | "appearance"
  | "security"
  | "workspace";

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-overlay)] overflow-hidden">
      {children}
    </div>
  );
}

function SectionRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-between items-center px-4 py-2.5 border-b border-[var(--surface-border)] last:border-0">
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <div className="text-xs text-[var(--text-primary)] font-medium">
        {children}
      </div>
    </div>
  );
}

// ─── Status chips ─────────────────────────────────────────────────────────────

interface StatusChipProps {
  status: string | null;
}

function StatusChip({ status }: StatusChipProps) {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string; icon?: ReactNode }> =
    {
      PENDING_CONNECT: {
        label: "Pending Connection",
        cls: "bg-amber-900/30 text-amber-400 border-amber-500/30",
        icon: <Clock className="h-3 w-3" />,
      },
      CONNECTED: {
        label: "Connected",
        cls: "bg-green-900/30 text-green-400 border-green-500/30",
        icon: <CheckCircle2 className="h-3 w-3" />,
      },
      IN_PROGRESS: {
        label: "Provisioning…",
        cls: "bg-blue-900/30 text-blue-400 border-blue-500/30",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
      },
      COMPLETED: {
        label: "Completed",
        cls: "bg-green-900/30 text-green-400 border-green-500/30",
        icon: <CheckCircle2 className="h-3 w-3" />,
      },
      FAILED: {
        label: "Failed",
        cls: "bg-red-900/30 text-red-400 border-red-500/30",
        icon: <AlertCircle className="h-3 w-3" />,
      },
    };
  const entry = map[status] ?? {
    label: status,
    cls: "bg-zinc-800 text-zinc-400 border-zinc-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${entry.cls}`}
    >
      {entry.icon}
      {entry.label}
    </span>
  );
}

function JobStatusChip({ status }: { status: string }) {
  const cls: Record<string, string> = {
    PENDING: "bg-zinc-800 text-zinc-400 border-zinc-700",
    IN_PROGRESS: "bg-blue-900/30 text-blue-400 border-blue-500/30",
    COMPLETED: "bg-green-900/30 text-green-400 border-green-500/30",
    FAILED: "bg-red-900/30 text-red-400 border-red-500/30",
    SKIPPED: "bg-zinc-800 text-zinc-500 border-zinc-700",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${cls[status] ?? cls["PENDING"]}`}
    >
      {status.toLowerCase()}
    </span>
  );
}

// ─── Provider Selector ────────────────────────────────────────────────────────

interface ProviderOption {
  value: ProvisioningProvider;
  label: string;
  description: string;
  icon: ReactNode;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    value: ProvisioningProvider.GOOGLE_WORKSPACE,
    label: "Google Workspace",
    description: "Gmail, Drive, Calendar, Docs & Sheets",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    ),
  },
  {
    value: ProvisioningProvider.MICROSOFT_365,
    label: "Microsoft 365",
    description: "Outlook, OneDrive, Teams & SharePoint",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M11.5 3H3v8.5h8.5V3z" fill="#F25022" />
        <path d="M21 3h-8.5v8.5H21V3z" fill="#7FBA00" />
        <path d="M11.5 12.5H3V21h8.5v-8.5z" fill="#00A4EF" />
        <path d="M21 12.5h-8.5V21H21v-8.5z" fill="#FFB900" />
      </svg>
    ),
  },
];

interface ProviderSelectorProps {
  value: ProvisioningProvider;
  onChange: (v: ProvisioningProvider) => void;
}

function ProviderSelector({ value, onChange }: ProviderSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {PROVIDER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
            value === opt.value
              ? "border-violet-500 bg-violet-500/10"
              : "border-[var(--surface-border)] hover:border-violet-500/40",
          )}
        >
          {opt.icon}
          <div>
            <p
              className={cn(
                "text-xs font-semibold",
                value === opt.value
                  ? "text-violet-400"
                  : "text-[var(--text-primary)]",
              )}
            >
              {opt.label}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {opt.description}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Email Pattern Selector ───────────────────────────────────────────────────

const EMAIL_PATTERN_LABELS: Record<EmailPattern, string> = {
  [EmailPattern.FIRST_DOT_LAST]: "first.last",
  [EmailPattern.FIRSTLAST]: "firstlast",
  [EmailPattern.F_DOT_LAST]: "f.last",
};

interface EmailPatternSelectorProps {
  value: EmailPattern;
  domain: string;
  onChange: (v: EmailPattern) => void;
}

function EmailPatternSelector({
  value,
  domain,
  onChange,
}: EmailPatternSelectorProps) {
  const previewDomain = domain.trim() || "company.com";
  const previews: Record<EmailPattern, string> = {
    [EmailPattern.FIRST_DOT_LAST]: `john.doe@${previewDomain}`,
    [EmailPattern.FIRSTLAST]: `johndoe@${previewDomain}`,
    [EmailPattern.F_DOT_LAST]: `j.doe@${previewDomain}`,
  };
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.values(EmailPattern) as EmailPattern[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors",
            value === p
              ? "border-violet-500 bg-violet-500/10 text-violet-400"
              : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-violet-500/40",
          )}
        >
          {EMAIL_PATTERN_LABELS[p]}
          <span className="ml-1.5 opacity-60">→ {previews[p]}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Folder Structure Selector ────────────────────────────────────────────────

const FOLDER_STRUCTURE_LABELS: Record<FolderStructure, string> = {
  [FolderStructure.BY_DEPARTMENT]: "By Department",
  [FolderStructure.FLAT]: "Flat",
};

const FOLDER_STRUCTURE_DESCRIPTIONS: Record<FolderStructure, string> = {
  [FolderStructure.BY_DEPARTMENT]: "Folders grouped under each department name",
  [FolderStructure.FLAT]: "All folders at the same level",
};

interface FolderStructureSelectorProps {
  value: FolderStructure;
  onChange: (v: FolderStructure) => void;
}

function FolderStructureSelector({
  value,
  onChange,
}: FolderStructureSelectorProps) {
  return (
    <div className="flex gap-2">
      {(Object.values(FolderStructure) as FolderStructure[]).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={cn(
            "flex flex-1 flex-col items-start rounded-lg border p-3 text-left transition-colors",
            value === s
              ? "border-violet-500 bg-violet-500/10"
              : "border-[var(--surface-border)] hover:border-violet-500/40",
          )}
        >
          <FolderOpen
            className={cn(
              "mb-1 h-4 w-4",
              value === s ? "text-violet-400" : "text-zinc-500",
            )}
          />
          <p
            className={cn(
              "text-xs font-semibold",
              value === s ? "text-violet-400" : "text-[var(--text-primary)]",
            )}
          >
            {FOLDER_STRUCTURE_LABELS[s]}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            {FOLDER_STRUCTURE_DESCRIPTIONS[s]}
          </p>
        </button>
      ))}
    </div>
  );
}

// ─── Workspace Configuration Form ────────────────────────────────────────────

interface WorkspaceConfigFormState {
  provider: ProvisioningProvider;
  emailDomain: string;
  emailPattern: EmailPattern;
  folderStructure: FolderStructure;
}

const DEFAULT_FORM: WorkspaceConfigFormState = {
  provider: ProvisioningProvider.GOOGLE_WORKSPACE,
  emailDomain: "",
  emailPattern: EmailPattern.FIRST_DOT_LAST,
  folderStructure: FolderStructure.BY_DEPARTMENT,
};

interface WorkspaceConfigFormProps {
  initial: WorkspaceConfigFormState;
  onSaved: (config: WorkspaceProvisioningConfig) => void;
  /** When true the form renders in edit (expanded) mode by default */
  startExpanded?: boolean;
}

function WorkspaceConfigForm({
  initial,
  onSaved,
  startExpanded = false,
}: WorkspaceConfigFormProps) {
  const [form, setForm] = useState<WorkspaceConfigFormState>(initial);
  const [expanded, setExpanded] = useState(startExpanded);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.emailDomain.trim()) {
      setError("Email domain is required.");
      return;
    }
    setSaving(true);
    try {
      const saved = await workspaceProvisioningService.configure({
        provider: form.provider,
        emailDomain: form.emailDomain.trim().toLowerCase(),
        emailPattern: form.emailPattern,
        folderStructure: form.folderStructure,
      });
      onSaved(saved);
      setExpanded(false);
    } catch {
      setError("Failed to save workspace configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-overlay)] overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Workspace Configuration
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        )}
      </button>

      {expanded && (
        <form
          onSubmit={handleSubmit}
          className="border-t border-[var(--surface-border)] p-4 space-y-5"
        >
          {/* Provider */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              Cloud Provider
            </label>
            <ProviderSelector
              value={form.provider}
              onChange={(v) => setForm((f) => ({ ...f, provider: v }))}
            />
          </div>

          {/* Email Domain */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              <Mail className="inline h-3 w-3 mr-1" />
              Corporate Email Domain
            </label>
            <div className="flex items-center rounded-md border border-[var(--surface-border)] bg-[var(--surface-overlay)] overflow-hidden focus-within:border-violet-500">
              <span className="px-3 py-2 text-xs text-zinc-500 border-r border-[var(--surface-border)]">
                @
              </span>
              <input
                value={form.emailDomain}
                onChange={(e) =>
                  setForm((f) => ({ ...f, emailDomain: e.target.value }))
                }
                placeholder="company.com"
                className="flex-1 px-3 py-2 text-xs text-[var(--text-primary)] bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {/* Email Pattern */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              <Mail className="inline h-3 w-3 mr-1" />
              Email Address Pattern
            </label>
            <EmailPatternSelector
              value={form.emailPattern}
              domain={form.emailDomain}
              onChange={(v) => setForm((f) => ({ ...f, emailPattern: v }))}
            />
          </div>

          {/* Folder Structure */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              <FolderOpen className="inline h-3 w-3 mr-1" />
              Cloud Storage Folder Structure
            </label>
            <FolderStructureSelector
              value={form.folderStructure}
              onChange={(v) => setForm((f) => ({ ...f, folderStructure: v }))}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Configuration
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Connection Panel ─────────────────────────────────────────────────────────

interface ConnectionPanelProps {
  status: ProvisioningStatusDto;
  config: WorkspaceProvisioningConfig | null;
  onConnected: () => void;
  onDisconnected: () => void;
}

function ConnectionPanel({
  status,
  config,
  onConnected,
  onDisconnected,
}: ConnectionPanelProps) {
  const [connectLoading, setConnectLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // onConnected is reserved for a future pop-up OAuth flow
  void onConnected;

  const providerLabel =
    status.provider === ProvisioningProvider.GOOGLE_WORKSPACE
      ? "Google Workspace"
      : status.provider === ProvisioningProvider.MICROSOFT_365
        ? "Microsoft 365"
        : null;

  const handleConnect = async () => {
    if (!status.provider) return;
    setConnectError(null);
    setConnectLoading(true);
    try {
      const url =
        status.provider === ProvisioningProvider.GOOGLE_WORKSPACE
          ? await workspaceProvisioningService.getGoogleAuthUrl()
          : await workspaceProvisioningService.getMicrosoftAuthUrl();
      window.location.href = url;
    } catch {
      setConnectError(
        "Could not generate OAuth URL. Check your server configuration.",
      );
      setConnectLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setConnectError(null);
    setDisconnectLoading(true);
    try {
      await workspaceProvisioningService.disconnect();
      onDisconnected();
    } catch {
      setConnectError("Failed to disconnect. Please try again.");
    } finally {
      setDisconnectLoading(false);
    }
  };

  const configStatus = config?.status ?? status.status;
  const isConnected =
    configStatus === "CONNECTED" ||
    configStatus === "IN_PROGRESS" ||
    configStatus === "COMPLETED";

  return (
    <SectionCard>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            OAuth Connection
          </span>
        </div>
        <StatusChip status={configStatus ?? null} />
      </div>

      <div className="border-t border-[var(--surface-border)] divide-y divide-[var(--surface-border)]">
        {providerLabel && (
          <SectionRow label="Provider">{providerLabel}</SectionRow>
        )}
        {config?.emailDomain && (
          <SectionRow label="Email Domain">@{config.emailDomain}</SectionRow>
        )}
        {config?.emailPattern && (
          <SectionRow label="Email Pattern">
            {EMAIL_PATTERN_LABELS[config.emailPattern] ?? config.emailPattern}
          </SectionRow>
        )}
        {config?.folderStructure && (
          <SectionRow label="Folder Structure">
            {FOLDER_STRUCTURE_LABELS[config.folderStructure] ??
              config.folderStructure}
          </SectionRow>
        )}
      </div>

      <div className="border-t border-[var(--surface-border)] px-4 py-3 flex flex-wrap items-center gap-3">
        {!isConnected && providerLabel && (
          <button
            onClick={handleConnect}
            disabled={connectLoading}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
          >
            {connectLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Connect {providerLabel}
          </button>
        )}
        {isConnected && (
          <button
            onClick={handleDisconnect}
            disabled={disconnectLoading}
            className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-900/20 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-900/40 disabled:opacity-50"
          >
            {disconnectLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlugZap className="h-4 w-4" />
            )}
            Disconnect
          </button>
        )}
      </div>

      {connectError && (
        <div className="border-t border-[var(--surface-border)] px-4 py-2">
          <p className="text-xs text-red-400">{connectError}</p>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Provisioning Jobs Table ──────────────────────────────────────────────────

interface ProvisioningJobsTableProps {
  jobs: ProvisioningJobDto[];
  canTrigger: boolean;
  onTriggered: (jobs: ProvisioningJobDto[]) => void;
}

function ProvisioningJobsTable({
  jobs,
  canTrigger,
  onTriggered,
}: ProvisioningJobsTableProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleTrigger = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await workspaceProvisioningService.triggerProvisioning();
      setMessage(
        `Queued ${result.queued} provisioning job${result.queued !== 1 ? "s" : ""}.`,
      );
      const refreshed = await workspaceProvisioningService.listJobs();
      onTriggered(refreshed);
    } catch (err: unknown) {
      setMessage(
        `Error: ${err instanceof Error ? err.message : "Provisioning failed"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const hasPending = jobs.some((j) => j.status === "PENDING");

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--text-primary)]">
          Provisioning Jobs ({jobs.length})
        </p>
        <div className="flex items-center gap-2">
          {message && <span className="text-xs text-zinc-400">{message}</span>}
          {canTrigger && (
            <button
              onClick={handleTrigger}
              disabled={loading || !hasPending}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              Provision all pending
            </button>
          )}
        </div>
      </div>

      {jobs.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">
          No provisioning jobs found. Team members invited during onboarding
          will appear here.
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
  );
}

// ─── Workspace Tab Content ────────────────────────────────────────────────────

/**
 * WorkspaceTabContent
 * All workspace integration options are always available — regardless of
 * whether the user previously went through the onboarding wizard.
 * After saving a configuration, the OAuth connection panel is revealed.
 * Once connected, the provisioning jobs table is shown.
 */
function WorkspaceTabContent() {
  const [provStatus, setProvStatus] = useState<ProvisioningStatusDto | null>(
    null,
  );
  const [config, setConfig] = useState<WorkspaceProvisioningConfig | null>(
    null,
  );
  const [jobs, setJobs] = useState<ProvisioningJobDto[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, configRes, jobsRes] = await Promise.allSettled([
        workspaceProvisioningService.getStatus(),
        workspaceProvisioningService.getConfig(),
        workspaceProvisioningService.listJobs(),
      ]);
      if (statusRes.status === "fulfilled") setProvStatus(statusRes.value);
      if (configRes.status === "fulfilled") setConfig(configRes.value);
      if (jobsRes.status === "fulfilled") setJobs(jobsRes.value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSaved = useCallback(
    (saved: WorkspaceProvisioningConfig) => {
      setConfig(saved);
      void reload();
    },
    [reload],
  );

  const handleRefetch = useCallback(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-10 rounded-md bg-[var(--surface-overlay)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const hasConfig = Boolean(config?.provider);
  const configStatus = config?.status ?? provStatus?.status;
  const isConnected =
    configStatus === "CONNECTED" ||
    configStatus === "IN_PROGRESS" ||
    configStatus === "COMPLETED";

  const formInitial: WorkspaceConfigFormState = {
    provider: config?.provider ?? ProvisioningProvider.GOOGLE_WORKSPACE,
    emailDomain: config?.emailDomain ?? "",
    emailPattern: config?.emailPattern ?? EmailPattern.FIRST_DOT_LAST,
    folderStructure: config?.folderStructure ?? FolderStructure.BY_DEPARTMENT,
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Workspace Integration
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Connect Google Workspace or Microsoft 365 to auto-provision corporate
          email accounts and cloud storage folders for your team.
        </p>
      </div>

      {/* ── 1. Configuration form — always accessible ─────────────────── */}
      <WorkspaceConfigForm
        initial={formInitial}
        onSaved={handleSaved}
        startExpanded={!hasConfig}
      />

      {/* ── 2. OAuth connection panel — shown once config exists ───────── */}
      {hasConfig && provStatus && (
        <ConnectionPanel
          status={provStatus}
          config={config}
          onConnected={handleRefetch}
          onDisconnected={handleRefetch}
        />
      )}

      {/* ── 3. Jobs table — shown when OAuth is connected ───────────────── */}
      {isConnected && (
        <ProvisioningJobsTable
          jobs={jobs}
          canTrigger={configStatus === "CONNECTED"}
          onTriggered={setJobs}
        />
      )}
    </div>
  );
}

// ─── Onboarding Re-run Section ────────────────────────────────────────────────

/**
 * OnboardingRerunSection
 * Allows the admin to restart the onboarding wizard to update company
 * information, plan, departments, team members, or integrations at any time.
 */
function OnboardingRerunSection() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRerun = () => {
    setLoading(true);
    router.push("/onboarding?rerun=1");
  };

  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-overlay)] p-4">
      <div className="flex items-start gap-3">
        <PlayCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-violet-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Re-run Onboarding Wizard
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Update your company details, plan, departments, team members, or
            integrations at any time by re-running the setup wizard.
          </p>
          <button
            onClick={handleRerun}
            disabled={loading}
            className="mt-3 flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-400 transition hover:bg-violet-500/20 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
            Launch Setup Wizard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Settings page inner ──────────────────────────────────────────────────────

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

  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
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

              <div className="pt-4 border-t border-[var(--surface-border)]">
                <OnboardingRerunSection />
              </div>
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
