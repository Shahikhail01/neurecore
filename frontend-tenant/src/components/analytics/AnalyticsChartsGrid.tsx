/**
 * Analytics Charts Grid - Phase 6
 *
 * Responsive grid layout for analytics charts.
 * Organizes charts in a responsive 1-3 column layout based on viewport.
 *
 * Features:
 * - Responsive grid (1 col mobile, 2 cols tablet, 3 cols desktop)
 * - Expandable/collapsible chart sections
 * - Consistent spacing and sizing
 * - Loading states for each chart
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AnalyticsChartsGridProps {
  /**
   * Grid items (charts and their metadata)
   */
  children: React.ReactNode;

  /**
   * Optional CSS class
   */
  className?: string;

  /**
   * Number of columns override (for specific layouts)
   */
  cols?: number;
}

interface AnalyticsChartItemProps {
  /**
   * Chart title
   */
  title: string;

  /**
   * Chart subtitle/description
   */
  subtitle?: string;

  /**
   * Chart content
   */
  children: React.ReactNode;

  /**
   * Is chart loading?
   */
  isLoading?: boolean;

  /**
   * Optional action/menu button
   */
  action?: React.ReactNode;

  /**
   * Optional CSS class
   */
  className?: string;

  /**
   * Span multiple columns (1-3)
   */
  span?: 1 | 2 | 3;
}

/**
 * Analytics Charts Grid Container
 *
 * Responsive grid layout for organizing analytics charts.
 * Automatically adjusts column count based on viewport size.
 *
 * @example
 * <AnalyticsChartsGrid>
 *   <AnalyticsChartItem title="Revenue">
 *     <LineChart data={data} />
 *   </AnalyticsChartItem>
 * </AnalyticsChartsGrid>
 */
export function AnalyticsChartsGrid({
  children,
  className = "",
  cols,
}: AnalyticsChartsGridProps) {
  const gridCols = cols
    ? `grid-cols-${cols}`
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div
      className={cn(
        "grid gap-4 w-full",
        // Responsive columns
        !cols && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        // Fixed columns if specified
        cols && `grid-cols-${cols}`,
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Individual Chart Item Component
 *
 * Card wrapper for each chart in the grid.
 * Includes header with title, subtitle, and optional actions.
 *
 * @example
 * <AnalyticsChartItem
 *   title="Agent Utilization"
 *   subtitle="24 hours"
 *   isLoading={loading}
 * >
 *   <LineChart data={data} height={300} />
 * </AnalyticsChartItem>
 */
export function AnalyticsChartItem({
  title,
  subtitle,
  children,
  isLoading = false,
  action,
  className = "",
  span = 1,
}: AnalyticsChartItemProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-surface-border bg-surface-base p-4",
        "transition-all duration-300 hover:shadow-md",
        // Spanning columns
        span === 2 && "sm:col-span-2",
        span === 3 && "sm:col-span-3",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="min-h-[250px] rounded-lg bg-surface-overlay animate-pulse" />
      ) : (
        <div className="min-h-[250px]">{children}</div>
      )}
    </div>
  );
}

export type { AnalyticsChartsGridProps, AnalyticsChartItemProps };
