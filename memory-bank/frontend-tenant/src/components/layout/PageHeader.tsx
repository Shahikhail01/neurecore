"use client";
// ─── PageHeader.tsx ───────────────────────────────────────────────────────────
// SRP: Renders page-level header with title, subtitle, breadcrumb, and action slot.
// OCP: Breadcrumb, icon, and actions are optional — extend via props, never modify.
// DIP: No store access — receives all values through props.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: Crumb[];
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  icon,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex-shrink-0 px-page py-3 border-b border-surface-border bg-surface-raised flex items-center justify-between gap-4",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        {/* Breadcrumb */}
        {breadcrumb && breadcrumb.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1 text-micro text-text-secondary"
          >
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight
                    className="w-3 h-3 opacity-50"
                    aria-hidden="true"
                  />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-text-primary transition-colors duration-fast"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Title row */}
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-brand flex-shrink-0" aria-hidden="true">
              {icon}
            </span>
          )}
          <h1 className="text-heading font-semibold text-text-primary truncate">
            {title}
          </h1>
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-caption text-text-secondary">{subtitle}</p>
        )}
      </div>

      {/* Actions slot */}
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}
