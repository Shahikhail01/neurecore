'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import { INDUSTRIES, INDUSTRY_LABELS } from '@/lib/industries';

export default function NewTenantPage() {
  const user = useAdminAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  // Phase 1 G11 — default to the same constant the tenant lib uses so
  // the admin's "Create New Tenant" matches the canonical 16-industry
  // taxonomy. Previously this defaulted to a stale hardcoded value.
  const [industry, setIndustry] = useState<string>(INDUSTRIES[0]);
  const [website, setWebsite] = useState('');
  const [tierId, setTierId] = useState('tier_enterprise');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post('/tenants', {
        name,
        slug,
        industry,
        website: website || undefined,
        tierId,
      });
      router.push('/tenants');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant');
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === name.toLowerCase().replace(/\s+/g, '-')) {
      setSlug(value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    }
  };

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/tenants')}
            className="text-sm text-gray-400 hover:text-gray-200 mb-4 flex items-center gap-1"
          >
            ← All Tenants
          </button>
          <h1 className="text-2xl font-bold">Create New Tenant</h1>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-[color:var(--state-danger)] border border-red-800 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                Company Name <span className="text-[color:var(--state-danger)]">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Piracha Associates"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-300 mb-1">
                Slug <span className="text-[color:var(--state-danger)]">*</span>
              </label>
              <input
                id="slug"
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="piracha-associates"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">Lowercase alphanumeric with hyphens. Must be unique.</p>
            </div>

            <div>
              <label htmlFor="industry" className="block text-sm font-medium text-gray-300 mb-1">
                Industry
              </label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {/* Phase 1 G11 — options derive from the canonical
                    INDUSTRIES list in src/lib/industries.ts. The previous
                    hardcoded 10-entry list was missing
                    accounting-audit-services and several other valid
                    slugs. */}
                {INDUSTRIES.map((slug) => (
                  <option key={slug} value={slug}>
                    {INDUSTRY_LABELS[slug]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-medium text-gray-300 mb-1">
                Website
              </label>
              <input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://pirachaassociates.my"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="tier" className="block text-sm font-medium text-gray-300 mb-1">
                Plan
              </label>
              <select
                id="tier"
                value={tierId}
                onChange={(e) => setTierId(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="tier_enterprise">Enterprise ($499/mo)</option>
                <option value="tier_pro">Professional ($99/mo)</option>
                <option value="tier_starter">Starter ($29/mo)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 text-white text-sm font-medium transition"
            >
              {loading ? 'Creating…' : 'Create Tenant'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/tenants')}
              className="px-6 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-300 text-sm transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
