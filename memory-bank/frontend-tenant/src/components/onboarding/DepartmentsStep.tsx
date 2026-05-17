"use client";

import { useState } from "react";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { onboardingApi } from "@/services/onboarding.service";
import { Plus, X } from "lucide-react";

interface DepartmentsStepProps {
  onSubmit?: (data: { departments: string[] }) => void;
  onSkip?: () => void;
}

const DEFAULT_DEPARTMENTS = [
  "Sales", "Marketing", "Engineering", "Operations", "Finance",
  "Human Resources", "Customer Support", "Legal",
];

export function DepartmentsStep({ onSubmit, onSkip }: DepartmentsStepProps) {
  const { wizardId, setDepartmentsData } = useOnboardingStore();
  const [departments, setDepartments] = useState<string[]>([""]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const addDepartment = () => setDepartments([...departments, ""]);

  const removeDepartment = (index: number) =>
    setDepartments(departments.filter((_, i) => i !== index));

  const updateDepartment = (index: number, value: string) => {
    const updated = [...departments];
    updated[index] = value;
    setDepartments(updated);
  };

  const addPreset = (name: string) => {
    if (departments.some((d) => d.trim().toLowerCase() === name.toLowerCase())) return;
    const empty = departments.findIndex((d) => d.trim() === "");
    if (empty !== -1) {
      updateDepartment(empty, name);
    } else {
      setDepartments([...departments, name]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validDepts = departments.filter((d) => d.trim() !== "");

    if (validDepts.length === 0) {
      onSkip?.();
      return;
    }

    if (!wizardId) {
      setError("Wizard session not found. Please refresh and try again.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const result = await onboardingApi.createDepartments({
        wizardId,
        departments: validDepts.map((name) => ({ name })),
      });
      setDepartmentsData(result.departments);
      onSubmit?.({ departments: validDepts });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save departments");
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls =
    "flex-1 rounded-xl border border-zinc-700 bg-zinc-800/70 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 max-w-2xl mx-auto shadow-xl backdrop-blur-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Create Departments</h2>
        <p className="text-sm text-zinc-400">
          Organize your team into departments (you can always add more later)
        </p>
      </div>

      {/* Quick presets */}
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">Quick add</p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_DEPARTMENTS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => addPreset(d)}
              className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-xs text-zinc-300 hover:border-violet-500/50 hover:text-violet-300 transition"
            >
              + {d}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2.5">
          {departments.map((dept, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="text"
                value={dept}
                onChange={(e) => updateDepartment(index, e.target.value)}
                placeholder={`Department ${index + 1}`}
                className={inputCls}
              />
              {departments.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDepartment(index)}
                  className="p-2 text-zinc-600 hover:text-red-400 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addDepartment}
          className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition"
        >
          <Plus className="w-4 h-4" /> Add another
        </button>

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
    </div>
  );
}

