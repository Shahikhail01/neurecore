'use client';

import { useState, FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { routeAfterAuth } from '@/services/auth-redirect.service';
import { useAuthStore } from '@/stores/authStore';
import { PasswordInput } from '@/components/ui/password-input';
import { PageShell, GlassPanel, GradientText } from '@neurecore/ui-visual';

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });

  // Redirect to /home (via shared post-auth logic) if already authenticated
  useEffect(() => {
    if (hasHydrated && user) void routeAfterAuth(router);
  }, [hasHydrated, user, router]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authService.register(form);
      setUser(result.user);
      // Route through the shared post-auth helper so new users land on
      // /onboarding/setup if their tenant isn't yet complete.
      await routeAfterAuth(router);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell variant="auth">
      <div className="flex items-center justify-center min-h-[calc(100vh-3rem)]">
        <GlassPanel variant="auth" padding="lg" className="w-full max-w-md">
          <h1 className="mb-6 text-2xl font-bold">
            <GradientText>Create Account</GradientText>
          </h1>
          {error && (
            <div className="mb-4 rounded-lg border border-[color:var(--state-danger)]/40 bg-[color:var(--state-danger)]/10 p-3 text-sm text-[color:var(--state-danger)]">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {(['firstName', 'lastName'] as const).map((field) => (
              <label key={field} className="flex flex-col gap-1 text-sm font-medium text-zinc-300 capitalize">
                {field === 'firstName' ? 'First Name' : 'Last Name'}
                <input
                  type="text"
                  autoComplete={field === 'firstName' ? 'given-name' : 'family-name'}
                  required
                  value={form[field]}
                  onChange={update(field)}
                  className="nv-surface-inline px-3 py-2 text-base text-zinc-100 outline-none focus:accent-ring"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-300">
              Email
              <input type="email" autoComplete="email" required value={form.email} onChange={update('email')}
                className="nv-surface-inline px-3 py-2 text-base text-zinc-100 outline-none focus:accent-ring"
              />
            </label>
            <label htmlFor="password" className="flex flex-col gap-1 text-sm font-medium text-zinc-300">
              Password
              <PasswordInput
                id="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.password}
                onChange={update('password')}
              />
            </label>
            <button type="submit" disabled={loading}
              className="nv-btn-accent mt-2"
            >
              {loading ? 'Creating account…' : 'Register'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-400">
            Already have an account?{' '}
            <Link href="/login" className="text-[color:var(--accent-400)] hover:underline">Sign in</Link>
          </p>
        </GlassPanel>
      </div>
    </PageShell>
  );
}
