"use client";

import { useState, useEffect } from "react";
import { onboardingApi } from "@/services/onboarding.service";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { SelectPlanDto, BillingCycle, TierDto } from "@/types/onboarding.types";

interface PlanStepProps {
  wizardData?: { tierId?: string; billingCycle?: BillingCycle };
  onSubmit?: (data: SelectPlanDto) => void;
  onSkip?: () => void;
}

export function PlanStep({ wizardData, onSubmit, onSkip }: PlanStepProps) {
  const { wizardId, tiers, setPlanData, setTiers } = useOnboardingStore();
  const [selectedTier, setSelectedTier] = useState(wizardData?.tierId || "");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    wizardData?.billingCycle || BillingCycle.MONTHLY,
  );
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTiers, setLoadingTiers] = useState(false);

  // Load tiers from API if not already in store
  useEffect(() => {
    if (tiers.length > 0) return;
    setLoadingTiers(true);
    onboardingApi
      .getPlans()
      .then((res) => {
        setTiers(res.tiers);
        if (!selectedTier && res.tiers.length > 0) {
          // Pre-select the middle/popular tier
          const popular = res.tiers[Math.floor(res.tiers.length / 2)];
          setSelectedTier(popular.id);
        }
      })
      .catch(() => setError("Failed to load plans"))
      .finally(() => setLoadingTiers(false));
  }, [tiers.length, setTiers, selectedTier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizardId || !selectedTier) {
      setError("Please select a plan to continue");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const dto: SelectPlanDto = {
        wizardId,
        tierId: selectedTier,
        billingCycle,
      };

      await onboardingApi.selectPlan(dto);
      setPlanData({ tierId: dto.tierId, billingCycle: dto.billingCycle });
      onSubmit?.(dto);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select plan");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number, cycle: BillingCycle) => {
    return cycle === BillingCycle.YEARLY
      ? `$${Math.round(price * 0.83)}/mo`
      : `$${price}/mo`;
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 max-w-3xl mx-auto shadow-xl backdrop-blur-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Choose Your Plan</h2>
        <p className="text-sm text-zinc-400">Select the plan that best fits your needs</p>
      </div>

      {loadingTiers ? (
        <div className="flex items-center justify-center py-16">
          <svg className="w-6 h-6 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Billing Toggle */}
          <div className="flex justify-center">
            <div className="inline-flex rounded-xl border border-zinc-700 bg-zinc-800/60 p-1 gap-1">
              <button
                type="button"
                onClick={() => setBillingCycle(BillingCycle.MONTHLY)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  billingCycle === BillingCycle.MONTHLY
                    ? "bg-violet-600 text-white shadow"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle(BillingCycle.YEARLY)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  billingCycle === BillingCycle.YEARLY
                    ? "bg-violet-600 text-white shadow"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Yearly <span className="text-green-400 text-xs ml-1">-17%</span>
              </button>
            </div>
          </div>

          {/* Plan Cards */}
          {tiers.length === 0 ? (
            <p className="text-center text-sm text-zinc-500 py-8">No plans available. You can continue and select a plan later.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {tiers.map((tier: TierDto) => (
                <div
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all ${
                    selectedTier === tier.id
                      ? "border-violet-500 bg-violet-600/10"
                      : "border-zinc-700 hover:border-zinc-600 bg-zinc-800/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={tier.id}
                    checked={selectedTier === tier.id}
                    onChange={() => setSelectedTier(tier.id)}
                    className="sr-only"
                  />
                  <h3 className="text-base font-semibold text-white">{tier.name}</h3>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-white">
                      {formatPrice(
                        billingCycle === BillingCycle.YEARLY
                          ? tier.yearlyPrice
                          : tier.monthlyPrice,
                        billingCycle,
                      )}
                    </span>
                    <span className="text-zinc-500 text-xs ml-1">
                      {billingCycle === BillingCycle.YEARLY ? "/mo, billed yearly" : "/month"}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-zinc-400">
                    <li>{tier.maxUsers} users</li>
                    <li>{tier.maxAgents === -1 ? "Unlimited" : tier.maxAgents} agents</li>
                    <li>{tier.maxStorageGB}GB storage</li>
                  </ul>
                  {selectedTier === tier.id && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={onSkip}
              className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-300"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </>
              ) : (
                "Continue →"
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
