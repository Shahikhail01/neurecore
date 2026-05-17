"use client";
// ─── AutonomyPill.tsx ─────────────────────────────────────────────────────────
// S — Single Responsibility: renders the autonomy-level selector only.
// O — Open/Closed: new levels added to LEVELS constant; render logic unchanged.
// D — Dependency Inversion: reads/writes state via useUIPreferencesStore
//     abstraction — no direct localStorage or context coupling.

import { useUIPreferencesStore } from "@/shared/stores/uiPreferencesStore";
import { cn } from "@/lib/utils";
import type { AutonomyLevel } from "@/config/theme.config";

// ─── Level config (OCP: add entries here, never modify render logic) ──────────
interface LevelConfig {
  value: AutonomyLevel;
  label: string;
  description: string;
}

const LEVELS: LevelConfig[] = [
  { value: "assist", label: "Assist", description: "AI suggests — you decide" },
  {
    value: "copilot",
    label: "Copilot",
    description: "AI acts with your review",
  },
  {
    value: "autopilot",
    label: "Autopilot",
    description: "AI acts autonomously",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function AutonomyPill() {
  const { autonomyLevel, setAutonomyLevel } = useUIPreferencesStore();

  return (
    <div
      role="radiogroup"
      aria-label="Autonomy level"
      className="flex items-center rounded-pill border border-surface-border bg-surface-overlay p-0.5 gap-0.5"
    >
      {LEVELS.map(({ value, label, description }) => (
        <button
          key={value}
          role="radio"
          aria-checked={autonomyLevel === value}
          title={description}
          onClick={() => setAutonomyLevel(value)}
          className={cn(
            "px-2.5 py-0.5 rounded-pill text-micro font-medium transition-colors duration-fast",
            autonomyLevel === value
              ? "bg-brand text-brand-foreground shadow-brand"
              : "text-text-secondary hover:text-text-primary",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
