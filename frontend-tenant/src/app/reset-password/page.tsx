"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { PasswordInput } from "@/components/ui/password-input";
import { PageShell, GlassPanel, GradientText } from "@neurecore/ui-visual";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Missing reset token. Use the link from your email.");
      return;
    }

    if (newPassword !== confirm) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(token, newPassword);
      router.push("/login?reset=ok");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Reset failed. The link may have expired.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm text-[color:var(--state-danger)] mb-4">Invalid or missing reset link.</p>
        <Link href="/forgot-password" className="text-[color:var(--accent-400)] hover:underline text-sm">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-2 text-xl font-semibold text-center">
        <GradientText>Set new password</GradientText>
      </h1>
      <p className="mb-6 text-sm text-zinc-400 text-center">
        Enter your new password below.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-[color:var(--state-danger)]/40 bg-[color:var(--state-danger)]/10 p-3 text-sm text-[color:var(--state-danger)]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label htmlFor="newPassword" className="flex flex-col gap-1 text-sm font-medium text-zinc-300">
          New password
          <PasswordInput
            id="newPassword"
            name="newPassword"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <label htmlFor="confirmPassword" className="flex flex-col gap-1 text-sm font-medium text-zinc-300">
          Confirm password
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="nv-btn-accent mt-2"
        >
          {loading ? "Resetting…" : "Reset password"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-400">
        <Link href="/login" className="text-[color:var(--accent-400)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <PageShell variant="auth">
      <div className="flex items-center justify-center min-h-[calc(100vh-3rem)]">
        <GlassPanel variant="auth" padding="lg" className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <img src="/logo.png" alt="NeureCore" className="h-10 w-auto object-contain" />
          </div>
          <Suspense fallback={<p className="text-sm text-zinc-400 text-center">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </GlassPanel>
      </div>
    </PageShell>
  );
}
