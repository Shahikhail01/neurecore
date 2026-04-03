"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import { authService } from "@/services/auth.service";
import { onboardingApi as onboardingService } from "@/services/onboarding.service";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { WizardStep } from "@/types/onboarding.types";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$49/mo",
    agents: 3,
    desc: "Perfect for small teams",
  },
  {
    id: "professional",
    name: "Professional",
    price: "$149/mo",
    agents: 10,
    desc: "For growing businesses",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    agents: -1,
    desc: "Unlimited scale",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated, setUser } = useAuthStore();
  const { startWizard, setCurrentStep } = useOnboardingStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("professional");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isNavigatingRef = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (isAuthenticated) router.replace("/dashboard");
  }, [_hasHydrated, isAuthenticated, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || isNavigatingRef.current) return;
    if (!name.trim() || !email.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const trimmedName = name.trim();
      const spaceIdx = trimmedName.indexOf(" ");
      const firstName =
        spaceIdx === -1 ? trimmedName : trimmedName.slice(0, spaceIdx);
      const lastName =
        spaceIdx === -1
          ? undefined
          : trimmedName.slice(spaceIdx + 1).trim() || undefined;
      const result = await authService.register({
        firstName,
        ...(lastName && { lastName }),
        email: email.trim(),
        password,
      });

      // Start wizard before setting user to avoid guard firing early
      const wizardResult = await onboardingService.startAuthenticatedWizard(
        result.tokens.accessToken,
      );
      startWizard(wizardResult.wizardId, result.tokens.accessToken);
      setCurrentStep(WizardStep.ORGANIZATION);

      isNavigatingRef.current = true;
      setUser(result.user);
      router.replace("/onboarding");
    } catch (err: unknown) {
      if (mounted.current) {
        setError(
          err instanceof Error
            ? err.message
            : "Registration failed. Please try again.",
        );
        isNavigatingRef.current = false;
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07070a] px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-violet-400">Neure</span>Core
          </span>
          <p className="mt-2 text-sm text-zinc-400">Create your workspace</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Full name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Work email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
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

            {/* Plan selector */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                Choose a plan
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PLANS.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative p-3 rounded-lg border text-left transition-colors ${
                      selectedPlan === plan.id
                        ? "border-violet-500 bg-violet-600/10"
                        : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                    }`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider text-violet-400 bg-zinc-900 px-1.5 whitespace-nowrap">
                        Popular
                      </span>
                    )}
                    {selectedPlan === plan.id && (
                      <Check className="absolute top-2 right-2 w-3 h-3 text-violet-400" />
                    )}
                    <p className="text-xs font-semibold text-zinc-100">
                      {plan.name}
                    </p>
                    <p className="text-[10px] text-violet-400 font-medium mt-0.5">
                      {plan.price}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {plan.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !name || !email || !password}
              className="w-full py-2.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Setting up workspace…" : "Create workspace"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-500 mt-4">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-violet-400 hover:text-violet-300 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
