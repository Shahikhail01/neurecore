"use client";

import { useState } from "react";
import { onboardingApi } from "@/services/onboarding.service";
import { useOnboardingStore } from "@/stores/onboardingStore";
import {
  UpdateOrganizationDto,
  INDUSTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
} from "@/types/onboarding.types";

interface OrganizationStepProps {
  wizardData?: Partial<UpdateOrganizationDto>;
  onSubmit?: (data: UpdateOrganizationDto) => void;
  onSkip?: () => void;
}

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
];

export function OrganizationStep({
  wizardData,
  onSubmit,
  onSkip,
}: OrganizationStepProps) {
  const { wizardId, setCompanyData } = useOnboardingStore();
  const [formData, setFormData] = useState({
    name: wizardData?.name || "",
    slug: wizardData?.slug || "",
    industry: wizardData?.industry || "",
    size: wizardData?.size || "",
    website: wizardData?.website || "",
    timezone:
      wizardData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    currency: wizardData?.currency || "USD",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-generate slug from name only while slug hasn't been manually edited
      if (field === "name" && !prev.slug) {
        updated.slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!wizardId) {
      setError("Wizard session not found. Please refresh and try again.");
      return;
    }

    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(formData.slug)) {
      setError(
        "Slug may only contain lowercase letters, numbers, and hyphens (no leading/trailing hyphens)",
      );
      return;
    }

    setIsLoading(true);

    try {
      const dto: UpdateOrganizationDto = {
        wizardId,
        name: formData.name,
        slug: formData.slug,
        industry: formData.industry as UpdateOrganizationDto["industry"],
        size: formData.size as UpdateOrganizationDto["size"],
        website: formData.website || undefined,
        timezone: formData.timezone,
        currency: formData.currency,
      };

      await onboardingApi.updateOrganization(dto);
      setCompanyData({
        name: dto.name,
        slug: dto.slug,
        industry: dto.industry,
        size: dto.size,
        website: dto.website,
        timezone: dto.timezone,
        currency: dto.currency,
      });
      onSubmit?.(dto);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save organisation details",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-zinc-700 bg-zinc-800/70 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50";
  const labelCls =
    "block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1.5";
  const selectCls =
    "w-full rounded-xl border border-zinc-700 bg-zinc-800/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 max-w-2xl mx-auto shadow-xl backdrop-blur-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">
          Organisation Details
        </h2>
        <p className="text-sm text-zinc-400">Tell us about your company</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Company Name */}
        <label className="block">
          <span className={labelCls}>Company Name *</span>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            required
            className={inputCls}
            placeholder="Acme Inc."
          />
        </label>

        {/* URL Slug */}
        <div>
          <span className={labelCls}>Workspace URL *</span>
          <div className="flex items-center gap-0 rounded-xl border border-zinc-700 bg-zinc-800/70 overflow-hidden focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500/50 transition">
            <span className="pl-3 pr-1 text-sm text-zinc-500 whitespace-nowrap">
              neurecore.ai/
            </span>
            <input
              id="slug"
              type="text"
              value={formData.slug}
              onChange={(e) => handleChange("slug", e.target.value)}
              required
              className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white outline-none placeholder-zinc-500"
              placeholder="acme-inc"
            />
          </div>
          <p className="mt-1 text-xs text-zinc-600">
            Lowercase letters, numbers, and hyphens only
          </p>
        </div>

        {/* Industry + Size */}
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={labelCls}>Industry *</span>
            <select
              id="industry"
              value={formData.industry}
              onChange={(e) => handleChange("industry", e.target.value)}
              required
              className={selectCls}
            >
              <option value="">Select industry</option>
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={labelCls}>Company Size *</span>
            <select
              id="size"
              value={formData.size}
              onChange={(e) => handleChange("size", e.target.value)}
              required
              className={selectCls}
            >
              <option value="">Select size</option>
              {COMPANY_SIZE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Website */}
        <label className="block">
          <span className={labelCls}>Website</span>
          <input
            id="website"
            type="url"
            value={formData.website}
            onChange={(e) => handleChange("website", e.target.value)}
            className={inputCls}
            placeholder="https://example.com"
          />
        </label>

        {/* Timezone + Currency */}
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={labelCls}>Timezone</span>
            <select
              id="timezone"
              value={formData.timezone}
              onChange={(e) => handleChange("timezone", e.target.value)}
              className={selectCls}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={labelCls}>Currency</span>
            <select
              id="currency"
              value={formData.currency}
              onChange={(e) => handleChange("currency", e.target.value)}
              className={selectCls}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="AED">AED (د.إ)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="CAD">CAD (C$)</option>
            </select>
          </label>
        </div>

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
