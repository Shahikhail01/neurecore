"use client";

import { useState } from "react";
import {
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Save,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUIPreferencesStore } from "@/shared/stores/uiPreferencesStore";
import { cn } from "@/lib/utils";

type Tab = "profile" | "notifications" | "appearance" | "security";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useUIPreferencesStore();
  const [tab, setTab] = useState<Tab>("profile");
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
        <div className="flex-1 overflow-y-auto hide-scrollbar p-6 max-w-lg">
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
        </div>
      </div>
    </div>
  );
}
