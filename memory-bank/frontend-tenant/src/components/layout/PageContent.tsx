"use client";
// ─── PageContent.tsx ──────────────────────────────────────────────────────────
// SRP: Provides consistent horizontal padding and vertical scroll for page body.
// DIP: Stateless — wraps children only.

import { cn } from "@/lib/utils";

interface PageContentProps {
  children: React.ReactNode;
  /** Extra classes — e.g. override padding for a table view */
  className?: string;
  /** Disable default padding (for pages that manage their own) */
  noPadding?: boolean;
}

export function PageContent({
  children,
  className,
  noPadding,
}: PageContentProps) {
  return (
    <div
      className={cn("flex-1 overflow-auto", !noPadding && "p-page", className)}
    >
      {children}
    </div>
  );
}
