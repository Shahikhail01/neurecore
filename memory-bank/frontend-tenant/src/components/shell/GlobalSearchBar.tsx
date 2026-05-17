"use client";
// ─── GlobalSearchBar.tsx ──────────────────────────────────────────────────────
// S — Single Responsibility: renders the search trigger and delegates execution
//     to the CommandPalette via the injected callback.
// D — Dependency Inversion: onOpenPalette is injected; no direct store imports
//     (caller decides which store action to invoke).

import { Search } from "lucide-react";

interface GlobalSearchBarProps {
  /** Callback to open the command palette overlay */
  onOpenPalette: () => void;
}

export function GlobalSearchBar({ onOpenPalette }: GlobalSearchBarProps) {
  return (
    <button
      onClick={onOpenPalette}
      aria-label="Open command search (⌘K)"
      className="group flex items-center gap-2 w-full max-w-xs h-8 px-3 rounded-input bg-surface-overlay border border-surface-border text-body text-text-secondary hover:border-brand/40 hover:text-text-primary transition-colors duration-fast"
    >
      <Search
        className="w-3.5 h-3.5 flex-shrink-0 text-text-muted group-hover:text-text-secondary transition-colors"
        aria-hidden="true"
      />
      <span className="flex-1 text-left text-text-muted group-hover:text-text-secondary transition-colors truncate">
        Search anything…
      </span>
      <kbd
        className="ml-auto text-micro border border-surface-border rounded px-1 py-0.5 bg-surface-raised text-text-muted font-mono"
        aria-hidden="true"
      >
        ⌘K
      </kbd>
    </button>
  );
}
