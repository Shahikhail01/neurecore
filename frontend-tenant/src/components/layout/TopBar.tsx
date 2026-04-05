"use client";

import type { AuthUser } from "@/types/auth.types";
import { useTheme } from '@/hooks/useTheme';

export type AutonomyLevel = "assist" | "copilot" | "autopilot";

interface TopBarProps {
  title: string;
  user: AuthUser | null;
  autonomy: AutonomyLevel;
  onAutonomyChange: (level: AutonomyLevel) => void;
}

const LEVELS: { value: AutonomyLevel; label: string }[] = [
  { value: "assist", label: "Assist" },
  { value: "copilot", label: "Copilot" },
  { value: "autopilot", label: "Autopilot" },
];

export function TopBar({
  title,
  user,
  autonomy,
  onAutonomyChange,
}: TopBarProps) {
  const { theme, setTheme } = useTheme();
  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-[var(--surface-border)] bg-[var(--surface-base)] flex-shrink-0">
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {title}
      </span>

      <div className="flex items-center gap-4">
        {/* Autonomy selector */}
        <div className="flex items-center gap-1 text-xs">
          {LEVELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onAutonomyChange(value)}
              className={`px-2.5 py-1 rounded transition-colors ${
                autonomy === value
                  ? "bg-violet-600 text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {user && (
          <span className="text-xs text-[var(--text-secondary)]">
            {user.firstName ?? user.email}
          </span>
        )}

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title="Toggle theme"
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--surface-overlay)]"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
