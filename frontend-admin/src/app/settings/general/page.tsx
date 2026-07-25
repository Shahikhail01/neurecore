"use client";

import { useState } from "react";

export default function GeneralSettingsPage() {
  const [settings, setSettings] = useState({
    platformName: "NeureCore",
    supportEmail: "support@neurecore.com",
    defaultLanguage: "en",
    defaultTimezone: "UTC",
    maintenanceMode: false,
    maintenanceMessage: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">
          General Settings
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          Configure platform-wide general settings
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">
            Platform Name
          </label>
          <input
            value={settings.platformName}
            onChange={(e) =>
              setSettings((s) => ({ ...s, platformName: e.target.value }))
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
          />
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">
            Support Email
          </label>
          <input
            type="email"
            value={settings.supportEmail}
            onChange={(e) =>
              setSettings((s) => ({ ...s, supportEmail: e.target.value }))
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">
              Default Language
            </label>
            <select
              value={settings.defaultLanguage}
              onChange={(e) =>
                setSettings((s) => ({ ...s, defaultLanguage: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">
              Default Timezone
            </label>
            <select
              value={settings.defaultTimezone}
              onChange={(e) =>
                setSettings((s) => ({ ...s, defaultTimezone: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
              <option value="Asia/Tokyo">Tokyo</option>
            </select>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-medium text-zinc-200">Maintenance Mode</div>
              <div className="text-xs text-zinc-500">
                Enable to show maintenance page to users
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    maintenanceMode: e.target.checked,
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[color:var(--accent-500)]"></div>
            </label>
          </div>

          {settings.maintenanceMode && (
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                Maintenance Message
              </label>
              <textarea
                value={settings.maintenanceMessage}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    maintenanceMessage: e.target.value,
                  }))
                }
                rows={3}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 resize-none"
                placeholder="We'll be back soon!"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
