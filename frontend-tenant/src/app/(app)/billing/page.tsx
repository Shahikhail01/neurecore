"use client";

import { useEffect, useState } from "react";
import { CreditCard, Download, ChevronRight, CheckCircle2 } from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/stores/authStore";

interface Invoice {
  id: string;
  amount: number;
  status: string;
  period: string;
  pdfUrl?: string;
}

const PLANS = [
  {
    name: "Starter",
    price: "$29/mo",
    features: ["3 agents", "100 tasks/mo", "Basic analytics"],
    color: "border-zinc-500/30",
  },
  {
    name: "Professional",
    price: "$99/mo",
    features: [
      "15 agents",
      "2,000 tasks/mo",
      "Full analytics",
      "Priority support",
    ],
    color: "border-violet-500/50",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    features: [
      "Unlimited agents",
      "Unlimited tasks",
      "Custom integrations",
      "Dedicated support",
    ],
    color: "border-blue-500/30",
  },
];

export default function BillingPage() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/finance/invoices")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setInvoices(res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const currentPlan = (user as { plan?: string })?.plan ?? "starter";

  return (
    <div className="h-full overflow-y-auto hide-scrollbar">
      <div className="px-5 py-4 border-b border-[var(--surface-border)]">
        <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-violet-400" /> Billing & Plans
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Manage your subscription and payment information
        </p>
      </div>

      <div className="p-5 space-y-6 max-w-3xl">
        {/* Current plan banner */}
        <div className="bg-violet-600/10 border border-violet-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Current Plan:{" "}
              <span className="text-violet-400 capitalize">{currentPlan}</span>
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Your next billing date will appear here once connected to Stripe
            </p>
          </div>
          <button className="px-3 py-1.5 rounded-md border border-violet-500/40 text-xs text-violet-400 hover:bg-violet-500/10 transition-colors">
            Manage
          </button>
        </div>

        {/* Plan cards */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
            Available Plans
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-[var(--surface-raised)] border rounded-xl p-4 ${plan.color}`}
              >
                {plan.popular && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] bg-violet-600 text-white px-2 py-0.5 rounded-full font-semibold">
                    Popular
                  </span>
                )}
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-0.5">
                  {plan.name}
                </h3>
                <p className="text-lg font-bold text-violet-400 mb-3">
                  {plan.price}
                </p>
                <ul className="space-y-1 mb-4">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
                    >
                      <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-1.5 rounded-md text-xs font-medium transition-colors ${currentPlan === plan.name.toLowerCase() ? "bg-violet-600/20 text-violet-400 cursor-default" : "border border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-violet-500/40"}`}
                >
                  {currentPlan === plan.name.toLowerCase()
                    ? "Current plan"
                    : plan.name === "Enterprise"
                      ? "Contact us"
                      : "Upgrade"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Invoices */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
            Invoice History
          </p>
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-md bg-[var(--surface-overlay)] mb-2 animate-pulse"
              />
            ))
          ) : invoices.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">
              No invoices yet
            </p>
          ) : (
            invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-[var(--surface-border)]"
              >
                <div className="flex-1">
                  <p className="text-sm text-[var(--text-primary)]">
                    ${(inv.amount / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {inv.period}
                  </p>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${inv.status === "paid" ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"}`}
                >
                  {inv.status}
                </span>
                {inv.pdfUrl && (
                  <a
                    href={inv.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
