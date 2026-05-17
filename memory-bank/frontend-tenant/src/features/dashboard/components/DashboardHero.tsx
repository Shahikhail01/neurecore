"use client";
// ─── DashboardHero.tsx ────────────────────────────────────────────────────────
// SRP: Renders the greeting + central AI input for the dashboard hero section.
// OCP: Metric summary line auto-adapts from `metrics` prop — no render changes.
// DIP: Data injected via props; stores accessed only for auth (user name) and
//      AI panel toggle (to open panel after sending a message).

import { useState, FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUIPreferencesStore } from "@/shared/stores/uiPreferencesStore";
import { useAIChat } from "@/shared/hooks/useAIChat";
import { sanitizeUserInput } from "@/lib/security";
import { cn } from "@/lib/utils";
import type { CompanyMetrics } from "@/shared/types/domain.types";

interface DashboardHeroProps {
  metrics: CompanyMetrics | null;
  loading: boolean;
}

// OCP: Add / remove quick prompt strings without changing render logic
const QUICK_PROMPTS = [
  "What needs my attention today?",
  "Summarise yesterday's activity",
  "Show overdue tasks",
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardHero({ metrics, loading }: DashboardHeroProps) {
  const { user } = useAuthStore();
  const { aiPanelOpen, toggleAIPanel } = useUIPreferencesStore();
  const { send } = useAIChat("dashboard");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = sanitizeUserInput(input.trim());
    if (!text) return;
    setInput("");
    setSending(true);
    await send(text);
    setSending(false);
    if (!aiPanelOpen) toggleAIPanel();
  };

  const handleQuick = async (prompt: string) => {
    setSending(true);
    await send(sanitizeUserInput(prompt));
    setSending(false);
    if (!aiPanelOpen) toggleAIPanel();
  };

  const metaSummary = loading
    ? null
    : metrics
      ? `${metrics.activeAgents} agent${metrics.activeAgents !== 1 ? "s" : ""} active · ${metrics.tasksPending} task${metrics.tasksPending !== 1 ? "s" : ""} pending`
      : null;

  return (
    <div className="relative flex-shrink-0 px-page pt-8 pb-7 overflow-hidden border-b border-surface-border">
      {/* Subtle brand gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, var(--brand-subtle) 0%, transparent 70%)",
          opacity: 0.18,
        }}
      />

      <div className="relative max-w-2xl mx-auto text-center">
        {/* Greeting */}
        <h1 className="text-display font-bold text-text-primary mb-1">
          {getGreeting()}, {user?.firstName ?? "there"}
        </h1>

        {/* Context summary */}
        <p className="text-body text-text-secondary mb-6 min-h-[1.5rem]">
          {loading ? (
            <span className="inline-block w-48 h-4 rounded bg-surface-muted animate-pulse" />
          ) : (
            metaSummary
          )}
        </p>

        {/* AI input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your agents anything…"
            className={cn(
              "flex-1 rounded-card bg-surface-raised border border-surface-border px-4 py-3",
              "text-body text-text-primary placeholder:text-text-muted",
              "focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand",
              "transition-colors duration-fast",
            )}
            autoComplete="off"
            aria-label="Ask your agents"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send message"
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 rounded-card",
              "bg-brand text-brand-foreground font-medium text-body",
              "hover:bg-brand-dim transition-colors duration-fast",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>

        {/* Quick prompts */}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => handleQuick(p)}
              disabled={sending}
              className={cn(
                "px-3 py-1 rounded-pill text-micro border border-surface-border",
                "text-text-secondary bg-surface-overlay",
                "hover:border-brand/40 hover:text-brand transition-colors duration-fast",
                "disabled:opacity-40",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
