"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Loader2,
  LayoutDashboard,
  LogOut,
  Layers,
  Zap,
} from "lucide-react";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/authStore";

type UiMode = "legacy" | "nocobase";

const UI_MODE_KEY = "ui_mode";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated, setUser, user, clearUser } =
    useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [uiMode, setUiMode] = useState<UiMode>("legacy");
  const mounted = useRef(false);

  // Load persisted UI mode preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(UI_MODE_KEY) as UiMode | null;
      if (saved === "legacy" || saved === "nocobase") {
        setUiMode(saved);
      }
    } catch {
      // localStorage may be unavailable in SSR or restricted contexts
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function handleUiModeChange(mode: UiMode) {
    setUiMode(mode);
    try {
      localStorage.setItem(UI_MODE_KEY, mode);
    } catch {
      // ignore storage errors
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authService.logout();
    } finally {
      clearUser();
      setSigningOut(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      const result = await authService.login({ email: email.trim(), password });
      setUser(result.user);
      if (!result.user.tenantId) {
        router.replace("/onboarding");
      } else if (uiMode === "nocobase") {
        router.replace("/nocobase-ui");
      } else {
        router.replace("/dashboard");
      }
    } catch (err: unknown) {
      if (mounted.current) {
        setError(
          err instanceof Error
            ? err.message
            : "Invalid credentials. Please try again.",
        );
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07070a] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-violet-400">Neure</span>Core
          </span>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in to your workspace
          </p>
        </div>

        {/* Already signed in */}
        {_hasHydrated && isAuthenticated && user ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto">
              <span className="text-lg font-bold text-violet-400">
                {user.firstName?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-zinc-400">{user.email}</p>
            </div>
            <p className="text-xs text-zinc-500">
              You&apos;re already signed in
            </p>
            <Link
              href={user.tenantId ? "/dashboard" : "/onboarding"}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-md bg-violet-600 hover:bg-violet-500 transition-colors text-sm font-medium"
            >
              <LayoutDashboard className="w-4 h-4" />
              Continue to Dashboard
            </Link>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-md border border-zinc-700 hover:border-zinc-600 text-sm text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              {signingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              {signingOut ? "Signing out…" : "Sign out & use different account"}
            </button>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-400">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 pr-10 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPwd ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              {/* UI Mode Toggle */}
              <div>
                <p className="text-xs font-medium text-zinc-400 mb-2">
                  Interface
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUiModeChange("legacy")}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                      uiMode === "legacy"
                        ? "border-violet-500 bg-violet-500/10 text-violet-300"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span>Legacy UI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUiModeChange("nocobase")}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                      uiMode === "nocobase"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 shrink-0" />
                    <span>New UI (NocoBase)</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-2 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-sm text-zinc-500 mt-4">
          No account?{" "}
          <Link
            href="/register"
            className="text-violet-400 hover:text-violet-300 transition-colors"
          >
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}
