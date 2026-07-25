'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, AuthError } from '@/auth';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, state } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (state.status === 'authenticated') {
      router.replace('/overview');
    } else if (state.status === 'unauthenticated' && state.reason === 'locked_out' && state.lockoutRemainingSeconds) {
      setError(`Too many attempts. Try again in ${Math.ceil(state.lockoutRemainingSeconds / 60)} minute(s).`);
    }
    // Check URL for middleware redirect reason
    const urlParams = new URLSearchParams(window.location.search);
    const reason = urlParams.get('reason');
    if (reason === 'insufficient') {
      setError('Admin portal access restricted to SUPER_ADMIN only.');
    }
  }, [state, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email, password });
      // useEffect above redirects on state transition to authenticated.
    } catch (err: unknown) {
      if (err instanceof AuthError && err.code === 'account_locked' && err.retryAfterSeconds) {
        setError(`Too many attempts. Try again in ${Math.ceil(err.retryAfterSeconds / 60)} minute(s).`);
      } else if (err instanceof AuthError) {
        setError(err.message || 'Invalid credentials');
      } else {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-8 shadow-xl">
        <div className="flex justify-center mb-6">
          <img src="/admin/logo.png" alt="NeureCore" className="h-10 w-auto object-contain" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white text-center">Admin Portal</h1>
        <p className="mb-6 text-sm text-gray-400">Super Admin access only</p>
        {error && (
          <div className="mb-4 rounded-lg bg-[color:var(--state-danger)] border border-red-800 p-3 text-sm text-red-300">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-300">
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-300">
            Password
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <button type="submit" disabled={loading}
            className="mt-2 rounded-lg bg-[color:var(--accent-500)] px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}
