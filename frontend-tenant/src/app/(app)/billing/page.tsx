"use client";

import { useEffect, useState } from "react";
import { CreditCard, Download, CheckCircle2 } from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";

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
    color: "border-surface-border",
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
    color: "border-brand/40",
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
    color: "border-status-ops/30",
  },
];

export default function BillingPage() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/billing/invoices")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setInvoices(res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const currentPlan = (user as { plan?: string })?.plan ?? "starter";

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Billing & Plans"
        subtitle="Manage your subscription and payment information"
        icon={<CreditCard className="w-4 h-4" />}
      />

      <PageContent>
        <div className="space-y-6 max-w-3xl">
          {/* Current plan banner */}
          <div className="bg-brand/10 border border-brand/20 rounded-card px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Current Plan:{" "}
                <span className="text-brand capitalize">{currentPlan}</span>
              </p>
              <p className="text-caption text-text-secondary mt-0.5">
                Your next billing date will appear here once connected to Stripe
              </p>
            </div>
            <button className="px-3 py-1.5 rounded-input border border-brand/40 text-caption text-brand hover:bg-brand/10 transition-colors">
              Manage
            </button>
          </div>

          {/* Plan cards */}
          <div>
            <p className="text-micro font-semibold uppercase tracking-widest text-text-secondary mb-3">
              Available Plans
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative bg-surface-raised border rounded-card p-4 ${plan.color}`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-micro bg-brand text-white px-2 py-0.5 rounded-pill font-semibold">
                      Popular
                    </span>
                  )}
                  <h3 className="text-sm font-bold text-text-primary mb-0.5">
                    {plan.name}
                  </h3>
                  <p className="text-lg font-bold text-brand mb-3">
                    {plan.price}
                  </p>
                  <ul className="space-y-1 mb-4">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-1.5 text-caption text-text-secondary"
                      >
                        <CheckCircle2 className="w-3 h-3 text-status-profit flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`w-full py-1.5 rounded-input text-caption font-medium transition-colors ${currentPlan === plan.name.toLowerCase() ? "bg-brand/20 text-brand cursor-default" : "border border-surface-border text-text-secondary hover:text-text-primary hover:border-brand/40"}`}
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
            <p className="text-micro font-semibold uppercase tracking-widest text-text-secondary mb-3">
              Invoice History
            </p>
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 rounded-input bg-surface-overlay mb-2 animate-pulse"
                />
              ))
            ) : invoices.length === 0 ? (
              <p className="text-caption text-text-secondary">
                No invoices yet
              </p>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-surface-border"
                >
                  <div className="flex-1">
                    <p className="text-sm text-text-primary">
                      ${(inv.amount / 100).toFixed(2)}
                    </p>
                    <p className="text-caption text-text-secondary">
                      {inv.period}
                    </p>
                  </div>
                  <span
                    className={`text-micro px-2 py-0.5 rounded-pill ${
                      inv.status === "paid"
                        ? "bg-status-profit/10 text-status-profit"
                        : "bg-status-warn/10 text-status-warn"
                    }`}
                  >
                    {inv.status}
                  </span>
                  {inv.pdfUrl && (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </PageContent>
    </div>
  );
}
