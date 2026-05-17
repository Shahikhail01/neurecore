'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import api from '@/services/api';
import { unwrapList, unwrapItem } from '@/services/unwrap';
import { VoiceProfileSettings } from '@/features/settings/components/VoiceProfileSettings';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  settings?: Record<string, unknown>;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  expiresAt?: string;
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="px-6 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const user = useTenantAuth();

  // Tenant profile
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  // Profile edit
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // API keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    void fetchTenant();
    void fetchApiKeys();
  }, [user]);

  async function fetchTenant() {
    setTenantLoading(true);
    try {
      const res = await api.get('/tenants/me');
      setTenant(unwrapItem(res));
    } catch {
      // tenant/me may return 404 for some roles — ignore
    } finally {
      setTenantLoading(false);
    }
  }

  async function fetchApiKeys() {
    setApiKeysLoading(true);
    try {
      const res = await api.get('/api-keys');
      setApiKeys(unwrapList(res).items ?? []);
    } catch {
      setApiKeys([]);
    } finally {
      setApiKeysLoading(false);
    }
  }

  // ── Profile save ────────────────────────────────────────────────────────────

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await api.patch(`/users/${user!.id}`, { firstName, lastName });
      setProfileMsg({ ok: true, text: 'Profile updated successfully.' });
    } catch {
      setProfileMsg({ ok: false, text: 'Failed to update profile.' });
    } finally {
      setProfileSaving(false);
    }
  }

  // ── Password save ───────────────────────────────────────────────────────────

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: 'Passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ ok: false, text: 'Password must be at least 8 characters.' });
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg(null);
    try {
      await api.patch(`/users/${user!.id}/password`, { currentPassword, newPassword });
      setPasswordMsg({ ok: true, text: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPasswordMsg({ ok: false, text: 'Failed to update password. Check your current password.' });
    } finally {
      setPasswordSaving(false);
    }
  }

  // ── Create API key ──────────────────────────────────────────────────────────

  async function handleCreateApiKey(e: FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    try {
      const res = await api.post('/api-keys', { name: newKeyName.trim() });
      const created = unwrapItem(res);
      setCreatedKey(created?.key ?? null);
      setNewKeyName('');
      void fetchApiKeys();
    } catch {
      // show nothing — key creation failed
    }
  }

  async function handleRevokeApiKey(id: string) {
    try {
      await api.delete(`/api-keys/${id}`);
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      // silently ignore
    }
  }

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your profile, security, and workspace.</p>
        </div>

        {/* Tenant profile */}
        {!tenantLoading && tenant && (
          <Section title="Workspace">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-zinc-500 text-xs mb-0.5">Name</dt>
                <dd className="text-zinc-200 font-medium">{tenant.name}</dd>
              </div>
              <div>
                <dt className="text-zinc-500 text-xs mb-0.5">Slug</dt>
                <dd className="text-zinc-400 font-mono">{tenant.slug}</dd>
              </div>
              <div>
                <dt className="text-zinc-500 text-xs mb-0.5">Plan</dt>
                <dd>
                  <span className="px-2 py-0.5 rounded-full bg-violet-900 text-violet-300 text-xs font-medium">
                    {tenant.plan}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 text-xs mb-0.5">Created</dt>
                <dd className="text-zinc-400">{new Date(tenant.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </Section>
        )}

        {/* Profile */}
        <Section title="Profile">
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">First Name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Last Name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Email</label>
              <input
                value={user.email}
                disabled
                className="w-full rounded-lg bg-zinc-800/50 border border-zinc-700 px-3 py-2 text-sm text-zinc-500 cursor-not-allowed"
              />
            </div>
            {profileMsg && (
              <p className={`text-sm ${profileMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {profileMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={profileSaving}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm rounded-lg transition"
            >
              {profileSaving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </Section>

        {/* Password */}
        <Section title="Change Password">
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            {passwordMsg && (
              <p className={`text-sm ${passwordMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {passwordMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={passwordSaving}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm rounded-lg transition"
            >
              {passwordSaving ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </Section>

        {/* API Keys */}
        <Section title="API Keys">
          {/* Created key reveal */}
          {createdKey && (
            <div className="mb-4 rounded-xl border border-emerald-700 bg-emerald-900/40 px-4 py-3">
              <p className="text-xs text-emerald-300 mb-1 font-medium">
                New key created — copy it now. It won&apos;t be shown again.
              </p>
              <code className="text-sm text-emerald-100 break-all">{createdKey}</code>
              <button
                onClick={() => setCreatedKey(null)}
                className="mt-2 block text-xs text-emerald-400 hover:text-emerald-200"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Create form */}
          <form onSubmit={handleCreateApiKey} className="flex gap-3 mb-5">
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. CI/CD pipeline)"
              className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition"
            >
              Generate
            </button>
          </form>

          {/* Key list */}
          {apiKeysLoading ? (
            <p className="text-zinc-500 text-sm">Loading keys…</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-zinc-500 text-sm">No API keys yet.</p>
          ) : (
            <ul className="space-y-2">
              {apiKeys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 px-4 py-3"
                >
                  <div>
                    <span className="text-sm text-zinc-200 font-medium">{k.name}</span>
                    <span className="ml-2 text-xs text-zinc-500 font-mono">{k.prefix}…</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-zinc-500">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => void handleRevokeApiKey(k.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition"
                    >
                      Revoke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
        {/* Voice Profiles */}
        <VoiceProfileSettings />
      </div>
    </TenantShell>
  );
}
