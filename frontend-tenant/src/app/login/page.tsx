"use client";

import { useState, FormEvent, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, AuthError } from "@/auth";
import { routeAfterAuth } from "@/services/auth-redirect.service";
import { PasswordInput } from "@/components/ui/password-input";
import { PageShell, GlassPanel, GlassModal } from "@neurecore/ui-visual";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: { theme?: string; size?: string; text?: string; shape?: string; width?: number }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function GoogleSignInButton({ onError }: { onError: (msg: string) => void }) {
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const lastCredentialRef = useRef<string | null>(null);

  const completeSignIn = useCallback(async (credential: string, intent: 'signin' | 'link' = 'signin') => {
    setLoading(true);
    try {
      await loginWithGoogle(credential, intent);
      await routeAfterAuth(router);
    } catch (err: unknown) {
      if (err instanceof AuthError && err.code === 'existing_unlinked') {
        lastCredentialRef.current = credential;
        const event = new CustomEvent('neurecore:google-account-exists', {
          detail: { email: err.email },
        });
        window.dispatchEvent(event);
        return;
      }
      onError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }, [router, loginWithGoogle, onError]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || initializedRef.current) return;
    initializedRef.current = true;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) {
        setTimeout(initGoogle, 100);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          await completeSignIn(response.credential);
        },
      });
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: 280,
        });
      }
    };

    if (!document.getElementById("google-identity-services-script")) {
      const script = document.createElement("script");
      script.id = "google-identity-services-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
    } else {
      initGoogle();
    }
  }, [completeSignIn]);

  // Listen for "link this account" trigger from the prompt modal
  useEffect(() => {
    const handler = () => {
      if (lastCredentialRef.current) {
        void completeSignIn(lastCredentialRef.current, 'link');
      }
    };
    window.addEventListener('neurecore:google-link-account', handler);
    return () => window.removeEventListener('neurecore:google-link-account', handler);
  }, [completeSignIn]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={buttonRef} className={loading ? "opacity-50 pointer-events-none" : ""} />
    </div>
  );
}

// Post-auth redirect logic moved to services/auth-redirect.service.ts so both
// /login and /register use the same code path.

function LoginForm({ resetSuccess }: { resetSuccess?: boolean }) {
  const router = useRouter();
  const { login, state } = useAuth();
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (state.status === 'authenticated') {
      void routeAfterAuth(router);
    }
  }, [state, router]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkPrompt, setLinkPrompt] = useState<{ email: string; firstName?: string } | null>(null);

  useEffect(() => {
    if (state.status === 'unauthenticated' && state.reason === 'locked_out' && state.lockoutRemainingSeconds) {
      setError(`Too many attempts. Try again in ${Math.ceil(state.lockoutRemainingSeconds / 60)} minute(s).`);
    }
  }, [state]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ email: string; firstName?: string }>).detail;
      setLinkPrompt({ email: detail.email, firstName: detail.firstName });
    };
    window.addEventListener('neurecore:google-account-exists', handler);
    return () => window.removeEventListener('neurecore:google-account-exists', handler);
  }, []);

  const handleGoogleError = useCallback((msg: string) => {
    setError(msg);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email, password });
      // state will transition to authenticated, useEffect above routes us.
    } catch (err: unknown) {
      if (err instanceof AuthError && err.code === 'account_locked' && err.retryAfterSeconds) {
        setError(`Too many attempts. Try again in ${Math.ceil(err.retryAfterSeconds / 60)} minute(s).`);
      } else if (err instanceof AuthError) {
        setError(err.message || 'Invalid credentials');
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <GlassPanel variant="auth" padding="lg" className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="NeureCore" className="h-10 w-auto object-contain" />
        </div>
        <h1 className="sr-only">Sign In to NeureCore</h1>
        <div className="flex justify-center mb-4">
          <GoogleSignInButton onError={handleGoogleError} />
        </div>
        {resetSuccess && !error && (
          <div className="mb-4 rounded-lg border border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10 p-3 text-sm text-[color:var(--state-success)]">
            Password reset successful. You can now sign in.
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-[color:var(--state-danger)]/40 bg-[color:var(--state-danger)]/10 p-3 text-sm text-[color:var(--state-danger)]">
            {error}
          </div>
        )}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="nv-surface-inline px-2 text-zinc-400">Or continue with email</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-300">
            Email
              <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="nv-surface-inline px-3 py-2 text-base text-zinc-100 outline-none focus:accent-ring placeholder:text-zinc-500"
            />
          </label>
          <div className="flex flex-col gap-1 text-sm font-medium text-zinc-300">
            <div className="flex items-center justify-between">
              <label htmlFor="password">Password</label>
              <Link
                href="/forgot-password"
                className="text-xs font-normal text-[color:var(--accent-400)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="nv-btn-accent mt-2"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-400">
          No account?{" "}
          <Link href="/register" className="text-[color:var(--accent-400)] hover:underline">
            Register
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-zinc-500">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="text-zinc-400 hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-zinc-400 hover:underline">
            Privacy Policy
          </Link>
        </p>
      </GlassPanel>

      <GlassModal
        open={!!linkPrompt}
        onClose={() => setLinkPrompt(null)}
        title="Account already exists"
        size="sm"
      >
        <p className="text-sm text-zinc-400">
          An account with <strong className="text-zinc-100">{linkPrompt?.email}</strong> already
          exists but is not linked to Google sign-in. How would you like to proceed?
        </p>
        <div className="mt-5 flex gap-2 justify-end">
          <button
            onClick={() => setLinkPrompt(null)}
            className="nv-surface-inline px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-zinc-100"
          >
            Use different Google account
          </button>
          <button
            onClick={() => {
              setLinkPrompt(null);
              window.dispatchEvent(new Event('neurecore:google-link-account'));
            }}
            className="nv-btn-accent"
          >
            Link this Google account
          </button>
        </div>
      </GlassModal>
    </>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  return <LoginForm resetSuccess={searchParams.get("reset") === "ok"} />;
}

export default function LoginPage() {
  return (
    <PageShell variant="auth">
      <div className="flex items-center justify-center min-h-[calc(100vh-3rem)]">
        <Suspense fallback={<LoginForm />}>
          <LoginPageInner />
        </Suspense>
      </div>
    </PageShell>
  );
}
