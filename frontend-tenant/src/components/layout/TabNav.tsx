"use client";
// ─── TabNav.tsx ───────────────────────────────────────────────────────────────
// SRP: Renders a horizontal tab navigation strip.
// OCP: New tabs added via the `tabs` array prop — render logic never changes.
// DIP: Fully controlled — active state and onChange injected from parent.

import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabNavProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function TabNav({ tabs, active, onChange, className }: TabNavProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex border-b border-surface-border px-page gap-1 flex-shrink-0",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-caption font-medium border-b-2 transition-colors duration-fast",
              isActive
                ? "border-brand text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary",
            )}
          >
            {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
