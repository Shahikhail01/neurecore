"use client";

import { useState } from "react";
import { onboardingApi } from "@/services/onboarding.service";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { UpdateAdminDto } from "@/types/onboarding.types";

interface AdminStepProps {
  wizardData?: Partial<UpdateAdminDto>;
  onSubmit?: (data: UpdateAdminDto) => void;
  onSkip?: () => void;
}

export function AdminStep({ wizardData, onSubmit, onSkip }: AdminStepProps) {
  const { wizardId, setAdminData } = useOnboardingStore();
  const [formData, setFormData] = useState({
    firstName: wizardData?.firstName || "",
    lastName: wizardData?.lastName || "",
    phone: wizardData?.phone || "",
    jobTitle: wizardData?.jobTitle || "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!wizardId) {
      setError("Wizard session not found. Please refresh and try again.");
      return;
    }

    setIsLoading(true);

    try {
      const dto: UpdateAdminDto = {
        wizardId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || undefined,
        jobTitle: formData.jobTitle || undefined,
      };

      await onboardingApi.updateAdmin(dto);
      setAdminData({
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        jobTitle: dto.jobTitle,
      });
      onSubmit?.(dto);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save admin details",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-zinc-700 bg-zinc-800/70 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50";
  const labelCls =
    "block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1.5";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 max-w-xl mx-auto shadow-xl backdrop-blur-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Admin Profile</h2>
        <p className="text-sm text-zinc-400">
          Set up your administrator profile
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={labelCls}>First Name *</span>
            <input
              id="firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              required
              className={inputCls}
              placeholder="John"
            />
          </label>

          <label className="block">
            <span className={labelCls}>Last Name *</span>
            <input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              required
              className={inputCls}
              placeholder="Doe"
            />
          </label>
        </div>

        <label className="block">
          <span className={labelCls}>Job Title</span>
          <input
            id="jobTitle"
            type="text"
            value={formData.jobTitle}
            onChange={(e) => handleChange("jobTitle", e.target.value)}
            className={inputCls}
            placeholder="CEO"
          />
        </label>

        <label className="block">
          <span className={labelCls}>Phone Number</span>
          <input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            className={inputCls}
            placeholder="+1 (555) 123-4567"
          />
        </label>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
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
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Saving…
              </>
            ) : (
              "Continue →"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
