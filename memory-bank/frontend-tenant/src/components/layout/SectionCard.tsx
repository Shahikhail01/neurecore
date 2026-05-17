"use client";
// ─── SectionCard.tsx ──────────────────────────────────────────────────────────
// SRP: Renders a bordered, titled card section.
// OCP: Title and action slot are configurable via props — no body changes needed.
// DIP: Stateless — all content injected through props.

import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Remove default padding on the body (e.g. for flush tables) */
  bodyClassName?: string;
}

export function SectionCard({
  title,
  action,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "bg-surface-raised border border-surface-border rounded-card overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-card py-3 border-b border-surface-border">
        <h2 className="text-caption font-semibold uppercase tracking-widest text-text-secondary">
          {title}
        </h2>
        {action && (
          <div className="text-caption text-text-secondary flex items-center gap-2">
            {action}
          </div>
        )}
      </div>

      {/* Body */}
      <div className={cn("p-card", bodyClassName)}>{children}</div>
    </section>
  );
}
