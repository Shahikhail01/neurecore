"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowLeft, Plus, Trash2 } from "lucide-react";
import api from "@/services/api";

interface Step {
  id: number;
  name: string;
  agentRole: string;
}

export default function NewWorkflowPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, name: "", agentRole: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addStep = () =>
    setSteps([...steps, { id: Date.now(), name: "", agentRole: "" }]);
  const removeStep = (id: number) => setSteps(steps.filter((s) => s.id !== id));
  const updateStep = (id: number, field: keyof Step, value: string) =>
    setSteps(steps.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || steps.some((s) => !s.name.trim())) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/workflows", {
        name: name.trim(),
        description,
        steps: steps.map((s) => ({ name: s.name, agentRole: s.agentRole })),
      });
      router.push("/workflows");
    } catch {
      setError("Failed to create workflow. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto hide-scrollbar">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-6">
          <Zap className="w-5 h-5 text-violet-400" /> New Workflow
        </h1>
        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Workflow Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lead Qualification Pipeline"
              required
              className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this workflow accomplish?"
              className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Steps *
              </label>
              <button
                type="button"
                onClick={addStep}
                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Step
              </button>
            </div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-600/20 border border-violet-500/30 text-[10px] text-violet-400 flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    value={step.name}
                    onChange={(e) =>
                      updateStep(step.id, "name", e.target.value)
                    }
                    placeholder="Step name"
                    required
                    className="flex-1 px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-violet-500"
                  />
                  <input
                    value={step.agentRole}
                    onChange={(e) =>
                      updateStep(step.id, "agentRole", e.target.value)
                    }
                    placeholder="Assigned role"
                    className="w-36 px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-violet-500"
                  />
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(step.id)}
                      className="text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-2 rounded-md border border-[var(--surface-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-2 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm text-white font-medium transition-colors"
            >
              {loading ? "Creating…" : "Create Workflow"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
