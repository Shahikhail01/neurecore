"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, ArrowLeft, Sparkles } from "lucide-react";
import api from "@/services/api";

const AGENT_ROLES = [
  "Research Analyst",
  "Financial Analyst",
  "Marketing Specialist",
  "Sales Representative",
  "Customer Support",
  "Operations Manager",
  "Data Scientist",
  "Content Writer",
  "Project Manager",
  "Strategy Advisor",
  "HR Specialist",
  "Legal Assistant",
  "Software Engineer",
  "Product Manager",
  "Business Development",
];

const AUTONOMY_LEVELS = [
  {
    value: "full",
    label: "Full Auto",
    desc: "Agent acts independently, no approvals needed",
  },
  {
    value: "supervised",
    label: "Supervised",
    desc: "Agent works but flags decisions for review",
  },
  {
    value: "manual",
    label: "Manual",
    desc: "Agent only acts when explicitly instructed",
  },
];

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [instructions, setInstructions] = useState("");
  const [autonomy, setAutonomy] = useState("supervised");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedRole = role === "__custom__" ? customRole : role;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedRole.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/agents", {
        name: name.trim(),
        role: selectedRole.trim(),
        instructions,
        autonomyLevel: autonomy,
      });
      router.push("/agents");
    } catch {
      setError("Failed to deploy agent. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto hide-scrollbar">
      <div className="max-w-xl mx-auto px-5 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-violet-600/10 border border-violet-500/30 flex items-center justify-center">
            <Bot className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Hire a New Agent
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Configure your AI employee
            </p>
          </div>
        </div>
        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Agent Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex, Atlas, Nova"
              required
              className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Role / Specialty *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-violet-500 mb-2"
            >
              <option value="">Select a role…</option>
              {AGENT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="__custom__">Custom role…</option>
            </select>
            {role === "__custom__" && (
              <input
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="Define custom role"
                className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-violet-500"
              />
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" /> Custom
              Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder="Describe the agent's personality, priorities, and how it should work…"
              className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
              Autonomy Level
            </label>
            <div className="space-y-2">
              {AUTONOMY_LEVELS.map((lvl) => (
                <label
                  key={lvl.value}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors ${autonomy === lvl.value ? "border-violet-500 bg-violet-500/10" : "border-[var(--surface-border)] hover:border-violet-500/40"}`}
                >
                  <input
                    type="radio"
                    name="autonomy"
                    value={lvl.value}
                    checked={autonomy === lvl.value}
                    onChange={() => setAutonomy(lvl.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {lvl.label}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {lvl.desc}
                    </p>
                  </div>
                </label>
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
              disabled={loading || !name.trim() || !selectedRole.trim()}
              className="flex-1 py-2 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm text-white font-medium transition-colors"
            >
              {loading ? "Deploying…" : "Deploy Agent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
