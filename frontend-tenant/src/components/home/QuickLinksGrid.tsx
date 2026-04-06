/**
 * Quick Links Grid Component
 *
 * A responsive grid of action links for common home screen tasks.
 * Provides quick access to primary workflows (create task, approve, etc.).
 * Follows SOLID principles with composable sub-components.
 *
 * Features:
 * - Customizable action items with icons and labels
 * - Responsive grid (1 col mobile, 2-3 cols tablet, 3-4 cols desktop)
 * - Hover effects and visual feedback
 * - Badge support for counts (new items, pending approvals)
 * - Accessible with proper ARIA labels and keyboard navigation
 * - Dark/light theme support via design tokens
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface QuickLink {
  /**
   * Unique identifier for the link
   */
  id: string;

  /**
   * Display label
   */
  label: string;

  /**
   * Icon component from lucide-react
   */
  icon: LucideIcon;

  /**
   * Callback when link is clicked
   */
  onClick?: () => void;

  /**
   * Optional href for navigation
   */
  href?: string;

  /**
   * Badge count or text (e.g., "5" for 5 new items)
   */
  badge?: string | number;

  /**
   * Badge variant (optional)
   */
  badgeVariant?: "default" | "danger" | "warning" | "success";

  /**
   * Whether the link is disabled
   */
  disabled?: boolean;

  /**
   * Description or hint text
   */
  description?: string;
}

interface QuickLinksGridProps {
  /**
   * Array of quick links to display
   */
  links: QuickLink[];

  /**
   * Number of columns (default: responsive)
   */
  columns?: number;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * QuickLinksGrid Component
 *
 * @example
 * <QuickLinksGrid
 *   links={[
 *     {
 *       id: "new-task",
 *       label: "New Task",
 *       icon: Plus,
 *       onClick: () => console.log("Create task")
 *     }
 *   ]}
 * />
 */
export function QuickLinksGrid({
  links,
  columns = 3,
  className,
}: QuickLinksGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
      role="region"
      aria-label="Quick actions"
    >
      {links.map((link) => (
        <QuickLinkItem key={link.id} link={link} />
      ))}
    </div>
  );
}

/**
 * Individual Quick Link Item
 *
 * Composable sub-component for Single Responsibility Principle
 */
function QuickLinkItem({ link }: { link: QuickLink }) {
  const Icon = link.icon;
  const badgeVariantColorMap = {
    default: "bg-accent-primary text-white",
    danger: "bg-status-danger text-white",
    warning: "bg-status-warning text-white",
    success: "bg-status-success text-white",
  };

  const handleClick = () => {
    if (link.disabled) return;
    if (link.onClick) {
      link.onClick();
    }
  };

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-full h-full p-4",
        "text-center transition-all duration-base",
      )}
    >
      {/* Icon */}
      <Icon
        className={cn(
          "w-8 h-8 md:w-10 md:h-10 mb-3",
          "text-text-primary",
          "transition-transform duration-base",
          !link.disabled &&
            "group-hover:scale-110 group-hover:text-accent-primary",
        )}
      />

      {/* Label */}
      <h3
        className={cn(
          "font-semibold text-sm md:text-base",
          "text-text-primary mb-1",
          !link.disabled && "group-hover:text-accent-primary",
        )}
      >
        {link.label}
      </h3>

      {/* Description */}
      {link.description && (
        <p className="text-xs text-text-muted line-clamp-2">
          {link.description}
        </p>
      )}

      {/* Badge */}
      {link.badge !== undefined && (
        <span
          className={cn(
            "mt-2 px-2 py-1 rounded-full text-xs font-semibold",
            badgeVariantColorMap[link.badgeVariant || "default"],
          )}
        >
          {link.badge}
        </span>
      )}
    </div>
  );

  const baseClasses = cn(
    "group relative p-4 md:p-6",
    "rounded-lg border border-surface-border",
    "bg-surface-raised transition-all duration-base",
    "focus-within:ring-2 focus-within:ring-accent-primary focus-within:ring-offset-2",
  );

  const interactiveClasses =
    !link.disabled &&
    cn(
      "hover:border-accent-primary hover:shadow-md",
      "hover:bg-surface-base cursor-pointer",
      "active:scale-95",
    );

  const disabledClasses =
    link.disabled && cn("opacity-50 cursor-not-allowed", "bg-surface-muted");

  if (link.href) {
    return (
      <a
        href={link.href}
        className={cn(baseClasses, interactiveClasses, disabledClasses)}
        onClick={(e) => {
          if (link.disabled) {
            e.preventDefault();
          }
        }}
        aria-disabled={link.disabled}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={link.disabled}
      className={cn(
        baseClasses,
        interactiveClasses,
        disabledClasses,
        "text-left",
      )}
      title={link.description}
      aria-label={`${link.label}${link.description ? `: ${link.description}` : ""}`}
    >
      {content}
    </button>
  );
}

export type { QuickLink, QuickLinksGridProps };
