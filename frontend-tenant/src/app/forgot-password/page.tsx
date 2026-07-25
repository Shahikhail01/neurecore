"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { PageShell, GlassPanel, GradientText } from "@neurecore/ui-visual";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell variant="auth">
      <div className="flex items-center justify-center min-h-[calc(100vh-3rem)]">
        <GlassPanel variant="auth" padding="lg" className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <img src="/logo.png" alt="NeureCore" className="h-10 w-auto object-contain" />
          </div>

          {sent ? (
            <>
              <h1 className="mb-2 text-xl font-semibold text-center">
                <GradientText>Check your email</GradientText>
              </h1>
              <p className="text-sm text-zinc-400 text-center">
                If an account with that email exists, we&apos;ve sent a password reset link.
              </p>
              <p className="mt-6 text-center text-sm text-zinc-400">
                <Link href="/login" className="text-[color:var(--accent-400)] hover:underline">
                  Back to sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="mb-2 text-xl font-semibold text-center">
                <GradientText>Forgot password</GradientText>
              </h1>
              <p className="mb-6 text-sm text-zinc-400 text-center">
                Enter your email and we&apos;ll send you a reset link.
              </p>

              {error && (
                <div className="mb-4 rounded-lg border border-[color:var(--state-danger)]/40 bg-[color:var(--state-danger)]/10 p-3 text-sm text-[color:var(--state-danger)]">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1 text-sm font-medium text-zinc-300">
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="nv-surface-inline px-3 py-2 text-base text-zinc-100 outline-none focus:accent-ring"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="nv-btn-accent mt-2"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-zinc-400">
                <Link href="/login" className="text-[color:var(--accent-400)] hover:underline">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </GlassPanel>
      </div>
    </PageShell>
  );
}
