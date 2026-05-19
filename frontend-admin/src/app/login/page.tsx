'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/authStore';

export default function AdminLoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authService.login(email, password);
      const allowedRoles = ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SECURITY_OFFICER', 'SUPPORT'];
      if (!allowedRoles.includes(result.user.role)) {
        throw new Error('Insufficient permissions for admin portal');
      }
      setUser(result.user);
      router.push('/overview');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        (err as Error).message ??
        'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-white">NeureCore Admin</h1>
        <p className="mb-6 text-sm text-gray-400">Super Admin access only</p>
        {error && (
          <div className="mb-4 rounded-lg bg-red-950 border border-red-800 p-3 text-sm text-red-300">{error}</div>
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
            className="mt-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}
