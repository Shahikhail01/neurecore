"use client";

/**
 * PoolToolbar — search + optional status filter pills + count.
 * Phase 10 — shared pool shell component (SRP).
 */

export interface PoolToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filters?: { label: string; value: string }[];
  activeFilter?: string;
  onFilterChange?: (v: string) => void;
  count?: number;
  countLabel?: string;
}

export function PoolToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters,
  activeFilter,
  onFilterChange,
  count,
  countLabel,
}: PoolToolbarProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="flex-1 min-w-56 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[color:var(--accent-500)] transition"
      />
      {filters && filters.length > 0 && onFilterChange && (
        <div className="flex gap-1 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
                activeFilter === f.value
                  ? "bg-[color:var(--accent-500)] text-white"
                  : "border border-surface-border text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
      {typeof count === "number" && (
        <span className="text-xs text-zinc-600 ml-auto">
          {count} {countLabel ?? "items"}
        </span>
      )}
    </div>
  );
}
