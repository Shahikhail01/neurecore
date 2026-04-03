'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { Zap, Users, GitBranch, BarChart3, Shield, Globe, LayoutDashboard } from "lucide-react";
import { useAuthStore } from '@/stores/authStore';

const FEATURES = [
  {
    icon: Zap,
    title: "Autonomous Agents",
    desc: "Deploy AI employees that work 24/7 on your behalf — analyse, decide, and execute.",
  },
  {
    icon: GitBranch,
    title: "Workflow Engine",
    desc: "Build multi-step automated pipelines. Agents hand off tasks with full traceability.",
  },
  {
    icon: Users,
    title: "AI Team Roster",
    desc: "Hire, configure, and manage your virtual org structure with role-based AI agents.",
  },
  {
    icon: BarChart3,
    title: "Live Analytics",
    desc: "Real-time KPIs, cost tracking, and performance telemetry across your entire operation.",
  },
  {
    icon: Shield,
    title: "Human-in-the-Loop",
    desc: "Set approval gates for high-stakes decisions. Full audit trail on every action.",
  },
  {
    icon: Globe,
    title: "CRM & Connectors",
    desc: "Connect Salesforce, HubSpot, Slack, and 100+ tools. Agents act across your stack.",
  },
];

const TIERS = [
  {
    name: "Starter",
    price: "$49",
    agents: 3,
    highlight: false,
    features: [
      "3 AI Agents",
      "10 Workflows",
      "Basic Analytics",
      "Email Support",
    ],
  },
  {
    name: "Professional",
    price: "$149",
    agents: 10,
    highlight: true,
    features: [
      "10 AI Agents",
      "Unlimited Workflows",
      "Advanced Analytics",
      "Priority Support",
      "Custom Integrations",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    agents: -1,
    highlight: false,
    features: [
      "Unlimited Agents",
      "Dedicated Infra",
      "SLA Guarantee",
      "24/7 Support",
      "SSO & Audit Export",
    ],
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated, user } = useAuthStore();

  // Redirect already-authenticated users straight to the app
  useEffect(() => {
    if (!_hasHydrated) return;
    if (isAuthenticated && user) {
      router.replace(user.tenantId ? '/dashboard' : '/onboarding');
    }
  }, [_hasHydrated, isAuthenticated, user, router]);

  return (
    <div className="min-h-screen bg-[#07070a] text-zinc-100">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14 border-b border-zinc-800/60 bg-[#07070a]/80 backdrop-blur-md">
        <span className="font-bold text-base tracking-tight">
          <span className="text-violet-400">Neure</span>Core
        </span>
        <div className="flex items-center gap-3">
          {isAuthenticated && _hasHydrated ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 transition-colors font-medium"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Open Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="text-sm px-4 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 transition-colors font-medium"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          AI-Powered Business Automation
        </div>
        <h1 className="text-5xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
          Your company runs itself —{" "}
          <span className="text-violet-400">intelligently</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-400 max-w-xl mx-auto">
          Deploy AI agents that plan, execute, and report on every business
          function. A complete operating system for the modern enterprise.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          {isAuthenticated && _hasHydrated ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-violet-600 hover:bg-violet-500 transition-colors font-medium text-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              Open Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="px-6 py-2.5 rounded-md bg-violet-600 hover:bg-violet-500 transition-colors font-medium text-sm"
              >
                Start free trial
              </Link>
              <Link
                href="/login"
                className="px-6 py-2.5 rounded-md border border-zinc-700 hover:border-zinc-500 transition-colors text-sm text-zinc-300"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <h2 className="text-center text-2xl font-bold mb-12">
          Everything your business needs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-violet-500/40 transition-colors"
            >
              <Icon className="w-5 h-5 text-violet-400 mb-3" />
              <h3 className="font-semibold text-sm mb-1">{title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <h2 className="text-center text-2xl font-bold mb-2">Simple pricing</h2>
        <p className="text-center text-zinc-400 text-sm mb-12">
          Start small, scale to enterprise
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`p-6 rounded-xl border transition-colors ${
                tier.highlight
                  ? "border-violet-500 bg-violet-600/10 ring-1 ring-violet-500/30"
                  : "border-zinc-800 bg-zinc-900/50"
              }`}
            >
              {tier.highlight && (
                <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-violet-400 bg-violet-500/20 px-2 py-0.5 rounded-full mb-3">
                  Most Popular
                </span>
              )}
              <h3 className="font-bold text-lg">{tier.name}</h3>
              <p className="text-3xl font-bold mt-2 mb-4">
                {tier.price}
                {tier.price !== "Custom" && (
                  <span className="text-sm font-normal text-zinc-400">/mo</span>
                )}
              </p>
              <ul className="space-y-2 mb-6">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="text-sm text-zinc-300 flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={isAuthenticated && _hasHydrated ? "/dashboard" : "/register"}
                className={`block text-center text-sm py-2 rounded-md font-medium transition-colors ${
                  tier.highlight
                    ? "bg-violet-600 hover:bg-violet-500 text-white"
                    : "border border-zinc-700 hover:border-zinc-500 text-zinc-300"
                }`}
              >
                {isAuthenticated && _hasHydrated ? "Open Dashboard" : "Get started"}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 px-6 text-center text-sm text-zinc-500">
        © 2026 NeureCore · Built for the AI-first enterprise
      </footer>
    </div>
  );
}
